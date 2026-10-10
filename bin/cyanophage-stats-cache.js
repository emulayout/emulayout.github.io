import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CYANOPHAGE_STAT_KEYS } from './cyanophage-stats.js';
import { writeTextFileIfChanged } from './sync-shared.js';

const CACHE_VERSION = 1;
// Include every runtime dependency of the scorer. Adapted layout/Magic inputs
// are hashed separately, so source-adapter changes invalidate affected entries.
export const CYANOPHAGE_FINGERPRINT_FILES = [
	'bin/cyanophage-stats.js',
	'bin/cyanophage-magic.js',
	'bin/cyanophage-stats-worker.js',
	'bin/layout-features.js',
	'src/lib/cyanophage.ts',
	'bin/cyanophage-data/words-english.json',
	'bin/cyanophage-data/dictionary.json',
	'bin/cyanophage-data/bigram-effort.json'
];

/** @param {string} [root] */
export async function cyanophageAnalyzerFingerprint(root = process.cwd()) {
	const hash = createHash('sha256').update(String(CACHE_VERSION));
	for (const path of CYANOPHAGE_FINGERPRINT_FILES) {
		const body = await readFile(join(root, path));
		hash.update(`\0${path}\0${body.length}\0`).update(body);
	}
	return hash.digest('hex');
}

/** @param {unknown} value @returns {value is number[] | null} */
function validStats(value) {
	return (
		value === null ||
		(Array.isArray(value) &&
			value.length === CYANOPHAGE_STAT_KEYS.length &&
			value.every((stat) => typeof stat === 'number' && Number.isFinite(stat)))
	);
}

/**
 * @param {{ directory?: string, fingerprint: string, force?: boolean }} options
 */
export async function openCyanophageStatsCache({
	directory = '.cache/cyanophage',
	fingerprint,
	force = false
}) {
	const path = join(directory, 'stats-v1.json');
	/** @type {Map<string, number[] | null>} */
	const entries = new Map();
	/** @type {Map<string, Promise<number[] | null>>} */
	const pending = new Map();
	try {
		const stored = JSON.parse(await readFile(path, 'utf-8'));
		if (
			stored?.version === CACHE_VERSION &&
			stored.fingerprint === fingerprint &&
			stored.entries &&
			typeof stored.entries === 'object' &&
			!Array.isArray(stored.entries)
		) {
			for (const [key, stats] of Object.entries(stored.entries)) {
				if (/^[a-f0-9]{64}$/.test(key) && validStats(stats)) entries.set(key, stats);
			}
		}
	} catch (error) {
		if (
			!(error instanceof SyntaxError) &&
			/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT'
		)
			throw error;
	}
	/** @param {{ geometry: string, keys: unknown, magicMappings?: unknown }} input */
	function inputKey(input) {
		return createHash('sha256')
			.update(
				JSON.stringify({
					geometry: input.geometry,
					keys: input.keys,
					magicMappings: input.magicMappings ?? null
				})
			)
			.digest('hex');
	}
	/** @param {string} key @param {number[] | null} stats */
	function store(key, stats) {
		if (!validStats(stats)) throw new Error('Invalid Cyanophage computation result');
		entries.set(key, stats);
		return stats;
	}
	return {
		/**
		 * Hash the exact scorer inputs, preserving key/rule order. Names, owners,
		 * likes and catalog revisions do not affect computation and are excluded.
		 * @param {{ geometry: string, keys: unknown, magicMappings?: unknown }} input
		 * @param {() => number[] | null} compute
		 */
		getOrCompute(input, compute) {
			const key = inputKey(input);
			if (!force && entries.has(key)) return { stats: entries.get(key), cached: true };
			const stats = store(key, compute());
			return { stats, cached: false };
		},
		/**
		 * Share concurrent misses; workers never own or write the persistent cache.
		 * @param {{ geometry: string, keys: unknown, magicMappings?: unknown }} input
		 * @param {() => Promise<number[] | null>} compute
		 */
		async getOrComputeAsync(input, compute) {
			const key = inputKey(input);
			if (!force && entries.has(key)) return { stats: entries.get(key), cached: true };
			const existing = !force && pending.get(key);
			if (existing) return { stats: await existing, cached: true };
			const calculation = Promise.resolve()
				.then(compute)
				.then((stats) => store(key, stats));
			if (!force) pending.set(key, calculation);
			try {
				return { stats: await calculation, cached: false };
			} finally {
				if (!force) pending.delete(key);
			}
		},
		async save() {
			await mkdir(directory, { recursive: true });
			await writeTextFileIfChanged(
				path,
				JSON.stringify({
					version: CACHE_VERSION,
					fingerprint,
					entries: Object.fromEntries([...entries].sort())
				}) + '\n'
			);
		}
	};
}
