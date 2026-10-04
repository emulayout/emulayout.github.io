import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	AKLDB_AUTHORS_URL,
	AKLDB_LAYOUTS_URL,
	AKLDB_MANA_LAYOUTS_URL,
	AKLDB_META_URL,
	AkldbCatalogUnavailableError,
	ensureAkldbCatalog,
	parseAkldbCatalog,
	parseAkldbMeta
} from '../bin/akldb-cache.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

function sparkLayout(overrides: Record<string, unknown> = {}) {
	return {
		id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
		name: 'example',
		owner: '9007199254740993',
		layout_rev: 1,
		created_at: '2026-09-01T00:00:00Z',
		modified_at: '2026-09-01T00:00:00Z',
		format: 'spark/1',
		formats: {
			'spark/1': {
				rev: 2,
				modified_at: '2026-09-02T00:00:00Z'
			}
		},
		payload: {
			keys: [
				{ char: 'a', row: 0, col: 0, finger: 'LP' },
				{ row: 0, col: 1, finger: 'LR' }
			]
		},
		likes: ['9007199254740995'],
		like_count: 1,
		link: null,
		...overrides
	};
}

function manaLayout(overrides: Record<string, unknown> = {}) {
	return {
		id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
		name: 'example',
		payload: { magic: { rules: [] } },
		...overrides
	};
}

function meta(overrides: Record<string, unknown> = {}) {
	return {
		layout_count: 1,
		author_count: 1,
		seq: 12,
		revision: '2026-09-02T00:00:00Z',
		layouts_modified_at: '2026-09-02T00:00:00Z',
		authors_modified_at: '2026-09-02T00:00:00Z',
		formats: ['spark/1', 'mana2/1'],
		api: { major: 1, minor: 14 },
		...overrides
	};
}

describe('AKLDB parsing', () => {
	test('preserves number rows in source while projecting supported catalog rows', () => {
		const keys = [
			{ char: '1', row: -1, col: 0, finger: 'LP' },
			{ char: 'a', row: 0, col: 0, finger: 'LP' },
			{ row: 0, col: 1, finger: 'LR' },
			{ char: 'e', row: 4, col: 0, finger: 'LT' },
			{ char: 'z', row: 5, col: 0, finger: 'LP' }
		];
		const parsed = parseAkldbCatalog(
			{ items: [sparkLayout({ payload: { keys } })] },
			{ items: [manaLayout()] },
			{ author: '9007199254740993' }
		).layouts.layouts[0];
		expect(parsed.keys).toEqual(keys);
		// Exercise the build-script boundary without importing untyped build modules into tsc.
		const result = Bun.spawnSync([
			process.execPath,
			'-e',
			`
			import { transformLayout } from './bin/layout-transformer.js';
			import { encodeLayout } from './bin/layout-codec.js';
			const projected = transformLayout({ positions: ${JSON.stringify(parsed.keys)} });
			console.log(JSON.stringify({ chars: Object.keys(projected.keys), rows: encodeLayout(projected)[6] }));
		`
		]);
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout.toString())).toEqual({ chars: ['a', 'e'], rows: [0, 0, 4] });
		expect(parsed.keys).toEqual(keys);
	});

	test('preserves exact ids, ordered positions, free positions, and format timestamps', () => {
		const parsed = parseAkldbCatalog(
			{ items: [sparkLayout()] },
			{ items: [manaLayout()] },
			{ author: '9007199254740993' }
		);
		expect(parsed.layouts.layouts[0]).toMatchObject({
			owner: '9007199254740993',
			formatModifiedAt: '2026-09-02T00:00:00Z',
			keys: [
				{ char: 'a', row: 0, col: 0, finger: 'LP' },
				{ row: 0, col: 1, finger: 'LR' }
			],
			likes: ['9007199254740995']
		});
	});

	test('rejects mismatched projections and unsafe numeric ids', () => {
		expect(() =>
			parseAkldbCatalog({ items: [sparkLayout()] }, { items: [] }, { author: '1' })
		).toThrow('absent from the Mana2 projection');
		expect(() =>
			parseAkldbCatalog(
				{ items: [sparkLayout()] },
				{ items: [manaLayout({ name: 'other' })] },
				{ author: '1' }
			)
		).toThrow('disagrees with the Mana2 layout name');
		expect(() =>
			parseAkldbCatalog(
				{ items: [sparkLayout({ owner: 9007199254740992 })] },
				{ items: [manaLayout()] },
				{ author: '1' }
			)
		).toThrow('decimal string');
	});

	test('rejects unsupported API majors and missing Spark', () => {
		expect(() => parseAkldbMeta(meta({ api: { major: 2, minor: 0 } }))).toThrow(
			'Unsupported AKLDB API version'
		);
		expect(() => parseAkldbMeta(meta({ formats: ['mana2/1'] }))).toThrow('required format');
		expect(() => parseAkldbMeta(meta({ formats: ['spark/1'] }))).toThrow('required format');
	});
});

describe('AKLDB cache', () => {
	test('writes and reuses one coordinated snapshot', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'emulayout-akldb-'));
		temporaryDirectories.push(directory);
		const snapshotPath = join(directory, 'catalog.json');
		const bodies = new Map<string, unknown>([
			[AKLDB_META_URL, meta()],
			[
				AKLDB_LAYOUTS_URL,
				{
					items: [
						sparkLayout({
							payload: {
								keys: [
									{ char: '1', row: -1, col: 0, finger: 'LP' },
									{ char: 'a', row: 0, col: 0, finger: 'LP' }
								]
							}
						})
					]
				}
			],
			[AKLDB_MANA_LAYOUTS_URL, { items: [manaLayout()] }],
			[AKLDB_AUTHORS_URL, { author: '9007199254740993' }]
		]);
		const fetchImpl = (async (url: string | URL | Request) =>
			new Response(JSON.stringify(bodies.get(String(url))), { status: 200 })) as typeof fetch;

		const downloaded = await ensureAkldbCatalog({ snapshotPath, fetchImpl });
		expect(downloaded.updated).toBe(true);
		expect(downloaded.json.layouts.layouts).toHaveLength(1);

		const offline = await ensureAkldbCatalog({ snapshotPath, offline: true });
		expect(offline.fromCache).toBe(true);
		expect(offline.json.layouts.layouts[0].keys[0].row).toBe(-1);
		expect(offline.json.authors).toEqual({ author: '9007199254740993' });
	});

	test('fails offline without a last-good snapshot', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'emulayout-akldb-'));
		temporaryDirectories.push(directory);
		await expect(
			ensureAkldbCatalog({ snapshotPath: join(directory, 'missing.json'), offline: true })
		).rejects.toBeInstanceOf(AkldbCatalogUnavailableError);
	});
});

test('catalog preserves unsupported raw deletion rules and extension fields as Spark content', () => {
	const payload = {
		keys: [],
		future: { value: 1 },
		magic: { rules: [{ inputs: 'ab', output: '' }] }
	};
	const parsed = parseAkldbCatalog(
		{ items: [sparkLayout({ payload })] },
		{ items: [manaLayout()] },
		{}
	);
	expect(parsed.layouts.layouts[0].spark).toEqual(payload);
});
