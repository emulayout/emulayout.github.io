import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	ClemenpineCatalogUnavailableError,
	deriveLayoutLikes,
	ensureClemenpineCatalog,
	parseClemenpineAuthors,
	parseClemenpineCatalog,
	parseClemenpineLayouts,
	parseClemenpineMeta
} from '../bin/clemenpine-cache.js';

function layoutRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: '-b-',
		user: '782784290769207336',
		board: 'ortho',
		tag: 'cmini',
		blame: 'cmini',
		modified_at: '2026-08-20T15:43:19Z',
		keys: {
			a: { row: 1, col: 7, finger: 'RM' },
			h: { row: 3, col: 0, finger: 'LT' }
		},
		...overrides
	};
}

function layoutsPayload(records: unknown[]) {
	return { total: records.length, layouts: records };
}

function parseCatalog(
	records: unknown[],
	authors: Record<string, string> = { alpha: '123456789012345678' }
) {
	return parseClemenpineCatalog(layoutsPayload(records), authors);
}

function mockFetch(
	handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): typeof fetch {
	return Object.assign(handler, { preconnect: () => undefined }) as typeof fetch;
}

function metaPayload(layouts: unknown, authors: unknown, overrides: Record<string, unknown> = {}) {
	const layoutCount = Array.isArray((layouts as { layouts?: unknown[] })?.layouts)
		? (layouts as { layouts: unknown[] }).layouts.length
		: 0;
	const authorCount =
		authors && typeof authors === 'object' && !Array.isArray(authors)
			? Object.keys(authors as object).length
			: 0;
	const layoutsModifiedAt = new Date(Date.UTC(2026, 7, 24, 20, 0, layoutCount)).toISOString();
	const authorsModifiedAt = new Date(Date.UTC(2026, 7, 24, 20, 1, authorCount)).toISOString();
	return {
		author_count: authorCount,
		authors_modified_at: authorsModifiedAt,
		layout_count: layoutCount,
		layouts_modified_at: layoutsModifiedAt,
		revision: layoutsModifiedAt > authorsModifiedAt ? layoutsModifiedAt : authorsModifiedAt,
		...overrides
	};
}

function endpointFetch(
	layouts: unknown,
	authors: unknown,
	meta: unknown = metaPayload(layouts, authors)
): typeof fetch {
	return mockFetch(async (input) => {
		const url = String(input);
		if (url.includes('/layoutapi/v3/meta')) return Response.json(meta);
		if (url.includes('/layoutapi/v3/layouts')) return Response.json(layouts);
		if (url.includes('/layoutapi/v3/authors')) return Response.json(authors);
		return new Response('not found', { status: 404 });
	});
}

