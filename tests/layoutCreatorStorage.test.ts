import { describe, expect, test } from 'bun:test';
import {
	updateKeyboardInputKey,
	createDefaultKeyboardInputConfig
} from '../src/lib/keyboardInputConfig';
import {
	addSavedLayout,
	isSavedLayoutDirty,
	mergeSavedLayouts,
	removeSavedLayout,
	parseSavedLayoutsDocument,
	resolveCreatorSession,
	SAVED_LAYOUTS_SCHEMA_VERSION,
	serializeSavedLayoutsDocument,
	updateSavedLayout,
	type SavedCreatorLayout
} from '../src/lib/layoutCreatorStorage';
import {
	createDefaultCreatorUrlSnapshot,
	creatorSearchFromSnapshot,
	type CreatorUrlSnapshot
} from '../src/lib/layoutCreatorUrl';

function namedSnapshot(name: string, extra: Partial<CreatorUrlSnapshot> = {}): CreatorUrlSnapshot {
	return {
		...createDefaultCreatorUrlSnapshot(),
		name,
		...extra
	};
}

describe('saved layout storage', () => {
	test('writes and reads the versioned document using compact query snapshots', () => {
		const snapshot = namedSnapshot('Magic lela', {
			author: 'derek',
			keyConfig: updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', 'w')
		});
		const layout: SavedCreatorLayout = {
			id: 'layout-1',
			name: 'Magic lela',
			snapshot,
			createdAt: 123
		};

		const serialized = serializeSavedLayoutsDocument([layout]);
		const document = JSON.parse(serialized) as {
			version: number;
			layouts: { id: string; name: string; query: string }[];
		};

		expect(document.version).toBe(SAVED_LAYOUTS_SCHEMA_VERSION);
		expect(document.layouts[0]?.query).toContain('name=Magic+lela');
		expect(document.layouts[0]?.query).toContain('author=derek');
		expect(document.layouts[0]?.query).toContain('keys=');

		const restored = parseSavedLayoutsDocument(document);
		expect(restored).toHaveLength(1);
		expect(restored[0]?.id).toBe('layout-1');
		expect(restored[0]?.name).toBe('Magic lela');
		expect(restored[0]?.snapshot.author).toBe('derek');
		expect(restored[0]?.snapshot.keyConfig.keys.find((key) => key.slot === '0,0')?.value).toBe('w');
	});

	test('rejects malformed entries and unknown future versions', () => {
		expect(
			parseSavedLayoutsDocument({
				version: SAVED_LAYOUTS_SCHEMA_VERSION,
				layouts: [
					{ id: '', name: 'Missing id', createdAt: 1, query: '' },
					{ id: 'missing-query', name: 'Missing query', createdAt: 1 }
				]
			})
		).toEqual([]);
		expect(
			parseSavedLayoutsDocument({
				version: SAVED_LAYOUTS_SCHEMA_VERSION + 1,
				layouts: [{ id: 'future', name: 'Future', createdAt: 1, query: '' }]
			})
		).toEqual([]);
	});

	test('deduplicates stored ids and merges newer tab snapshots without dropping layouts', () => {
		const first = addSavedLayout(
			[],
			{ name: 'Alpha', snapshot: namedSnapshot('Alpha') },
			{ createId: () => 'id-a', now: () => 1 }
		).layouts[0];
		const updated = { ...first, name: 'Alpha updated', snapshot: namedSnapshot('Alpha updated') };
		const second = addSavedLayout(
			[],
			{ name: 'Beta', snapshot: namedSnapshot('Beta') },
			{ createId: () => 'id-b', now: () => 2 }
		).layouts[0];
		if (!first || !second) throw new Error('expected saved layouts');

		expect(mergeSavedLayouts([first], [updated, second])).toEqual([updated, second]);
		expect(
			parseSavedLayoutsDocument({
				version: SAVED_LAYOUTS_SCHEMA_VERSION,
				layouts: [
					{ id: 'id-a', name: 'Alpha', createdAt: 1, query: 'name=Alpha' },
					{ id: 'id-a', name: 'Duplicate', createdAt: 2, query: 'name=Duplicate' }
				]
			})
		).toHaveLength(1);
	});

	test('adds, updates, and reports dirty state by id rather than name', () => {
		const first = addSavedLayout(
			[],
			{ name: 'Alpha', snapshot: namedSnapshot('Alpha') },
			{
				createId: () => 'id-a',
				now: () => 1
			}
		);
		const second = addSavedLayout(
			first.layouts,
			{ name: 'Alpha', snapshot: namedSnapshot('Alpha') },
			{ createId: () => 'id-b', now: () => 2 }
		);

		expect(second.layouts).toHaveLength(2);
		expect(second.layouts.map((entry) => entry.id)).toEqual(['id-a', 'id-b']);

		const updated = updateSavedLayout(second.layouts, 'id-a', {
			name: 'Alpha edited',
			snapshot: namedSnapshot('Alpha edited')
		});
		expect(updated?.[0]?.name).toBe('Alpha edited');
		expect(updated?.[0]?.createdAt).toBe(1);
		expect(updated?.[1]?.name).toBe('Alpha');

		const savedA = updated?.[0];
		expect(isSavedLayoutDirty(namedSnapshot('Alpha edited'), savedA)).toBe(false);
		expect(isSavedLayoutDirty(namedSnapshot('Alpha edited', { preview: true }), savedA)).toBe(
			false
		);
		expect(
			isSavedLayoutDirty(
				namedSnapshot('Alpha edited', { disabledMappingIds: ['["magic-fallback","*"]'] }),
				savedA
			)
		).toBe(true);

		const removed = removeSavedLayout(updated ?? [], 'id-a');
		expect(removed.removed).toBe(true);
		expect(removed.layouts.map((entry) => entry.id)).toEqual(['id-b']);
		expect(removeSavedLayout(removed.layouts, 'missing').removed).toBe(false);
	});

	test('restores a saved layout from id and overlays dirty query params', () => {
		const saved = addSavedLayout(
			[],
			{ name: 'Alpha', snapshot: namedSnapshot('Alpha') },
			{
				createId: () => 'id-a',
				now: () => 1
			}
		).layouts[0];
		if (!saved) throw new Error('expected a saved layout');

		const clean = resolveCreatorSession(new URLSearchParams('id=id-a'), [saved]);
		expect(clean.savedId).toBe('id-a');
		expect(clean.snapshot.name).toBe('Alpha');

		const previewOnly = resolveCreatorSession(new URLSearchParams('id=id-a&preview=1'), [saved]);
		expect(previewOnly.savedId).toBe('id-a');
		expect(previewOnly.snapshot.name).toBe('Alpha');
		expect(previewOnly.snapshot.preview).toBe(true);
		expect(isSavedLayoutDirty(previewOnly.snapshot, saved)).toBe(false);

		const dirty = resolveCreatorSession(new URLSearchParams('id=id-a&name=Beta&preview=1'), [
			saved
		]);
		expect(dirty.savedId).toBe('id-a');
		expect(dirty.snapshot.name).toBe('Beta');
		expect(dirty.snapshot.preview).toBe(true);

		const unknown = resolveCreatorSession(new URLSearchParams('id=missing&name=Gamma'), [saved]);
		expect(unknown.savedId).toBeNull();
		expect(unknown.snapshot.name).toBe('Gamma');
	});

	test('restores disabled Adaptive mappings from an id-only saved session', () => {
		const disabledMappingIds = ['["adaptive-rule","","l","y","j"]'];
		const snapshot = namedSnapshot('Alpha', {
			includeAdaptiveKey: true,
			disabledMappingIds
		});
		const saved = addSavedLayout(
			[],
			{ name: 'Alpha', snapshot },
			{
				createId: () => 'id-a',
				now: () => 1
			}
		).layouts[0];
		if (!saved) throw new Error('expected a saved layout');

		const clean = resolveCreatorSession(new URLSearchParams('id=id-a'), [saved]);
		expect(clean.savedId).toBe('id-a');
		expect(clean.snapshot.includeAdaptiveKey).toBe(true);
		expect(clean.snapshot.disabledMappingIds).toEqual(disabledMappingIds);
		expect(isSavedLayoutDirty(clean.snapshot, saved)).toBe(false);
	});
});

describe('creator URL saved id', () => {
	test('omits the draft query when a saved layout is unchanged', () => {
		const snapshot = namedSnapshot('Alpha');
		expect(creatorSearchFromSnapshot(snapshot, { savedId: 'id-a', savedSnapshot: snapshot })).toBe(
			'?id=id-a'
		);
		expect(
			creatorSearchFromSnapshot(
				{ ...snapshot, preview: true },
				{
					savedId: 'id-a',
					savedSnapshot: snapshot
				}
			)
		).toBe('?id=id-a&preview=1');
		expect(
			creatorSearchFromSnapshot(namedSnapshot('Beta'), {
				savedId: 'id-a',
				savedSnapshot: snapshot
			})
		).toBe('?name=Beta&id=id-a');
	});
});
