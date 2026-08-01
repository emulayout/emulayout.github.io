import { describe, expect, test } from 'bun:test';
import {
	CYANOPHAGE_ANALYZER,
	CYANOPHAGE_UNSUPPORTED_LABEL,
	CMINI_ANALYZER,
	MANA2_ANALYZER
} from '$lib/statsAnalyzers';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_STAT_KEYS,
	MANA2_COMPACT_STAT_FIELD_COUNT,
	type CyanophageStatSortKey,
	type Mana2StatSortKey,
	type StatSortKey
} from '$lib/statsDerivation';
import { buildFocusedMetricSlots, buildLayoutStatsBlockModel } from '$lib/layoutStatsBlockModel';

describe('layout stats block model', () => {
	test('represents loading and unavailable analyzer states', () => {
		const loading = buildLayoutStatsBlockModel(CMINI_ANALYZER, undefined, {
			loading: true
		});
		expect(loading.lines).toBeNull();
		expect(loading.cardMetrics).toBeNull();
		expect(loading.fallback).toContain('LOADING STATS');
		expect(loading.loading).toBe(true);
		expect(loading.mana2).toBe(false);
		expect(loading.fingerDistance).toBeNull();

		const unavailable = buildLayoutStatsBlockModel(CMINI_ANALYZER, []);
		expect(unavailable.lines).toBeNull();
		expect(unavailable.cardMetrics).toBeNull();
		expect(unavailable.fallback).toContain('STATS UNAVAILABLE');
	});

	test('builds focused core metrics without removing detailed lines', () => {
		const cmini = buildLayoutStatsBlockModel(
			CMINI_ANALYZER,
			Array(COMPACT_STAT_FIELD_COUNT).fill(10_000)
		);
		expect(cmini.cardMetrics?.map((metric) => metric.key)).toEqual([
			'sfb',
			'sfs',
			'rollIn',
			'red',
			'alternate'
		]);
		expect(cmini.cardMetrics?.find((metric) => metric.key === 'sfb')?.preferredSortOrder).toBe(
			'asc'
		);
		expect(cmini.cardMetrics?.find((metric) => metric.key === 'rollIn')?.preferredSortOrder).toBe(
			'desc'
		);
		expect(cmini.lines).toHaveLength(14);

		const cyanophage = buildLayoutStatsBlockModel(
			CYANOPHAGE_ANALYZER,
			Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000)
		);
		expect(cyanophage.cardMetrics?.map((metric) => metric.key)).toEqual([
			'sfb',
			'sfs',
			'rollIn',
			'redirect',
			'alternate'
		]);

		const mana2 = buildLayoutStatsBlockModel(
			MANA2_ANALYZER,
			Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000)
		);
		expect(mana2.cardMetrics?.map((metric) => metric.key)).toEqual([
			'sfb',
			'sfs',
			'inroll2',
			'redirect',
			'alt'
		]);
	});

	test('exposes Cyanophage finger-distance chart values and hand shares', () => {
		const compact = Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000);
		compact[CYANOPHAGE_STAT_KEYS.indexOf('distance')] = 100_000;
		const model = buildLayoutStatsBlockModel(CYANOPHAGE_ANALYZER, compact);

		expect(model.fingerDistance).toEqual({
			distance: {
				LI: 1,
				LM: 1,
				LR: 1,
				LP: 1,
				RI: 1,
				RM: 1,
				RR: 1,
				RP: 1,
				LT: 1,
				RT: 1
			},
			leftShare: 0.4,
			rightShare: 0.4,
			total: 10
		});
	});

	test('explains Cyanophage incompatibility without decoding compact stats', () => {
		const model = buildLayoutStatsBlockModel(
			CYANOPHAGE_ANALYZER,
			Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{ cyanophageCompatible: false }
		);

		expect(model.lines).toBeNull();
		expect(model.fallback).toContain(CYANOPHAGE_UNSUPPORTED_LABEL);
	});

	test('builds analyzer lines with card filter and sort highlights', () => {
		const model = buildLayoutStatsBlockModel(
			CMINI_ANALYZER,
			Array(COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{
				highlights: {
					botFilterHighlightKeys: new Set<StatSortKey>(['sfb']),
					cyanophageFilterHighlightKeys: new Set<CyanophageStatSortKey>(),
					mana2FilterHighlightKeys: new Set<Mana2StatSortKey>(),
					botSortHighlightKey: 'alternate',
					cyanophageSortHighlightKey: null,
					mana2SortHighlightKey: null
				},
				sortOrder: 'desc'
			}
		);

		expect(model.lines).not.toBeNull();
		const tones = model.lines?.flat().map((segment) => segment.highlight);
		expect(tones).toContain('cmini');
		expect(tones).toContain('sort');
		expect(model.cardMetrics?.find((metric) => metric.key === 'sfb')?.highlight).toBe('cmini');
		expect(model.cardMetrics?.find((metric) => metric.key === 'alternate')?.highlight).toBe('sort');
	});

	test('fills the empty focused slot with a non-base selected sort metric', () => {
		const highlights = {
			botFilterHighlightKeys: new Set<StatSortKey>(),
			cyanophageFilterHighlightKeys: new Set<CyanophageStatSortKey>(),
			mana2FilterHighlightKeys: new Set<Mana2StatSortKey>(),
			botSortHighlightKey: 'rollOut' as StatSortKey,
			cyanophageSortHighlightKey: null,
			mana2SortHighlightKey: null
		};
		const model = buildLayoutStatsBlockModel(
			CMINI_ANALYZER,
			Array(COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{ highlights, sortOrder: 'desc' }
		);

		expect(model.cardMetrics).toHaveLength(6);
		expect(model.cardMetrics?.at(-1)).toMatchObject({
			analyzer: CMINI_ANALYZER,
			key: 'rollOut',
			label: 'Roll out',
			value: '100.00%',
			preferredSortOrder: 'desc',
			slot: 5,
			highlight: 'sort',
			sortOrder: 'desc'
		});

		highlights.botSortHighlightKey = 'sfb';
		const baseSortModel = buildLayoutStatsBlockModel(
			CMINI_ANALYZER,
			Array(COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{ highlights, sortOrder: 'asc' }
		);
		expect(baseSortModel.cardMetrics).toHaveLength(5);
		expect(baseSortModel.cardMetrics?.find((metric) => metric.key === 'sfb')?.sortOrder).toBe(
			'asc'
		);
	});

	test('formats dynamic analyzer sort values in their native units', () => {
		const cyanophage = buildLayoutStatsBlockModel(
			CYANOPHAGE_ANALYZER,
			Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{
				highlights: {
					botFilterHighlightKeys: new Set<StatSortKey>(),
					cyanophageFilterHighlightKeys: new Set<CyanophageStatSortKey>(),
					mana2FilterHighlightKeys: new Set<Mana2StatSortKey>(),
					botSortHighlightKey: null,
					cyanophageSortHighlightKey: 'distance',
					mana2SortHighlightKey: null
				},
				sortOrder: 'asc'
			}
		);
		expect(cyanophage.cardMetrics?.at(-1)).toMatchObject({
			key: 'distance',
			value: '1.0',
			slot: 5
		});

		const mana2 = buildLayoutStatsBlockModel(
			MANA2_ANALYZER,
			Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{
				highlights: {
					botFilterHighlightKeys: new Set<StatSortKey>(),
					cyanophageFilterHighlightKeys: new Set<CyanophageStatSortKey>(),
					mana2FilterHighlightKeys: new Set<Mana2StatSortKey>(),
					botSortHighlightKey: null,
					cyanophageSortHighlightKey: null,
					mana2SortHighlightKey: 'lsb'
				},
				sortOrder: 'asc'
			}
		);
		expect(mana2.cardMetrics?.at(-1)).toMatchObject({ key: 'lsb', value: '1.000', slot: 5 });
	});

	test('shows a foreign-analyzer sort metric in the visible analyzer empty slot', () => {
		const cmini = buildLayoutStatsBlockModel(
			CMINI_ANALYZER,
			Array(COMPACT_STAT_FIELD_COUNT).fill(10_000)
		);
		const cyanophageSort = buildLayoutStatsBlockModel(
			CYANOPHAGE_ANALYZER,
			Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000),
			{
				highlights: {
					botFilterHighlightKeys: new Set<StatSortKey>(),
					cyanophageFilterHighlightKeys: new Set<CyanophageStatSortKey>(),
					mana2FilterHighlightKeys: new Set<Mana2StatSortKey>(),
					botSortHighlightKey: null,
					cyanophageSortHighlightKey: 'effort',
					mana2SortHighlightKey: null
				},
				sortOrder: 'asc'
			}
		);
		const sortMetric = cyanophageSort.cardMetrics?.find((metric) => metric.key === 'effort');
		if (!sortMetric) throw new Error('Expected Cyanophage effort sort metric');

		const slots = buildFocusedMetricSlots(cmini, sortMetric);
		expect(slots[5]).toMatchObject({
			analyzer: CYANOPHAGE_ANALYZER,
			key: 'effort',
			label: 'Effort',
			value: '1.0',
			highlight: 'sort',
			sortOrder: 'asc'
		});
	});

	test('marks valid Mana2 blocks for taller rendering', () => {
		const model = buildLayoutStatsBlockModel(
			MANA2_ANALYZER,
			Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000)
		);

		expect(model.lines).not.toBeNull();
		expect(model.mana2).toBe(true);
		expect(model.fingerDistance).toBeNull();
	});
});
