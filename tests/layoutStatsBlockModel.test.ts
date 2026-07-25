import { describe, expect, test } from 'bun:test';
import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
import { CYANOPHAGE_ANALYZER, DEFAULT_STATS_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	MANA2_COMPACT_STAT_FIELD_COUNT,
	type CyanophageStatSortKey,
	type Mana2StatSortKey,
	type StatSortKey
} from '$lib/statsDerivation';
import { buildLayoutStatsBlockModel } from '$lib/layoutStatsBlockModel';

describe('layout stats block model', () => {
	test('represents loading and unavailable analyzer states', () => {
		const loading = buildLayoutStatsBlockModel(DEFAULT_STATS_ANALYZER, undefined, {
			loading: true
		});
		expect(loading.lines).toBeNull();
		expect(loading.fallback).toContain('LOADING STATS');
		expect(loading.loading).toBe(true);
		expect(loading.mana2).toBe(false);

		const unavailable = buildLayoutStatsBlockModel(DEFAULT_STATS_ANALYZER, []);
		expect(unavailable.lines).toBeNull();
		expect(unavailable.fallback).toContain('STATS UNAVAILABLE');
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
			DEFAULT_STATS_ANALYZER,
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
	});

	test('marks valid Mana2 blocks for taller rendering', () => {
		const model = buildLayoutStatsBlockModel(
			MANA2_ANALYZER,
			Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000)
		);

		expect(model.lines).not.toBeNull();
		expect(model.mana2).toBe(true);
	});
});
