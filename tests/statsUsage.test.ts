import { describe, expect, test } from 'bun:test';
import { createEmptyStatLimits } from '$lib/filterSnapshot';
import { CMINI_ANALYZER, CYANOPHAGE_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import {
	analyzersNeededForLimits,
	analyzersNeededForLoad,
	countActiveStatFiltersForAnalyzer,
	getActiveFilterStatKeys,
	getHiddenAnalyzerFilterCaution,
	getStatCardHighlightState
} from '$lib/statsUsage';

function limitsWith(
	entries: Array<[key: keyof ReturnType<typeof createEmptyStatLimits>, value: string]>
) {
	const limits = createEmptyStatLimits();
	for (const [key, value] of entries) {
		limits[key] = { operator: 'lt', value };
	}
	return limits;
}

describe('stats analyzer usage', () => {
	test('maps active persisted filter keys to analyzer-owned derived keys', () => {
		const limits = limitsWith([
			['sfb', '2'],
			['cyano-sfb', '3'],
			['mana-lsb', '4'],
			['likes', '10']
		]);

		expect([...getActiveFilterStatKeys(limits, CMINI_ANALYZER)]).toEqual(['sfb']);
		expect([...getActiveFilterStatKeys(limits, CYANOPHAGE_ANALYZER)]).toEqual(['sfb']);
		expect([...getActiveFilterStatKeys(limits, MANA2_ANALYZER)]).toEqual(['lsb']);
		expect(countActiveStatFiltersForAnalyzer(limits, CMINI_ANALYZER)).toBe(1);
		expect(countActiveStatFiltersForAnalyzer(limits, CMINI_ANALYZER, { includeLikes: true })).toBe(
			2
		);
	});

	test('combines display, filter, and sort requirements in catalog order', () => {
		const limits = limitsWith([
			['cyano-sfb', '3'],
			['mana-lsb', '4']
		]);

		expect(analyzersNeededForLimits(limits)).toEqual([CYANOPHAGE_ANALYZER, MANA2_ANALYZER]);
		expect(
			analyzersNeededForLoad({
				showStats: true,
				displayMode: MANA2_ANALYZER,
				limits,
				sortBy: 'sfb'
			})
		).toEqual([CMINI_ANALYZER, CYANOPHAGE_ANALYZER, MANA2_ANALYZER]);
	});

	test('describes the first hidden analyzer whose filters remain active', () => {
		const caution = getHiddenAnalyzerFilterCaution(
			CMINI_ANALYZER,
			limitsWith([['cyano-sfb', '3']])
		);

		expect(caution).toEqual({
			analyzer: CYANOPHAGE_ANALYZER,
			count: 1,
			text: 'Cyanophage stats are hidden, but its filters (1) still affect which layouts appear.'
		});
		expect(getHiddenAnalyzerFilterCaution(CMINI_ANALYZER, createEmptyStatLimits())).toBeNull();
	});

	test('builds independent analyzer filter and sort highlights', () => {
		const highlights = getStatCardHighlightState(
			limitsWith([
				['sfb', '2'],
				['cyano-sfb', '3'],
				['mana-lsb', '4']
			]),
			'mana-lsb'
		);

		expect(highlights.botFilterHighlightKeys).toEqual(new Set(['sfb']));
		expect(highlights.cyanophageFilterHighlightKeys).toEqual(new Set(['sfb']));
		expect(highlights.mana2FilterHighlightKeys).toEqual(new Set(['lsb']));
		expect(highlights.botSortHighlightKey).toBeNull();
		expect(highlights.cyanophageSortHighlightKey).toBeNull();
		expect(highlights.mana2SortHighlightKey).toBe('lsb');
	});
});
