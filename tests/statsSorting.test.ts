import { describe, expect, test } from 'bun:test';
import { CYANOPHAGE_ANALYZER, CMINI_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
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
	normalizeSortBy
} from '$lib/statsSorting';

describe('stats sorting catalog and normalization', () => {
	test('resolves analyzer-owned fields and layout/stat sort types', () => {
		expect(getStatSortAnalyzer('alternate')).toBe(CMINI_ANALYZER);
		expect(getStatSortAnalyzer('cyano-effort')).toBe(CYANOPHAGE_ANALYZER);
		expect(getStatSortAnalyzer('cyano-roll-in')).toBe(CYANOPHAGE_ANALYZER);
		expect(getStatSortAnalyzer('mana-roll')).toBe(MANA2_ANALYZER);
		expect(getStatSortAnalyzer('mana-roll-in')).toBe(MANA2_ANALYZER);
		expect(getStatSortField('cyano-effort', CMINI_ANALYZER)).toBeUndefined();
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

	test('accepts canonical sort values and rejects obsolete aliases', () => {
		expect(normalizeSortBy('sfb')).toBe('sfb');
		expect(normalizeSortBy('cyano-sfb')).toBe('cyano-sfb');
		expect(normalizeSortBy('cyano-redirect')).toBe('cyano-redirect');
		expect(normalizeSortBy('mana-sfb')).toBe('mana-sfb');
		expect(normalizeSortBy('mana-roll-in')).toBe('mana-roll-in');
		expect(normalizeSortBy('total-word-effort')).toBeUndefined();
		expect(normalizeSortBy('sfs')).toBeUndefined();
		expect(normalizeSortBy('rtl-desc')).toBeUndefined();
		expect(normalizeSortBy('dsfb-alt-asc')).toBeUndefined();
		expect(normalizeSortBy('unknown')).toBeUndefined();
	});

	test('coerces equivalent analyzer fields and exposes comparison direction', () => {
		expect(coerceSortByForAnalyzer('sfb', CYANOPHAGE_ANALYZER)).toBe('cyano-sfb');
		expect(coerceSortByForAnalyzer('cyano-sfb', MANA2_ANALYZER)).toBe('mana-sfb');
		expect(coerceSortByForAnalyzer('cyano-effort', CMINI_ANALYZER)).toBeNull();
		expect(coerceSortByForAnalyzer('date', MANA2_ANALYZER)).toBe('date');
		expect(isHigherBetterStatKey('roll', CMINI_ANALYZER)).toBe(true);
		expect(isHigherBetterStatKey('sfb', CMINI_ANALYZER)).toBe(false);
		expect(isHigherBetterStatKey('lh', MANA2_ANALYZER)).toBeNull();
	});
});