async function withCacheDirectory(
	run: (paths: {
		directory: string;
		snapshotPath: string;
		legacyLayoutsPath: string;
		legacyAuthorsPath: string;
	}) => Promise<void>
) {
	const directory = await mkdtemp(join(tmpdir(), 'emulayout-clemenpine-'));
	try {
		await run({
			directory,
			snapshotPath: join(directory, 'catalog-v1.json'),
			legacyLayoutsPath: join(directory, 'layouts-full.json'),
			legacyAuthorsPath: join(directory, 'authors.json')
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

describe('parseClemenpineLayouts', () => {
	test('reads full layout records including keys, likes, and modified_at', () => {
		const parsed = parseClemenpineLayouts(layoutsPayload([layoutRecord({ likes: ['1', '2'] })]));
		expect(parsed.skipped).toBe(0);
		expect(parsed.layouts).toEqual([
			{
				name: '-b-',
				user: '782784290769207336',
				board: 'ortho',
				modifiedAt: '2026-08-20T15:43:19Z',
				keys: {
					a: { row: 1, col: 7, finger: 'RM' },
					h: { row: 3, col: 0, finger: 'LT' }
				},
				likes: ['1', '2']
			}
		]);
	});

	test('normalizes numeric ids from a legacy v1 cache', () => {
		const parsed = parseClemenpineLayouts(
			layoutsPayload([layoutRecord({ user: 42, likes: [1, 2] })])
		);
		expect(parsed.layouts[0]?.user).toBe('42');
		expect(parsed.layouts[0]?.likes).toEqual(['1', '2']);
	});

	test('rejects malformed nested keys and unknown boards', () => {
		expect(() =>
			parseClemenpineLayouts(
				layoutsPayload([layoutRecord({ keys: { a: { row_index: 1, col_index: 2 } } })])
			)
		).toThrow('finite numeric row and col');
		expect(() =>
			parseClemenpineLayouts(layoutsPayload([layoutRecord({ board: 'ortholinear' })]))
		).toThrow('recognized board type');
	});

	test('rejects malformed records and duplicate names instead of silently dropping them', () => {
		expect(() =>
			parseClemenpineLayouts(layoutsPayload([layoutRecord(), { name: 'broken' }]))
		).toThrow('user must be a non-negative integer id encoded as a string');
		expect(() =>
			parseClemenpineLayouts(layoutsPayload([layoutRecord(), layoutRecord({ name: '-B-' })]))
		).toThrow('duplicate layout name');
	});

	test('rejects mismatched total and a payload without a layouts array', () => {
		expect(() => parseClemenpineLayouts({ total: 2, layouts: [layoutRecord()] })).toThrow(
			'total must match'
		);
		expect(() => parseClemenpineLayouts([{ name: '-b-' }])).toThrow('layouts array');
	});
});

describe('parseClemenpineAuthors', () => {
	test('keeps exact string ids, accepts legacy numeric ids, and sorts entries', () => {
		expect(parseClemenpineAuthors({ zeta: '9007199254740993', alpha: 1 })).toEqual({
			alpha: '1',
			zeta: '9007199254740993'
		});
	});

	test('rejects invalid entries rather than silently dropping them', () => {
		expect(() => parseClemenpineAuthors({ alpha: '1', bad: 'nope' })).toThrow(
			'non-negative integer id encoded as a string'
		);
		expect(() => parseClemenpineAuthors([{ name: 'alpha' }])).toThrow('name → user id');
	});
});

describe('parseClemenpineMeta', () => {
	test('accepts the versioned change metadata and ignores additive fields', () => {
		const parsed = parseClemenpineMeta(
			metaPayload(layoutsPayload([layoutRecord()]), { alpha: '42' }, { future_field: true })
		);
		expect(parsed.layout_count).toBe(1);
		expect(parsed.author_count).toBe(1);
	});

	test('rejects malformed counts and timestamps', () => {
		expect(() =>
			parseClemenpineMeta(
				metaPayload(layoutsPayload([]), {}, { layout_count: -1, revision: 'not-a-date' })
			)
		).toThrow('layout_count');
		expect(() =>
			parseClemenpineMeta(metaPayload(layoutsPayload([]), {}, { revision: 'not-a-date' }))
		).toThrow('revision');
	});
});

describe('authoritative catalog contents', () => {
	test('accepts structurally valid empty catalogs and arbitrary content replacement', () => {
		expect(parseCatalog([], {})).toEqual({ layouts: { layouts: [], skipped: 0 }, authors: {} });
		expect(
			parseCatalog([layoutRecord({ name: 'replacement', user: '84', new_field: true })], {
				newAuthor: '84'
			}).layouts.layouts[0]?.name
		).toBe('replacement');
	});
});

describe('deriveLayoutLikes', () => {
	test('counts likes arrays and omits layouts without likes', () => {
		const parsed = parseClemenpineLayouts(
			layoutsPayload([
				layoutRecord({ name: 'liked', likes: ['1', '2', '3'] }),
				layoutRecord({ name: 'empty', likes: [] }),
				layoutRecord({ name: 'missing' })
			])
		);
		expect(deriveLayoutLikes(parsed.layouts)).toEqual({ liked: 3 });
	});
});

describe('ensureClemenpineCatalog', () => {
	test('commits layouts and authors together in one snapshot', async () => {
		await withCacheDirectory(async (paths) => {
			const result = await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(layoutsPayload([layoutRecord()]), { alpha: '42' })
			});
			expect(result.updated).toBe(true);
			expect(result.fromCache).toBe(false);
			const snapshot = JSON.parse(await readFile(paths.snapshotPath, 'utf-8'));
			expect(snapshot.layouts.layouts[0].name).toBe('-b-');
			expect(snapshot.authors).toEqual({ alpha: '42' });
			expect(snapshot.meta.layout_count).toBe(1);
		});
	});

	test('uses an unchanged meta revision without downloading layouts or authors', async () => {
		await withCacheDirectory(async (paths) => {
			const layouts = layoutsPayload([layoutRecord()]);
			const authors = { alpha: '42' };
			const meta = metaPayload(layouts, authors);
			await ensureClemenpineCatalog({ ...paths, fetchImpl: endpointFetch(layouts, authors, meta) });

			const requested: string[] = [];
			const fetchImpl = mockFetch(async (input) => {
				const url = String(input);
				requested.push(url);
				if (url.includes('/layoutapi/v3/meta')) return Response.json(meta);
				throw new Error(`Unexpected resource request: ${url}`);
			});
			const result = await ensureClemenpineCatalog({ ...paths, fetchImpl });
			expect(result.updated).toBe(false);
			expect(result.fromCache).toBe(false);
			expect(requested).toHaveLength(1);
			expect(requested[0]).toContain('/layoutapi/v3/meta');
		});
	});

	test('refreshes a legacy endpoint snapshot even when metadata is unchanged', async () => {
		await withCacheDirectory(async (paths) => {
			const layouts = layoutsPayload([layoutRecord()]);
			const authors = { alpha: '42' };
			const meta = metaPayload(layouts, authors);
			await ensureClemenpineCatalog({ ...paths, fetchImpl: endpointFetch(layouts, authors, meta) });

			const snapshot = JSON.parse(await readFile(paths.snapshotPath, 'utf-8'));
			snapshot.layoutsUrl = 'https://clemenpine.com/v1/layouts?full=1';
			snapshot.authorsUrl = 'https://clemenpine.com/v1/authors';
			snapshot.metaUrl = 'https://clemenpine.com/v1/meta';
			await writeFile(paths.snapshotPath, `${JSON.stringify(snapshot)}\n`);

			const requested: string[] = [];
			const fetchImpl = mockFetch(async (input) => {
				requested.push(String(input));
				return endpointFetch(layouts, authors, meta)(input);
			});
			const result = await ensureClemenpineCatalog({ ...paths, fetchImpl });

			expect(result.updated).toBe(true);
			expect(requested.filter((url) => url.includes('/layoutapi/v3/layouts'))).toHaveLength(1);
			expect(requested.filter((url) => url.includes('/layoutapi/v3/authors'))).toHaveLength(1);
			const migrated = JSON.parse(await readFile(paths.snapshotPath, 'utf-8'));
			expect(migrated.layoutsUrl).toContain('/layoutapi/v3/layouts');
			expect(migrated.authorsUrl).toContain('/layoutapi/v3/authors');
			expect(migrated.metaUrl).toContain('/layoutapi/v3/meta');
		});
	});

	test('downloads only the resource whose meta timestamp changed', async () => {
		await withCacheDirectory(async (paths) => {
			const oldLayouts = layoutsPayload([layoutRecord()]);
			const authors = { alpha: '42' };
			const oldMeta = metaPayload(oldLayouts, authors);
			await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(oldLayouts, authors, oldMeta)
			});

			const newLayouts = layoutsPayload([layoutRecord(), layoutRecord({ name: 'second' })]);
			const newMeta = metaPayload(newLayouts, authors);
			const requested: string[] = [];
			const fetchImpl = mockFetch(async (input) => {
				const url = String(input);
				requested.push(url);
				if (url.includes('/layoutapi/v3/meta')) return Response.json(newMeta);
				if (url.includes('/layoutapi/v3/layouts')) return Response.json(newLayouts);
				throw new Error(`Unexpected resource request: ${url}`);
			});
			const result = await ensureClemenpineCatalog({ ...paths, fetchImpl });
			expect(result.updated).toBe(true);
			expect(result.json.layouts.layouts.map((layout) => layout.name)).toEqual(['-b-', 'second']);
			expect(result.json.authors).toEqual(authors);
			expect(requested.filter((url) => url.includes('/layoutapi/v3/meta'))).toHaveLength(2);
			expect(requested.filter((url) => url.includes('/layoutapi/v3/layouts'))).toHaveLength(1);
			expect(requested.some((url) => url.includes('/layoutapi/v3/authors'))).toBe(false);
		});
	});

	test('keeps the snapshot when meta counts disagree with downloaded resources', async () => {
		await withCacheDirectory(async (paths) => {
			const oldLayouts = layoutsPayload([layoutRecord()]);
			const authors = { alpha: '42' };
			await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(oldLayouts, authors)
			});
			const before = await readFile(paths.snapshotPath, 'utf-8');
			const newLayouts = layoutsPayload([layoutRecord(), layoutRecord({ name: 'second' })]);
			const inconsistentMeta = metaPayload(newLayouts, authors, { layout_count: 3 });

			const result = await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(newLayouts, authors, inconsistentMeta)
			});
			expect(result.fromCache).toBe(true);
			expect(result.json.layouts.layouts.map((layout) => layout.name)).toEqual(['-b-']);
			expect(await readFile(paths.snapshotPath, 'utf-8')).toBe(before);
		});
	});

	test('keeps the snapshot when the revision changes during a download', async () => {
		await withCacheDirectory(async (paths) => {
			const oldLayouts = layoutsPayload([layoutRecord()]);
			const authors = { alpha: '42' };
			await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(oldLayouts, authors)
			});
			const before = await readFile(paths.snapshotPath, 'utf-8');
			const newLayouts = layoutsPayload([layoutRecord(), layoutRecord({ name: 'second' })]);
			const downloadingMeta = metaPayload(newLayouts, authors);
			const laterMeta = {
				...downloadingMeta,
				revision: '2026-08-24T22:00:00Z',
				layouts_modified_at: '2026-08-24T22:00:00Z'
			};
			let metaRequests = 0;
			const fetchImpl = mockFetch(async (input) => {
				const url = String(input);
				if (url.includes('/layoutapi/v3/meta')) {
					metaRequests += 1;
					return Response.json(metaRequests === 1 ? downloadingMeta : laterMeta);
				}
				if (url.includes('/layoutapi/v3/layouts')) return Response.json(newLayouts);
				throw new Error(`Unexpected resource request: ${url}`);
			});

			const result = await ensureClemenpineCatalog({ ...paths, fetchImpl });
			expect(result.fromCache).toBe(true);
			expect(await readFile(paths.snapshotPath, 'utf-8')).toBe(before);
		});
	});

	test('falls back to the full endpoints when meta is unavailable', async () => {
		await withCacheDirectory(async (paths) => {
			const layouts = layoutsPayload([layoutRecord()]);
			const authors = { alpha: '42' };
			const requested: string[] = [];
			const fetchImpl = mockFetch(async (input) => {
				const url = String(input);
				requested.push(url);
				if (url.includes('/layoutapi/v3/meta')) return new Response('not found', { status: 404 });
				if (url.includes('/layoutapi/v3/layouts')) return Response.json(layouts);
				if (url.includes('/layoutapi/v3/authors')) return Response.json(authors);
				return new Response('not found', { status: 404 });
			});
			const result = await ensureClemenpineCatalog({ ...paths, fetchImpl });
			expect(result.updated).toBe(true);
			expect(requested.some((url) => url.includes('/layoutapi/v3/layouts'))).toBe(true);
			expect(requested.some((url) => url.includes('/layoutapi/v3/authors'))).toBe(true);
		});
	});

	test('accepts complete deletion because a valid API response is authoritative', async () => {
		await withCacheDirectory(async (paths) => {
			await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(
					layoutsPayload([layoutRecord(), layoutRecord({ name: 'second', user: '84' })]),
					{ alpha: '42', beta: '84' }
				)
			});

			const result = await ensureClemenpineCatalog({
				...paths,
				fetchImpl: endpointFetch(layoutsPayload([]), {})
			});
			expect(result.updated).toBe(true);
			expect(result.fromCache).toBe(false);
			expect(result.json).toEqual({ layouts: { layouts: [], skipped: 0 }, authors: {} });
			const snapshot = JSON.parse(await readFile(paths.snapshotPath, 'utf-8'));
			expect(snapshot.layouts.layouts).toEqual([]);
			expect(snapshot.authors).toEqual({});
		});
	});

	test('keeps the complete snapshot when only one endpoint succeeds', async () => {
		await withCacheDirectory(async (paths) => {
			const common = { ...paths };
			await ensureClemenpineCatalog({
				...common,
				fetchImpl: endpointFetch(layoutsPayload([layoutRecord()]), { alpha: '42' })
			});
			const before = await readFile(paths.snapshotPath, 'utf-8');
			const fetchImpl = mockFetch(async (input) => {
				if (String(input).includes('/layoutapi/v3/layouts')) {
					return Response.json(
						layoutsPayload([layoutRecord(), layoutRecord({ name: 'new-layout' })])
					);
				}
				return new Response('not found', { status: 404, statusText: 'Not Found' });
			});

			const result = await ensureClemenpineCatalog({ ...common, fetchImpl });
			expect(result.fromCache).toBe(true);
			expect(result.json.layouts.layouts.map((layout) => layout.name)).toEqual(['-b-']);
			expect(await readFile(paths.snapshotPath, 'utf-8')).toBe(before);
		});
	});

	test('keeps the snapshot when downloaded JSON or schema is invalid', async () => {
		await withCacheDirectory(async (paths) => {
			const common = { ...paths };
			await ensureClemenpineCatalog({
				...common,
				fetchImpl: endpointFetch(layoutsPayload([layoutRecord()]), { alpha: '42' })
			});
			const before = await readFile(paths.snapshotPath, 'utf-8');
			const fetchImpl = mockFetch(async (input) =>
				String(input).includes('/layoutapi/v3/layouts')
					? new Response('{"layouts":', { status: 200 })
					: Response.json({ alpha: '42' })
			);
			const result = await ensureClemenpineCatalog({ ...common, fetchImpl });
			expect(result.fromCache).toBe(true);
			expect(await readFile(paths.snapshotPath, 'utf-8')).toBe(before);
		});
	});

	test('times out a stalled request and reuses the snapshot', async () => {
		await withCacheDirectory(async (paths) => {
			const common = { ...paths };
			await ensureClemenpineCatalog({
				...common,
				fetchImpl: endpointFetch(layoutsPayload([layoutRecord()]), { alpha: '42' })
			});
			const stalledFetch = mockFetch(
				async (_input, init) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted')));
					})
			);
			const result = await ensureClemenpineCatalog({
				...common,
				fetchImpl: stalledFetch,
				timeoutMs: 5
			});
			expect(result.fromCache).toBe(true);
			expect(result.json.authors).toEqual({ alpha: '42' });
		});
	});

	test('throws a dedicated error when no cache or endpoint is available', async () => {
		await withCacheDirectory(async (paths) => {
			const fetchImpl = mockFetch(async () => {
				throw new Error('network down');
			});
			await expect(
				ensureClemenpineCatalog({
					...paths,
					fetchImpl
				})
			).rejects.toBeInstanceOf(ClemenpineCatalogUnavailableError);
		});
	});
});
