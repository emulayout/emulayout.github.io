import { describe, expect, test } from 'bun:test';
import { CYANOPHAGE_ANALYZER, DEFAULT_STATS_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import {
	ALL_STAT_FILTER_FIELDS,
	GENERAL_STAT_FILTER_COLUMN_COUNT,
	LIKES_STAT_FILTER_FIELD,
	getGeneralStatFilterGroupsForAnalyzer,
	getHandStatFilterFieldsForAnalyzer,
	getLeftHandStatFilterFieldsForAnalyzer,
	getRightHandStatFilterFieldsForAnalyzer,
	getStatFilterFieldsForAnalyzer,
	getStatFilterStatKey,
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
		expect(keys).toContain('mana-sfb');
	});

	test('provides stable analyzer-specific general and hand catalogs', () => {
		const analyzers = [DEFAULT_STATS_ANALYZER, CYANOPHAGE_ANALYZER, MANA2_ANALYZER] as const;
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
			expect(getStatFilterFieldsForAnalyzer(analyzer)).toBe(
				getStatFilterFieldsForAnalyzer(analyzer)
			);
		}
	});

	test('maps prefixed storage keys to their derived analyzer properties', () => {
		expect(getStatFilterStatKey(field('sfb'))).toBe('sfb');
		expect(getStatFilterStatKey(field('cyano-sfb'))).toBe('sfb');
		expect(getStatFilterStatKey(field('mana-sfb'))).toBe('sfb');
		expect(getStatFilterStatKey(field('cyano-LI'))).toBe('LI');
		expect(getStatFilterStatKey(field('mana-LI'))).toBe('LI');
		expect(getStatFilterStatKey(LIKES_STAT_FILTER_FIELD)).toBe('likes');
	});

	test('parses percent fields as fractions and preserves raw units', () => {
		expect(parseStatFilterThreshold(field('sfb'), '2.5')).toBeCloseTo(0.025);
		expect(parseStatFilterThreshold(field('cyano-sfb'), '1.25')).toBeCloseTo(0.0125);
		expect(parseStatFilterThreshold(field('totalWordEffort'), '42.5')).toBe(42.5);
		expect(parseStatFilterThreshold(field('mana-lsb'), '1.234')).toBe(1.234);
		expect(parseStatFilterThreshold(LIKES_STAT_FILTER_FIELD, '100')).toBe(100);
		expect(parseStatFilterThreshold(field('sfb'), ' ')).toBeNull();
		expect(parseStatFilterThreshold(field('sfb'), 'not-a-number')).toBeNull();
	});
});
