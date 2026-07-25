import { describe, expect, test } from 'bun:test';
import { CYANOPHAGE_ANALYZER, DEFAULT_STATS_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import {
	coerceSortByForAnalyzer,
	getDefaultSortOrder,
	getStatSortAnalyzer,
	getStatSortField,
	getStatSortFieldsForAnalyzer,
	isHigherBetterStatKey,
	isSortBy,
	isSortOrder,
	isStatSortBy,
	normalizeSortBy,
	parseLegacySortParam
} from '$lib/statsSorting';

describe('stats sorting catalog and normalization', () => {
	test('resolves analyzer-owned fields and layout/stat sort types', () => {
		expect(getStatSortAnalyzer('alternate')).toBe(DEFAULT_STATS_ANALYZER);
		expect(getStatSortAnalyzer('cyano-effort')).toBe(CYANOPHAGE_ANALYZER);
		expect(getStatSortAnalyzer('mana-roll')).toBe(MANA2_ANALYZER);
		expect(getStatSortField('cyano-effort', DEFAULT_STATS_ANALYZER)).toBeUndefined();
		expect(
			getStatSortFieldsForAnalyzer(MANA2_ANALYZER).every(
				(field) => field.analyzer === MANA2_ANALYZER
			)
		).toBe(true);
		expect(isSortBy('similarity')).toBe(true);
		expect(isSortBy('unknown')).toBe(false);
		expect(isStatSortBy('mana-roll')).toBe(true);
		expect(isStatSortBy('date')).toBe(false);
	});

	test('uses explicit defaults for layout and analyzer fields', () => {
		expect(getDefaultSortOrder('name')).toBe('asc');
		expect(getDefaultSortOrder('date')).toBe('desc');
		expect(getDefaultSortOrder('alternate')).toBe('desc');
		expect(getDefaultSortOrder('sfb')).toBe('asc');
		expect(getDefaultSortOrder('mana-alt')).toBe('desc');
		expect(isSortOrder('asc')).toBe(true);
		expect(isSortOrder('desc')).toBe(true);
		expect(isSortOrder('sideways')).toBe(false);
	});

	test('normalizes aliases and analyzer-disambiguated SFB fields', () => {
		expect(normalizeSortBy('sfb', DEFAULT_STATS_ANALYZER)).toBe('sfb');
		expect(normalizeSortBy('sfb', CYANOPHAGE_ANALYZER)).toBe('cyano-sfb');
		expect(normalizeSortBy('sfb', MANA2_ANALYZER)).toBe('mana-sfb');
		expect(normalizeSortBy('total-word-effort')).toBe('cyano-total-word-effort');
		expect(normalizeSortBy('sfs')).toBe('cyano-sfs');
		expect(normalizeSortBy('unknown')).toBeUndefined();
	});

	test('preserves legacy combined sort parameters', () => {
		expect(parseLegacySortParam('rtl-desc')).toEqual({
			sortBy: 'roll-total',
			sortOrder: 'desc'
		});
		expect(parseLegacySortParam('red-asc')).toEqual({
			sortBy: 'redirect',
			sortOrder: 'asc'
		});
		expect(parseLegacySortParam('unknown')).toBeUndefined();
		expect(normalizeSortBy('dsfb-alt-asc')).toBe('same-finger-skip-alternate');
	});

	test('coerces equivalent analyzer fields and exposes comparison direction', () => {
		expect(coerceSortByForAnalyzer('sfb', CYANOPHAGE_ANALYZER)).toBe('cyano-sfb');
		expect(coerceSortByForAnalyzer('cyano-sfb', MANA2_ANALYZER)).toBe('mana-sfb');
		expect(coerceSortByForAnalyzer('cyano-effort', DEFAULT_STATS_ANALYZER)).toBeNull();
		expect(coerceSortByForAnalyzer('date', MANA2_ANALYZER)).toBe('date');
		expect(isHigherBetterStatKey('roll', DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(isHigherBetterStatKey('sfb', DEFAULT_STATS_ANALYZER)).toBe(false);
		expect(isHigherBetterStatKey('lh', MANA2_ANALYZER)).toBeNull();
	});
});
