import { describe, expect, test } from 'bun:test';
import { addSavedLayout, serializeSavedLayoutsDocument } from '$lib/layoutCreatorStorage';
import { mergeSavedLayoutsBackup, parseSavedLayoutsBackup } from '$lib/savedLayoutsBackup';
import { createDefaultCreatorUrlSnapshot } from '$lib/layoutCreatorUrl';

function makeLayout(id: string, name: string, createdAt = 100) {
	return addSavedLayout(
		[],
		{ snapshot: { ...createDefaultCreatorUrlSnapshot(), name } },
		{ createId: () => id, now: () => createdAt }
	).layouts[0];
}

describe('saved layout backups', () => {
	test('parses versioned backups and reports skipped malformed entries', () => {
		const valid = makeLayout('one', 'One');
		const document = JSON.parse(serializeSavedLayoutsDocument([valid])) as {
			version: number;
			layouts: unknown[];
		};
		document.layouts.push({ id: '', name: 'Broken', createdAt: 1, query: '' });

		const result = parseSavedLayoutsBackup(JSON.stringify(document));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected a valid backup');
		expect(result.layouts).toHaveLength(1);
		expect(result.layouts[0]).toMatchObject({ id: 'one', name: 'One', createdAt: 100 });
		expect(result.skippedCount).toBe(1);
	});

	test('rejects invalid JSON, unrelated documents, and empty backups', () => {
		expect(parseSavedLayoutsBackup('')).toEqual({ ok: false, error: 'empty' });
		expect(parseSavedLayoutsBackup('{')).toEqual({ ok: false, error: 'invalid-json' });
		expect(parseSavedLayoutsBackup('{"version":1,"filters":[]}')).toEqual({
			ok: false,
			error: 'unsupported-format'
		});
		expect(parseSavedLayoutsBackup(serializeSavedLayoutsDocument([]))).toEqual({
			ok: false,
			error: 'no-layouts'
		});
	});

	test('adds new layouts and refreshes matching names without changing local identity', () => {
		const local = [makeLayout('local-one', 'One', 10), makeLayout('local-two', 'Two', 20)];
		const replacement = makeLayout('backup-one', 'one', 30);
		replacement.snapshot.author = 'Restored author';
		const added = makeLayout('backup-three', 'Three', 40);

		const result = mergeSavedLayoutsBackup(local, [replacement, added], 'add');

		expect(result.layouts.map(({ id, name, createdAt }) => ({ id, name, createdAt }))).toEqual([
			{ id: 'local-one', name: 'one', createdAt: 30 },
			{ id: 'local-two', name: 'Two', createdAt: 20 },
			{ id: 'backup-three', name: 'Three', createdAt: 40 }
		]);
		expect(result.layouts[0].snapshot.author).toBe('Restored author');
		expect(result.importedIds).toEqual(new Set(['local-one', 'backup-three']));
		expect(local[0].name).toBe('One');
	});

	test('replaces the collection with only imported layouts', () => {
		const result = mergeSavedLayoutsBackup(
			[makeLayout('local', 'Local')],
			[makeLayout('first', 'First'), makeLayout('second', 'Second')],
			'replace'
		);

		expect(result.layouts.map((layout) => layout.name)).toEqual(['First', 'Second']);
		expect(result.importedIds).toEqual(new Set(['first', 'second']));
	});
});
