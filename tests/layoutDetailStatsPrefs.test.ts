import { describe, expect, test } from 'bun:test';
import {
	normalizeLayoutDetailStatsAnalyzers,
	parseLayoutDetailStatsAnalyzers
} from '$lib/layoutDetailStatsPrefs';

describe('layout-detail stats preferences', () => {
	test('preserves an explicit empty selection and canonicalizes analyzer order', () => {
		expect(parseLayoutDetailStatsAnalyzers('[]')).toEqual([]);
		expect(normalizeLayoutDetailStatsAnalyzers(['mana2', 'cmini', 'mana2'])).toEqual([
			'cmini',
			'mana2'
		]);
	});

	test('keeps valid analyzers and rejects malformed storage', () => {
		expect(parseLayoutDetailStatsAnalyzers('["mana2","removed","cmini"]')).toEqual([
			'cmini',
			'mana2'
		]);
		expect(parseLayoutDetailStatsAnalyzers(null)).toBeNull();
		expect(parseLayoutDetailStatsAnalyzers('{"cmini":true}')).toBeNull();
		expect(parseLayoutDetailStatsAnalyzers('not-json')).toBeNull();
	});
});
