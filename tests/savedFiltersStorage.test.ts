import { describe, expect, test } from 'bun:test';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';
import {
	SAVED_FILTERS_SCHEMA_VERSION,
	parseSavedFiltersDocument,
	serializeSavedFiltersDocument,
	type SavedFilter
} from '$lib/savedFiltersStorage';

describe('saved filter storage migrations', () => {
	test('loads and normalizes the original unversioned array format', () => {
		const filters = parseSavedFiltersDocument([
			{
				id: 'legacy-view',
				name: '  Legacy view  ',
				createdAt: 123,
				sourceLayoutNames: ['Colemak', '', 42, 'Canary'],
				snapshot: {
					includeGrid: [['a']],
					nameFilter: 'legacy'
				}
			}
		]);

		expect(filters).toHaveLength(1);
		expect(filters[0].name).toBe('Legacy view');
		expect(filters[0].sourceLayoutNames).toEqual(['Canary', 'Colemak']);
		expect(filters[0].snapshot.includeGrid[0][0]).toBe('a');
		expect(filters[0].snapshot.appliedIncludeGrid).toEqual(filters[0].snapshot.includeGrid);
		expect(filters[0].snapshot.sortBy).toBe('date');
	});

	test('writes and reads the current versioned document', () => {
		const filter: SavedFilter = {
			id: 'current-view',
			name: 'Current view',
			snapshot: createDefaultViewSnapshot(),
			createdAt: 456
		};

		const serialized = serializeSavedFiltersDocument([filter]);
		const document = JSON.parse(serialized) as {
			version: number;
			filters: unknown[];
		};

		expect(document.version).toBe(SAVED_FILTERS_SCHEMA_VERSION);
		expect(parseSavedFiltersDocument(document)).toEqual([filter]);
	});

	test('rejects malformed entries and unknown future versions', () => {
		expect(
			parseSavedFiltersDocument([
				{ id: '', name: 'Missing id', createdAt: 1, snapshot: {} },
				{ id: 'missing-snapshot', name: 'Missing snapshot', createdAt: 1 }
			])
		).toEqual([]);
		expect(
			parseSavedFiltersDocument({
				version: SAVED_FILTERS_SCHEMA_VERSION + 1,
				filters: []
			})
		).toEqual([]);
	});
});
