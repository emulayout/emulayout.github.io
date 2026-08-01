import { describe, expect, test } from 'bun:test';
import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';

function layouts(...names: string[]): Array<{ name: string }> {
	return names.map((name) => ({ name }));
}

describe('layout name search', () => {
	test('ranks exact, prefix, and substring matches in that order', () => {
		const candidates = layouts('Airplane', 'Plan', 'Planet', 'Biplane', 'Planar', 'Maple');

		expect(findLayoutNameMatches(candidates, 'plan', 20)).toEqual([
			'Plan',
			'Planar',
			'Planet',
			'Airplane',
			'Biplane'
		]);
	});

	test('matches case-insensitively and trims the query', () => {
		const candidates = layouts('Canary', 'CANARY Wide', 'My canary', 'Graphite');

		expect(findLayoutNameMatches(candidates, '  cAnArY  ', 20)).toEqual([
			'Canary',
			'CANARY Wide',
			'My canary'
		]);
	});

	test('alphabetizes equal-ranked results independently of catalog order', () => {
		const candidates = layouts('Gamma Plan', 'Beta Plan', 'Alpha Plan');

		expect(findLayoutNameMatches(candidates, 'plan', 20)).toEqual([
			'Alpha Plan',
			'Beta Plan',
			'Gamma Plan'
		]);
		expect(candidates.map((layout) => layout.name)).toEqual([
			'Gamma Plan',
			'Beta Plan',
			'Alpha Plan'
		]);
	});

	test('applies the result limit and rejects empty or non-positive searches', () => {
		const candidates = layouts('Alpha', 'Alpine', 'Alphabet');

		expect(findLayoutNameMatches(candidates, 'al', 2)).toEqual(['Alpha', 'Alphabet']);
		expect(findLayoutNameMatches(candidates, ' ', 20)).toEqual([]);
		expect(findLayoutNameMatches(candidates, 'al', 0)).toEqual([]);
		expect(findLayoutNameMatches([], 'al', 20)).toEqual([]);
	});

	test('searches a lightweight list of layout names', () => {
		expect(findLayoutNameMatches(['Graphite', 'Colemak-DH', 'Colemak'], 'colemak', 20)).toEqual([
			'Colemak',
			'Colemak-DH'
		]);
	});
});

describe('search result selection', () => {
	test('clamps requested indexes to the current result set', () => {
		expect(clampSearchResultIndex(3, 10)).toBe(3);
		expect(clampSearchResultIndex(12, 4)).toBe(3);
		expect(clampSearchResultIndex(-2, 4)).toBe(0);
		expect(clampSearchResultIndex(5, 0)).toBe(0);
	});
});
