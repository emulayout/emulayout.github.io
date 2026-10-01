import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
	CYANOPHAGE_FINGERPRINT_FILES,
	cyanophageAnalyzerFingerprint,
	openCyanophageStatsCache
} from '../bin/cyanophage-stats-cache.js';
import {
	CYANOPHAGE_STAT_KEYS,
	buildCyanophageStats,
	loadCyanophageData
} from '../bin/cyanophage-stats.js';

const directories: string[] = [];
async function temporaryDirectory() {
	const directory = await mkdtemp(join(tmpdir(), 'cyanophage-cache-test-'));
	directories.push(directory);
	return directory;
}
afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const input = {
	geometry: 'column-stagger',
	keys: { a: { row: 1, col: 0, finger: 'LP' } },
	magicMappings: { '*': { a: 'b' } }
};
const stats = CYANOPHAGE_STAT_KEYS.map((_, index) => index);

describe('persistent Cyanophage stats cache', () => {
	test('preserves real corpus results for both geometries across a cold and warm run', async () => {
		const options = {
			directory: await temporaryDirectory(),
			fingerprint: await cyanophageAnalyzerFingerprint()
		};
		const data = await loadCyanophageData();
		const keys = Object.fromEntries(
			['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'].flatMap((row, r) =>
				Array.from(row, (char, col) => [char, { row: r, col }])
			)
		);
		const cache = await openCyanophageStatsCache(options);
		const results = new Map<string, number[]>();
		for (const geometry of ['column-stagger', 'row-stagger'] as const) {
			const expected = buildCyanophageStats({ keys, geometry }, data);
			expect(expected).not.toBeNull();
			results.set(geometry, expected!);
			expect(cache.getOrCompute({ keys, geometry }, () => expected)).toEqual({
				stats: expected,
				cached: false
			});
		}
		await cache.save();
		const warm = await openCyanophageStatsCache(options);
		for (const [geometry, expected] of results) {
			expect(
				warm.getOrCompute({ keys, geometry }, () => {
					throw Error('unexpected recomputation');
				})
			).toEqual({ stats: expected, cached: true });
		}
	});
	test('reuses results across runs and invalidates only changed scorer inputs', async () => {
		const directory = await temporaryDirectory();
		const options = { directory, fingerprint: 'analyzer-v1' };
		let calls = 0;
		const compute = () => {
			calls++;
			return stats;
		};
		const first = await openCyanophageStatsCache(options);
		expect(first.getOrCompute(input, compute)).toEqual({ stats, cached: false });
		await first.save();
		const second = await openCyanophageStatsCache(options);
		const renamed = { ...input, name: 'renamed', owner: 'new owner' };
		expect(second.getOrCompute(renamed, compute)).toEqual({ stats, cached: true });
		expect(calls).toBe(1);
		for (const changed of [
			{ ...input, geometry: 'row-stagger' },
			{ ...input, keys: { a: { row: 1, col: 1, finger: 'LP' } } },
			{ ...input, keys: { a: { row: 1, col: 0, finger: 'LR' } } },
			{ ...input, magicMappings: { '*': { a: 'c' } } }
		])
			expect(second.getOrCompute(changed, compute).cached).toBe(false);
		expect(second.getOrCompute(input, compute).cached).toBe(true);
		const revised = await openCyanophageStatsCache({ ...options, fingerprint: 'analyzer-v2' });
		expect(revised.getOrCompute(input, compute).cached).toBe(false);
		const forced = await openCyanophageStatsCache({ ...options, force: true });
		expect(forced.getOrCompute(input, compute).cached).toBe(false);
	});

	test('caches unsupported results but never caches computation failures', async () => {
		const options = { directory: await temporaryDirectory(), fingerprint: 'v1' };
		const cache = await openCyanophageStatsCache(options);
		expect(cache.getOrCompute(input, () => null)).toEqual({ stats: null, cached: false });
		await cache.save();
		const restored = await openCyanophageStatsCache(options);
		expect(
			restored.getOrCompute(input, () => {
				throw Error('should not run');
			})
		).toEqual({ stats: null, cached: true });
		const other = { ...input, geometry: 'row-stagger' };
		expect(() =>
			restored.getOrCompute(other, () => {
				throw Error('failed');
			})
		).toThrow('failed');
		expect(() => restored.getOrCompute(other, () => [NaN])).toThrow('Invalid Cyanophage');
		expect(restored.getOrCompute(other, () => stats).cached).toBe(false);
	});

	test('recovers from corrupt files and malformed entries without losing valid hits', async () => {
		const directory = await temporaryDirectory();
		const options = { directory, fingerprint: 'v1' };
		const path = join(directory, 'stats-v1.json');
		for (const invalid of ['{', 'null', '{}', '{"version":99}']) {
			await writeFile(path, invalid);
			const cache = await openCyanophageStatsCache(options);
			expect(cache.getOrCompute(input, () => stats).cached).toBe(false);
		}
		const cache = await openCyanophageStatsCache(options);
		cache.getOrCompute(input, () => stats);
		cache.getOrCompute({ ...input, geometry: 'row-stagger' }, () => stats);
		await cache.save();
		const stored = JSON.parse(await readFile(path, 'utf8'));
		const key = Object.keys(stored.entries)[0];
		stored.entries[key!] = [1, 'bad'];
		await writeFile(path, JSON.stringify(stored));
		const restored = await openCyanophageStatsCache(options);
		const hits = [input, { ...input, geometry: 'row-stagger' }].map(
			(value) => restored.getOrCompute(value, () => stats).cached
		);
		expect(hits.filter(Boolean)).toHaveLength(1);
	});

	test('fingerprints every analyzer dependency and data file', async () => {
		const root = await temporaryDirectory();
		for (const path of CYANOPHAGE_FINGERPRINT_FILES) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), 'original');
		}
		const original = await cyanophageAnalyzerFingerprint(root);
		for (const path of CYANOPHAGE_FINGERPRINT_FILES) {
			await writeFile(join(root, path), 'changed');
			expect(await cyanophageAnalyzerFingerprint(root)).not.toBe(original);
			await writeFile(join(root, path), 'original');
		}
		expect(await cyanophageAnalyzerFingerprint(root)).toBe(original);
	});
});
