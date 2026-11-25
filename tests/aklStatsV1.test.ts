import { afterEach, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
	AKL_STATS_CURRENT_URL,
	ensureAklStatsLayouts,
	parseAklStatsCurrent,
	parseAklStatsLayout
} from '../bin/akl-stats-v1.js';

const testPaths: string[] = [];

afterEach(async () => {
	await Promise.all(testPaths.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

function current() {
	return {
		schema: 'akl.gg/stats/v1/current',
		stats_version: 'stats-1',
		db_seq: 42,
		synced_at: '2026-09-26T00:00:00Z',
		layouts_url: 'https://data.example/layouts/',
		defs: 'https://data.example/defs.json',
		snapshot: { id: 'snapshot-1', url: 'https://data.example/snapshot/' },
		changes: null
	};
}

function layout() {
	return {
		schema: 'akl.gg/stats/v1/layout',
		id: 'layout-1',
		deleted: false,
		stats_version: 'stats-1',
		db_seq: 42,
		layout_rev: 3,
		content_hash: 'hash',
		layout: { name: 'Example', complete: true },
		magic: null,
		cmini: { 'monkeyracer.rowstag.none': { alt: 40 } },
		mana2: { 'monkeyracer.rowstag.none': { tri: { alt: 40 } } }
	};
}

describe('akl.gg stats/v1 cache', () => {
	test('validates current and layout schemas', () => {
		expect(parseAklStatsCurrent(current()).stats_version).toBe('stats-1');
		expect(parseAklStatsLayout(layout()).layout_rev).toBe(3);
		expect(
			parseAklStatsLayout({
				schema: 'akl.gg/stats/v1/layout',
				id: 'deleted',
				deleted: true,
				stats_version: 'stats-1',
				db_seq: 43,
				layout_rev: null
			}).deleted
		).toBe(true);
		expect(() => parseAklStatsCurrent({ ...current(), schema: 'other' })).toThrow(
			'Unexpected akl.gg current schema'
		);
	});

	test('downloads revision-matched objects and reuses them offline', async () => {
		const cacheDir = join(process.cwd(), '.cache', 'tests', crypto.randomUUID());
		testPaths.push(cacheDir);
		const requested: string[] = [];
		const fetchImpl = Object.assign(
			async (input: string | URL | Request) => {
				const url = String(input);
				requested.push(url);
				if (url === AKL_STATS_CURRENT_URL) {
					return new Response(JSON.stringify(current()), { headers: { etag: 'current-1' } });
				}
				if (url === 'https://data.example/layouts/layout-1.json') {
					return new Response(JSON.stringify(layout()));
				}
				return new Response('', { status: 404 });
			},
			{ preconnect: () => undefined }
		) as typeof fetch;

		const online = await ensureAklStatsLayouts(
			[{ id: 'layout-1', name: 'Example', layoutRev: 3 }],
			{ cacheDir, fetchImpl }
		);
		expect(online.objects.get('layout-1')?.layout_rev).toBe(3);
		expect(online.downloaded).toBe(1);
		expect(requested).toEqual([
			AKL_STATS_CURRENT_URL,
			'https://data.example/layouts/layout-1.json'
		]);

		const offline = await ensureAklStatsLayouts(
			[{ id: 'layout-1', name: 'Example', layoutRev: 3 }],
			{ cacheDir, offline: true }
		);
		expect(offline.objects.has('layout-1')).toBe(true);
		expect(offline.downloaded).toBe(0);
	});

	test('does not publish stats from a different layout revision', async () => {
		const cacheDir = join(process.cwd(), '.cache', 'tests', crypto.randomUUID());
		testPaths.push(cacheDir);
		const fetchImpl = Object.assign(
			async (input: string | URL | Request) =>
				new Response(
					JSON.stringify(String(input) === AKL_STATS_CURRENT_URL ? current() : layout())
				),
			{ preconnect: () => undefined }
		) as typeof fetch;

		const result = await ensureAklStatsLayouts(
			[{ id: 'layout-1', name: 'Example', layoutRev: 4 }],
			{ cacheDir, fetchImpl }
		);
		expect(result.objects.size).toBe(0);
		expect(result.missing).toBe(1);
	});

	test('defers cache mutation until commitCache is called and enforces timeout across body reads', async () => {
		const cacheDir = join(process.cwd(), '.cache', 'tests', crypto.randomUUID());
		testPaths.push(cacheDir);
		const fetchV1 = Object.assign(
			async (input: string | URL | Request) =>
				new Response(
					JSON.stringify(String(input) === AKL_STATS_CURRENT_URL ? current() : layout())
				),
			{ preconnect: () => undefined }
		) as typeof fetch;
		await ensureAklStatsLayouts([{ id: 'layout-1', name: 'Example', layoutRev: 3 }], {
			cacheDir,
			fetchImpl: fetchV1
		});

		const fetchV2Partial = Object.assign(
			async (input: string | URL | Request) => {
				if (String(input) === AKL_STATS_CURRENT_URL) {
					return new Response(JSON.stringify({ ...current(), stats_version: 'stats-2' }));
				}
				return new Response('', { status: 500 });
			},
			{ preconnect: () => undefined }
		) as typeof fetch;
		const deferred = await ensureAklStatsLayouts(
			[{ id: 'layout-1', name: 'Example', layoutRev: 3 }],
			{ cacheDir, fetchImpl: fetchV2Partial, deferCacheWrite: true }
		);
		expect(deferred.objects.size).toBe(0);

		// Without calling commitCache(), the cached v1 current and layout remain intact offline.
		const offlineAfterFailedV2 = await ensureAklStatsLayouts(
			[{ id: 'layout-1', name: 'Example', layoutRev: 3 }],
			{ cacheDir, offline: true }
		);
		expect(offlineAfterFailedV2.current.stats_version).toBe('stats-1');
		expect(offlineAfterFailedV2.objects.has('layout-1')).toBe(true);

		const stalledBodyFetch = Object.assign(
			async (_input: string | URL | Request, init?: RequestInit) => {
				const signal = init?.signal;
				const stream = new ReadableStream({
					start(controller) {
						signal?.addEventListener('abort', () => {
							controller.error(new DOMException('Aborted', 'AbortError'));
						});
					}
				});
				return new Response(stream, { status: 200 });
			},
			{ preconnect: () => undefined }
		) as typeof fetch;
		const freshDir = join(process.cwd(), '.cache', 'tests', crypto.randomUUID());
		testPaths.push(freshDir);
		await expect(
			ensureAklStatsLayouts([{ id: 'layout-1', name: 'Example', layoutRev: 3 }], {
				cacheDir: freshDir,
				fetchImpl: stalledBodyFetch,
				timeoutMs: 30
			})
		).rejects.toThrow('Request timed out');
	});
});
