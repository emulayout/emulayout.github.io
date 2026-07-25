import { describe, expect, test } from 'bun:test';
import { matchesSimilarityPercentFilter } from '$lib/layoutSimilarity';

describe('matchesSimilarityPercentFilter', () => {
	test('uses strict greater-than semantics', () => {
		expect(matchesSimilarityPercentFilter(51, 'gt', '50')).toBe(true);
		expect(matchesSimilarityPercentFilter(50, 'gt', '50')).toBe(false);
		expect(matchesSimilarityPercentFilter(49, 'gt', '50')).toBe(false);
	});

	test('uses strict less-than semantics', () => {
		expect(matchesSimilarityPercentFilter(49, 'lt', '50')).toBe(true);
		expect(matchesSimilarityPercentFilter(50, 'lt', '50')).toBe(false);
		expect(matchesSimilarityPercentFilter(51, 'lt', '50')).toBe(false);
	});

	test('disables the filter for empty or invalid thresholds', () => {
		expect(matchesSimilarityPercentFilter(50, 'gt', '')).toBe(true);
		expect(matchesSimilarityPercentFilter(50, 'gt', 'not-a-number')).toBe(true);
	});
});
