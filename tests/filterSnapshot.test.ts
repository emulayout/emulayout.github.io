import { describe, expect, test } from 'bun:test';
import {
	cloneViewFilterSnapshot,
	createDefaultViewSnapshot,
	normalizeViewFilterSnapshot
} from '$lib/filterSnapshot';

describe('view filter snapshot construction', () => {
	test('creates independent nested defaults', () => {
		const first = createDefaultViewSnapshot();
		const second = createDefaultViewSnapshot();

		first.includeGrid[0][0] = 'a';
		first.includeLeftThumbKeys[0] = 'e';
		first.statLimits.likes.value = '10';
		first.fingerWorkload.preference.left.middle = 'heavy';

		expect(first.appliedIncludeGrid[0][0]).toBe('');
		expect(first.appliedIncludeLeftThumbKeys[0]).toBe('');
		expect(first.appliedStatLimits.likes).toEqual({ operator: 'gt', value: '' });
		expect(second.includeGrid[0][0]).toBe('');
		expect(second.includeLeftThumbKeys[0]).toBe('');
		expect(second.statLimits.likes).toEqual({ operator: 'gt', value: '' });
		expect(second.appliedStatLimits.likes).toEqual({ operator: 'gt', value: '' });
		expect(second.fingerWorkload.preference.left.middle).toBe('none');
		expect(second.appliedFingerWorkload.preference.left.middle).toBe('none');
	});

	test('deep-clones every mutable snapshot field', () => {
		const original = createDefaultViewSnapshot();
		original.includeGrid[0][0] = 'a';
		original.includeLeftThumbKeys[0] = 'e';
		original.selectedAuthors.push(12);
		original.sortBeforeSimilar = {
			sortBy: 'name',
			sortOrder: 'asc',
			sortOrderManual: true
		};
		original.statLimits.likes.value = '10';
		original.appliedStatLimits.likes.value = '20';
		original.fingerWorkload.preference.left.middle = 'heavy';
		original.appliedFingerWorkload.preference.right.middle = 'medium';

		const clone = cloneViewFilterSnapshot(original);
		clone.includeGrid[0][0] = 'b';
		clone.includeLeftThumbKeys[0] = 't';
		clone.selectedAuthors.push(34);
		clone.sortBeforeSimilar!.sortOrder = 'desc';
		clone.statLimits.likes.value = '30';
		clone.appliedStatLimits.likes.value = '40';
		clone.fingerWorkload.preference.left.middle = 'light';
		clone.appliedFingerWorkload.preference.right.middle = 'lightest';

		expect(original.includeGrid[0][0]).toBe('a');
		expect(original.includeLeftThumbKeys[0]).toBe('e');
		expect(original.selectedAuthors).toEqual([12]);
		expect(original.sortBeforeSimilar.sortOrder).toBe('asc');
		expect(original.statLimits.likes.value).toBe('10');
		expect(original.appliedStatLimits.likes.value).toBe('20');
		expect(original.fingerWorkload.preference.left.middle).toBe('heavy');
		expect(original.appliedFingerWorkload.preference.right.middle).toBe('medium');
	});
});

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
			},
			fingerWorkloadPreferences: {
				cmini: { pinky: 'lightest', middle: 'heavy' }
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
		expect(snapshot.fingerWorkload.analyzer).toBe('cmini');
		expect(snapshot.fingerWorkload.preference.left.pinky).toBe('lightest');
		expect(snapshot.fingerWorkload.preference.left.middle).toBe('heavy');
		expect(snapshot.fingerWorkload.preference.right.pinky).toBe('lightest');
		expect(snapshot.fingerWorkload.preference.right.middle).toBe('heavy');
		expect(snapshot.appliedFingerWorkload).toEqual(snapshot.fingerWorkload);
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
			},
			fingerWorkloadPreferences: {
				cmini: { middle: 'maximum' }
			}
		});

		expect(snapshot.thumbKeyFilter).toBe('optional');
		expect(snapshot.boardTypeFilter).toBe('all');
		expect(snapshot.sortBy).toBe('date');
		expect(snapshot.sortOrder).toBe('desc');
		expect(snapshot.similarityMirrorMode).toBe('excluded');
		expect(snapshot.sortBeforeSimilar).toBeNull();
		expect(snapshot.statLimits.likes).toEqual({ operator: 'gt', value: '' });
		expect(snapshot.fingerWorkload.preference.left.middle).toBe('none');
	});

	test('replaces similarity sorting when no reference layout exists', () => {
		const snapshot = normalizeViewFilterSnapshot({
			sortBy: 'similarity',
			sortOrder: 'asc',
			sortOrderManual: true
		});

		expect(snapshot.similarReferenceName).toBeNull();
		expect(snapshot.sortBy).toBe('date');
		expect(snapshot.sortOrder).toBe('asc');
		expect(snapshot.sortOrderManual).toBe(true);
	});

	test('preserves similarity sorting when a reference layout exists', () => {
		const snapshot = normalizeViewFilterSnapshot({
			similarReferenceName: 'Canary',
			sortBy: 'similarity'
		});

		expect(snapshot.sortBy).toBe('similarity');
	});
});
