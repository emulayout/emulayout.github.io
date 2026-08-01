import { describe, expect, test } from 'bun:test';
import { CYANOPHAGE_ANALYZER, CMINI_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import { CMINI_STAT_FILTER_CATALOG } from '$lib/statFilters/cmini';
import { CYANOPHAGE_STAT_FILTER_CATALOG } from '$lib/statFilters/cyanophage';
import { MANA2_STAT_FILTER_CATALOG } from '$lib/statFilters/mana2';
import { createEmptyStatLimits } from '$lib/filterSnapshot';
import {
	ALL_STAT_FILTER_FIELDS,
	GENERAL_STAT_FILTER_COLUMN_COUNT,
	LIKES_STAT_FILTER_FIELD,
	getFingerUsageStatFilterFieldsForAnalyzer,
	getGeneralStatFilterGroupsForAnalyzer,
	getHandStatFilterFieldsForAnalyzer,
	getHandUsageStatFilterFieldsForAnalyzer,
	getLeftHandStatFilterFieldsForAnalyzer,
	getLeftFingerUsageStatFilterFieldsForAnalyzer,
	getRightHandStatFilterFieldsForAnalyzer,
	getRightFingerUsageStatFilterFieldsForAnalyzer,
	getStatFilterCatalogForAnalyzer,
	getStatFilterFieldsForAnalyzer,
	getStatFilterStatKey,
	getStatMetricFilterTarget,
	hasActiveStatFilterSection,
	parseStatFilterThreshold
} from '$lib/statsFiltering';

function field(key: string) {
	const result = ALL_STAT_FILTER_FIELDS.find((entry) => entry.key === key);
	if (!result) throw new Error(`Expected stat filter field: ${key}`);
	return result;
}

describe('stats filtering catalog', () => {
	test('keeps one canonical field per persisted filter key', () => {
		const keys = ALL_STAT_FILTER_FIELDS.map(({ key }) => key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys).toContain(LIKES_STAT_FILTER_FIELD.key);
		expect(keys).toContain('cyano-sfb');
		expect(keys).toContain('cyano-distance');
		expect(keys).toContain('mana-sfb');
	});

	test('provides stable analyzer-specific general and hand catalogs', () => {
		expect(getStatFilterCatalogForAnalyzer(CMINI_ANALYZER)).toBe(CMINI_STAT_FILTER_CATALOG);
		expect(getStatFilterCatalogForAnalyzer(CYANOPHAGE_ANALYZER)).toBe(
			CYANOPHAGE_STAT_FILTER_CATALOG
		);
		expect(getStatFilterCatalogForAnalyzer(MANA2_ANALYZER)).toBe(MANA2_STAT_FILTER_CATALOG);

		const analyzers = [CMINI_ANALYZER, CYANOPHAGE_ANALYZER, MANA2_ANALYZER] as const;
		for (const analyzer of analyzers) {
			const groups = getGeneralStatFilterGroupsForAnalyzer(analyzer);
			expect(groups.length).toBeGreaterThan(0);
			expect(
				groups.every((group) =>
					group.rows.every((row) => row.length <= GENERAL_STAT_FILTER_COLUMN_COUNT)
				)
			).toBe(true);
			expect(getLeftHandStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(6);
			expect(getRightHandStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(6);
			expect(getHandStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(12);
			expect(getHandUsageStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(2);
			expect(getLeftFingerUsageStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(5);
			expect(getRightFingerUsageStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(5);
			expect(getFingerUsageStatFilterFieldsForAnalyzer(analyzer)).toHaveLength(10);
			expect(getStatFilterFieldsForAnalyzer(analyzer)).toBe(
				getStatFilterFieldsForAnalyzer(analyzer)
			);
		}
	});

	test('maps prefixed storage keys to their derived analyzer properties', () => {
		expect(getStatFilterStatKey(field('sfb'))).toBe('sfb');
		expect(getStatFilterStatKey(field('cyano-sfb'))).toBe('sfb');
		expect(getStatFilterStatKey(field('cyano-roll-in'))).toBe('rollIn');
		expect(getStatFilterStatKey(field('mana-sfb'))).toBe('sfb');
		expect(getStatFilterStatKey(field('cyano-LI'))).toBe('LI');
		expect(getStatFilterStatKey(field('mana-LI'))).toBe('LI');
		expect(getStatFilterStatKey(LIKES_STAT_FILTER_FIELD)).toBe('likes');
	});

	test('routes displayed metrics to analyzer-specific filter controls', () => {
		expect(getStatMetricFilterTarget(CMINI_ANALYZER, 'sfb')).toEqual({
			section: 'general',
			key: 'sfb'
		});
		expect(getStatMetricFilterTarget(CYANOPHAGE_ANALYZER, 'sfb')).toEqual({
			section: 'general',
			key: 'cyano-sfb'
		});
		expect(getStatMetricFilterTarget(CYANOPHAGE_ANALYZER, 'rollIn')).toEqual({
			section: 'general',
			key: 'cyano-roll-in'
		});
		expect(getStatMetricFilterTarget(CYANOPHAGE_ANALYZER, 'redirect')).toEqual({
			section: 'general',
			key: 'cyano-redirect'
		});
		expect(getStatMetricFilterTarget(MANA2_ANALYZER, 'LI')).toEqual({
			section: 'finger-usage',
			key: 'mana-LI'
		});
		expect(getStatMetricFilterTarget(MANA2_ANALYZER, 'lh')).toEqual({
			section: 'hand-usage',
			key: 'mana-lh'
		});
	});

	test('parses percent fields as fractions and preserves raw units', () => {
		expect(parseStatFilterThreshold(field('sfb'), '2.5')).toBeCloseTo(0.025);
		expect(parseStatFilterThreshold(field('cyano-sfb'), '1.25')).toBeCloseTo(0.0125);
		expect(parseStatFilterThreshold(field('totalWordEffort'), '42.5')).toBe(42.5);
		expect(parseStatFilterThreshold(field('cyano-distance'), '321.5')).toBe(321.5);
		expect(parseStatFilterThreshold(field('mana-lsb'), '1.234')).toBe(1.234);
		expect(parseStatFilterThreshold(LIKES_STAT_FILTER_FIELD, '100')).toBe(100);
		expect(parseStatFilterThreshold(field('sfb'), ' ')).toBeNull();
		expect(parseStatFilterThreshold(field('sfb'), 'not-a-number')).toBeNull();
	});

	test('detects active analyzer sections without constructing summaries', () => {
		const limits = createEmptyStatLimits();
		limits['cyano-sfb'].value = '1.25';

		expect(hasActiveStatFilterSection(limits, CYANOPHAGE_ANALYZER, 'general')).toBe(true);
		expect(hasActiveStatFilterSection(limits, CMINI_ANALYZER, 'general')).toBe(false);

		limits['mana-LI'].value = '10';
		expect(hasActiveStatFilterSection(limits, MANA2_ANALYZER, 'finger-usage')).toBe(true);
		expect(hasActiveStatFilterSection(limits, MANA2_ANALYZER, 'hand-usage')).toBe(false);
		expect(hasActiveStatFilterSection(limits, CYANOPHAGE_ANALYZER, 'finger-usage')).toBe(false);

		limits['mana-lh'].value = '45';
		expect(hasActiveStatFilterSection(limits, MANA2_ANALYZER, 'hand-usage')).toBe(true);
	});

	test('attributes the optional likes filter only to cmini', () => {
		const limits = createEmptyStatLimits();
		limits.likes.value = '10';

		expect(
			hasActiveStatFilterSection(limits, CMINI_ANALYZER, 'general', { includeLikes: true })
		).toBe(true);
		expect(
			hasActiveStatFilterSection(limits, CYANOPHAGE_ANALYZER, 'general', { includeLikes: true })
		).toBe(false);
		expect(hasActiveStatFilterSection(limits, CMINI_ANALYZER, 'general')).toBe(false);
	});
});
