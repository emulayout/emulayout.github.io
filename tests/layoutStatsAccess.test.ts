import { describe, expect, test } from 'bun:test';
import type { LayoutData, StatsMaps } from '$lib/layout';
import {
	getLayoutAnalyzerStats,
	getLayoutCyanophageStats,
	getLayoutMana2Stats,
	getStatSortValue,
	isAnalyzerStatsReady
} from '$lib/layoutStatsAccess';
import { CMINI_ANALYZER, CYANOPHAGE_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	MANA2_COMPACT_STAT_FIELD_COUNT
} from '$lib/statsDerivation';

const layout = {
	name: 'Example',
	cyanophageCompatible: true
} as LayoutData;

const statsMaps: StatsMaps = {
	cmini: {
		Example: Array(COMPACT_STAT_FIELD_COUNT).fill(10_000)
	},
	cyanophage: {
		Example: Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000)
	},
	mana2: {
		Example: Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000)
	}
};

describe('layout stats access', () => {
	test('decodes each analyzer map through its frontend schema', () => {
		expect(getLayoutAnalyzerStats(statsMaps, layout.name)?.alternate).toBe(1);
		expect(getLayoutCyanophageStats(statsMaps, layout.name)?.['total-word-effort']).toBe(1);
		expect(getLayoutMana2Stats(statsMaps, layout.name)?.sfb).toBe(0.01);
	});

	test('respects Cyanophage compatibility before exposing its stats', () => {
		expect(
			getLayoutAnalyzerStats(statsMaps, layout.name, CYANOPHAGE_ANALYZER, false)
		).toBeUndefined();
		expect(getLayoutAnalyzerStats(statsMaps, layout.name, CYANOPHAGE_ANALYZER, true)).toBeDefined();
	});

	test('treats an empty loaded map as ready and an absent map as pending', () => {
		expect(isAnalyzerStatsReady({ cmini: {} }, CMINI_ANALYZER)).toBe(true);
		expect(isAnalyzerStatsReady({ cmini: {} }, MANA2_ANALYZER)).toBe(false);
	});

	test('resolves analyzer-owned sort values and rejects mismatched access', () => {
		expect(getStatSortValue(statsMaps, layout, 'alternate')).toBe(1);
		expect(getStatSortValue(statsMaps, layout, 'cyano-effort')).toBe(1);
		expect(getStatSortValue(statsMaps, layout, 'cyano-distance')).toBe(1);
		expect(getStatSortValue(statsMaps, layout, 'mana-lsb')).toBe(1);
		expect(getStatSortValue(statsMaps, layout, 'cyano-effort', CMINI_ANALYZER)).toBeNull();
		expect(
			getStatSortValue(statsMaps, { ...layout, cyanophageCompatible: false }, 'cyano-effort')
		).toBeNull();
	});
});
