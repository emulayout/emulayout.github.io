import { describe, expect, test } from 'bun:test';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';
import { serializeSavedFiltersDocument, type SavedFilter } from '$lib/savedFiltersStorage';
import { mergeSavedViews, parseSavedViewsBackup } from '$lib/savedViewsBackup';

function makeView(id: string, name: string, createdAt = 100): SavedFilter {
	return {
		id,
		name,
		snapshot: createDefaultViewSnapshot(),
		createdAt
	};
}

describe('saved views backups', () => {
	test('parses versioned backups and reports skipped malformed entries', () => {
		const valid = makeView('one', 'One');
		const text = JSON.stringify({
			version: 1,
			filters: [valid, { id: '', name: 'Broken', createdAt: 1, snapshot: {} }]
		});

		expect(parseSavedViewsBackup(text)).toEqual({
			ok: true,
			filters: [valid],
			skippedCount: 1
		});
	});

	test('rejects invalid JSON, unrelated documents, and empty backups', () => {
		expect(parseSavedViewsBackup('{')).toEqual({ ok: false, error: 'invalid-json' });
		expect(parseSavedViewsBackup('{"filters":[]}')).toEqual({
			ok: false,
			error: 'unsupported-format'
		});
		expect(parseSavedViewsBackup(serializeSavedFiltersDocument([]))).toEqual({
			ok: false,
			error: 'no-views'
		});
	});

	test('adds new views and refreshes matching names without duplicating local identity', () => {
		const local = [makeView('local-one', 'One', 10), makeView('local-two', 'Two', 20)];
		const replacement = makeView('backup-one', 'one', 30);
		replacement.snapshot.nameFilter = 'restored';
		const added = makeView('backup-three', 'Three', 40);

		const result = mergeSavedViews(local, [replacement, added], 'add');

		expect(result.filters.map(({ id, name, createdAt }) => ({ id, name, createdAt }))).toEqual([
			{ id: 'local-one', name: 'one', createdAt: 30 },
			{ id: 'local-two', name: 'Two', createdAt: 20 },
			{ id: 'backup-three', name: 'Three', createdAt: 40 }
		]);
		expect(result.filters[0].snapshot.nameFilter).toBe('restored');
		expect(result.importedIds).toEqual(new Set(['local-one', 'backup-three']));
		expect(local[0].name).toBe('One');
	});

	test('replaces the collection with only imported views', () => {
		const result = mergeSavedViews(
			[makeView('local', 'Local')],
			[makeView('first', 'First'), makeView('second', 'Second')],
			'replace'
		);

		expect(result.filters.map((view) => view.name)).toEqual(['First', 'Second']);
		expect(result.importedIds).toEqual(new Set(['first', 'second']));
	});
});
