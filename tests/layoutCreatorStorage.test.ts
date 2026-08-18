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
	creatorContentFromSnapshot,
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
			snapshot: creatorContentFromSnapshot(snapshot),
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
		expect(document.layouts[0]?.query).not.toContain('edit=');

		const restored = parseSavedLayoutsDocument(document);
		expect(restored).toHaveLength(1);
		expect(restored[0]?.id).toBe('layout-1');
		expect(restored[0]?.name).toBe('Magic lela');
		expect(restored[0]?.snapshot.author).toBe('derek');
		expect('preview' in (restored[0]?.snapshot ?? {})).toBe(false);
		expect(restored[0]?.snapshot.keyConfig.keys.find((key) => key.slot === '0,0')?.value).toBe('w');
	});

	test('migrates version-one implicit QWERTY layouts while version two defaults to empty', () => {
		const entry = { id: 'layout-1', name: 'Legacy', createdAt: 1, query: 'name=Legacy' };
		const legacy = parseSavedLayoutsDocument({ version: 1, layouts: [entry] })[0]!;
		const current = parseSavedLayoutsDocument({
			version: SAVED_LAYOUTS_SCHEMA_VERSION,
			layouts: [entry]
		})[0]!;

		expect(legacy.snapshot.keyConfig.baseLayoutName).toBe('QWERTY');
		expect(legacy.snapshot.keyConfig.keys.find((key) => key.slot === '0,0')?.value).toBe('q');
		expect(current.snapshot.keyConfig.baseLayoutName).toBeNull();
		expect(current.snapshot.keyConfig.keys.every((key) => key.value === '')).toBe(true);
		expect(JSON.parse(serializeSavedLayoutsDocument([legacy])).version).toBe(
			SAVED_LAYOUTS_SCHEMA_VERSION
		);
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
			{ snapshot: namedSnapshot('Alpha') },
			{ createId: () => 'id-a', now: () => 1 }
		).layouts[0];
		const updated = {
			...first,
			name: 'Alpha updated',
			snapshot: creatorContentFromSnapshot(namedSnapshot('Alpha updated'))
		};
		const second = addSavedLayout(
			[],
			{ snapshot: namedSnapshot('Beta') },
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
			{ snapshot: namedSnapshot('Alpha') },
			{
				createId: () => 'id-a',
				now: () => 1
			}
		);
		const second = addSavedLayout(
			first.layouts,
			{ snapshot: namedSnapshot('Alpha') },
			{ createId: () => 'id-b', now: () => 2 }
		);

		expect(second.layouts).toHaveLength(2);
		expect(second.layouts.map((entry) => entry.id)).toEqual(['id-a', 'id-b']);

		const updated = updateSavedLayout(second.layouts, 'id-a', {
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
			{ snapshot: namedSnapshot('Alpha') },
			{
				createId: () => 'id-a',
				now: () => 1
			}
		).layouts[0];
		if (!saved) throw new Error('expected a saved layout');

		const clean = resolveCreatorSession(new URLSearchParams('id=id-a'), [saved]);
		expect(clean.savedId).toBe('id-a');
		expect(clean.snapshot.name).toBe('Alpha');
		expect(clean.snapshot.preview).toBe(true);
		expect(isSavedLayoutDirty(clean.snapshot, saved)).toBe(false);

		const previewOnly = resolveCreatorSession(new URLSearchParams('id=id-a&preview=1'), [saved]);
		expect(previewOnly.savedId).toBe('id-a');
		expect(previewOnly.snapshot.name).toBe('Alpha');
		expect(previewOnly.snapshot.preview).toBe(true);
		expect(isSavedLayoutDirty(previewOnly.snapshot, saved)).toBe(false);

		const cleanEdit = resolveCreatorSession(new URLSearchParams('id=id-a&edit=1'), [saved]);
		expect(cleanEdit.savedId).toBe('id-a');
		expect(cleanEdit.snapshot.name).toBe('Alpha');
		expect(cleanEdit.snapshot.preview).toBe(false);
		expect(isSavedLayoutDirty(cleanEdit.snapshot, saved)).toBe(false);

		const dirty = resolveCreatorSession(new URLSearchParams('id=id-a&name=Beta'), [saved]);
		expect(dirty.savedId).toBe('id-a');
		expect(dirty.snapshot.name).toBe('Beta');
		expect(dirty.snapshot.preview).toBe(true);

		const dirtyEdit = resolveCreatorSession(new URLSearchParams('id=id-a&name=Beta&edit=1'), [
			saved
		]);
		expect(dirtyEdit.snapshot.preview).toBe(false);

		const unknown = resolveCreatorSession(new URLSearchParams('id=missing&name=Gamma'), [saved]);
		expect(unknown.savedId).toBeNull();
		expect(unknown.snapshot.name).toBe('Gamma');

		const cleanFeel = resolveCreatorSession(new URLSearchParams('id=id-a&tab=feel'), [saved]);
		expect(cleanFeel.snapshot.section).toBe('feel');
		expect(cleanFeel.snapshot.preview).toBe(true);
		expect(isSavedLayoutDirty(cleanFeel.snapshot, saved)).toBe(false);
	});

	test('restores disabled Adaptive mappings from an id-only saved session', () => {
		const disabledMappingIds = ['["adaptive-rule","","l","y","j"]'];
		const snapshot = namedSnapshot('Alpha', {
			includeAdaptiveKey: true,
			disabledMappingIds
		});
		const saved = addSavedLayout(
			[],
			{ snapshot },
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
			'?id=id-a&edit=1'
		);
		expect(
			creatorSearchFromSnapshot(
				{ ...snapshot, preview: true },
				{
					savedId: 'id-a',
					savedSnapshot: snapshot
				}
			)
		).toBe('?id=id-a');
		expect(
			creatorSearchFromSnapshot(
				{ ...snapshot, section: 'test' },
				{ savedId: 'id-a', savedSnapshot: snapshot }
			)
		).toBe('?id=id-a&edit=1&tab=test');
		expect(
			creatorSearchFromSnapshot(namedSnapshot('Beta'), {
				savedId: 'id-a',
				savedSnapshot: snapshot
			})
		).toBe('?name=Beta&edit=1&id=id-a');
	});
});
