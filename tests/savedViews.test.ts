import { describe, expect, test } from 'bun:test';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';
import {
	ViewFilterSnapshotCache,
	isSavedViewDirty,
	removeSavedView,
	renameSavedView,
	resolveActiveSourceLayoutNames,
	updateSavedView,
	upsertSavedView
} from '$lib/savedViews';
import type { SavedFilter } from '$lib/savedFiltersStorage';

function makeSavedView(
	id: string,
	name: string,
	overrides: Partial<SavedFilter> = {}
): SavedFilter {
	return {
		id,
		name,
		snapshot: createDefaultViewSnapshot(),
		createdAt: 100,
		...overrides
	};
}

describe('saved-view collection updates', () => {
	test('creates a normalized view without sharing mutable snapshot data', () => {
		const snapshot = createDefaultViewSnapshot();
		snapshot.includeGrid[0][0] = 'a';

		const result = upsertSavedView(
			[],
			{
				name: '  Canary  ',
				snapshot,
				sourceLayoutNames: ['Zulu', ' Canary ', 'Alpha']
			},
			{
				createId: () => 'view-1',
				now: () => 123
			}
		);

		expect(result).not.toBeNull();
		expect(result!.id).toBe('view-1');
		expect(result!.filters[0].name).toBe('Canary');
		expect(result!.filters[0].createdAt).toBe(123);
		expect(result!.filters[0].sourceLayoutNames).toEqual(['Alpha', 'Canary', 'Zulu']);

		snapshot.includeGrid[0][0] = 'b';
		expect(result!.filters[0].snapshot.includeGrid[0][0]).toBe('a');
	});

	test('case-insensitively updates while preserving identity and creation time', () => {
		const existing = makeSavedView('view-1', 'Canary');
		const original = [existing];
		const snapshot = createDefaultViewSnapshot();
		snapshot.nameFilter = 'updated';

		const result = upsertSavedView(original, {
			name: '  canary ',
			snapshot,
			sourceLayoutNames: null
		});

		expect(result).not.toBeNull();
		expect(result!.id).toBe('view-1');
		expect(result!.filters[0].createdAt).toBe(100);
		expect(result!.filters[0].name).toBe('canary');
		expect(result!.filters[0].snapshot.nameFilter).toBe('updated');
		expect(result!.filters[0].sourceLayoutNames).toBeUndefined();
		expect(original).toEqual([existing]);
	});

	test('updates, renames, and removes by id without mutating the input collection', () => {
		const filters = [makeSavedView('one', 'One'), makeSavedView('two', 'Two')];
		const snapshot = createDefaultViewSnapshot();
		snapshot.boardTypeFilter = 'ortho';

		const updated = updateSavedView(filters, 'one', snapshot, ['Zulu', 'Alpha']);
		expect(updated?.[0].snapshot.boardTypeFilter).toBe('ortho');
		expect(updated?.[0].sourceLayoutNames).toEqual(['Alpha', 'Zulu']);
		expect(filters[0].snapshot.boardTypeFilter).toBe('all');
		expect(updateSavedView(filters, 'missing', snapshot, null)).toBeNull();

		const conflict = renameSavedView(filters, 'one', ' two ');
		expect(conflict.success).toBe(false);
		expect(conflict.filters).toBe(filters);

		const renamed = renameSavedView(filters, 'one', '  First  ');
		expect(renamed).toMatchObject({ success: true, changed: true });
		expect(renamed.filters.map((filter) => filter.name)).toEqual(['First', 'Two']);

		const removed = removeSavedView(filters, 'one');
		expect(removed.removed).toBe(true);
		expect(removed.filters.map((filter) => filter.id)).toEqual(['two']);
		expect(filters).toHaveLength(2);
	});
});

describe('saved-view membership and dirtiness', () => {
	test('resolves draft, saved, and ephemeral membership in precedence order', () => {
		const filters = [
			makeSavedView('saved', 'Saved', {
				sourceLayoutNames: ['Alpha']
			})
		];

		expect(
			resolveActiveSourceLayoutNames({
				filters,
				activeSavedViewId: 'saved',
				draftSourceLayoutNames: ['Draft'],
				ephemeralSourceLayoutNames: ['Ephemeral']
			})
		).toEqual(['Draft']);
		expect(
			resolveActiveSourceLayoutNames({
				filters,
				activeSavedViewId: 'saved',
				draftSourceLayoutNames: undefined,
				ephemeralSourceLayoutNames: ['Ephemeral']
			})
		).toEqual(['Alpha']);
		expect(
			resolveActiveSourceLayoutNames({
				filters,
				activeSavedViewId: null,
				draftSourceLayoutNames: undefined,
				ephemeralSourceLayoutNames: ['Ephemeral']
			})
		).toEqual(['Ephemeral']);
	});

	test('detects snapshot and source membership changes', () => {
		const saved = makeSavedView('saved', 'Saved', {
			sourceLayoutNames: ['Alpha']
		});
		const unchanged = createDefaultViewSnapshot();

		expect(isSavedViewDirty(saved, unchanged, ['Alpha'])).toBe(false);
		expect(isSavedViewDirty(saved, unchanged, null)).toBe(true);

		const changed = createDefaultViewSnapshot();
		changed.nameFilter = 'Canary';
		expect(isSavedViewDirty(saved, changed, ['Alpha'])).toBe(true);
	});
});

describe('built-in view snapshot cache', () => {
	test('isolates stored and returned snapshots', () => {
		const cache = new ViewFilterSnapshotCache();
		const snapshot = createDefaultViewSnapshot();
		snapshot.includeGrid[0][0] = 'a';
		cache.set('all', snapshot);

		snapshot.includeGrid[0][0] = 'b';
		const firstRead = cache.get('all')!;
		expect(firstRead.includeGrid[0][0]).toBe('a');

		firstRead.includeGrid[0][0] = 'c';
		expect(cache.get('all')!.includeGrid[0][0]).toBe('a');

		cache.clear();
		expect(cache.get('all')).toBeUndefined();
	});
});
