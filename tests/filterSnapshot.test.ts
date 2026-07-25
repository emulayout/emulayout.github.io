import { describe, expect, test } from 'bun:test';
import { createDefaultViewSnapshot, normalizeViewFilterSnapshot } from '$lib/filterSnapshot';

describe('normalizeViewFilterSnapshot', () => {
	test('fills a partial snapshot with current defaults', () => {
		expect(normalizeViewFilterSnapshot({})).toEqual(createDefaultViewSnapshot());
	});

	test('preserves valid legacy fields and derives missing applied state', () => {
		const snapshot = normalizeViewFilterSnapshot({
			includeGrid: [['a']],
			includeLeftThumbKeys: ['e'],
			nameFilterInput: 'Canary',
			selectedAuthors: [12, 'invalid', Number.NaN],
			similarityFilterValue: '72',
			sortBy: 'cyano-sfb',
			sortOrder: 'asc',
			statLimits: {
				likes: { operator: 'gt', value: '10' }
			}
		});

		expect(snapshot.includeGrid).toHaveLength(3);
		expect(snapshot.includeGrid[0]).toHaveLength(10);
		expect(snapshot.includeGrid[0][0]).toBe('a');
		expect(snapshot.appliedIncludeGrid).toEqual(snapshot.includeGrid);
		expect(snapshot.includeLeftThumbKeys).toEqual(['e', '', '', '']);
		expect(snapshot.appliedIncludeLeftThumbKeys).toEqual(snapshot.includeLeftThumbKeys);
		expect(snapshot.nameFilter).toBe('Canary');
		expect(snapshot.selectedAuthors).toEqual([12]);
		expect(snapshot.appliedSimilarityFilterValue).toBe('72');
		expect(snapshot.sortBy).toBe('cyano-sfb');
		expect(snapshot.sortOrder).toBe('asc');
		expect(snapshot.statLimits.likes).toEqual({ operator: 'gt', value: '10' });
		expect(snapshot.appliedStatLimits.likes).toEqual({ operator: 'gt', value: '10' });
	});

	test('replaces invalid enum and nested values with safe defaults', () => {
		const snapshot = normalizeViewFilterSnapshot({
			thumbKeyFilter: 'sometimes',
			boardTypeFilter: 'curved',
			sortBy: 'unknown-stat',
			sortOrder: 'sideways',
			similarityMirrorMode: 'maybe',
			sortBeforeSimilar: { sortBy: 'unknown-stat', sortOrder: 'asc' },
			statLimits: {
				likes: { operator: 'equal', value: 10 }
			}
		});

		expect(snapshot.thumbKeyFilter).toBe('optional');
		expect(snapshot.boardTypeFilter).toBe('all');
		expect(snapshot.sortBy).toBe('date');
		expect(snapshot.sortOrder).toBe('desc');
		expect(snapshot.similarityMirrorMode).toBe('excluded');
		expect(snapshot.sortBeforeSimilar).toBeNull();
		expect(snapshot.statLimits.likes).toEqual({ operator: 'gt', value: '' });
	});
});
