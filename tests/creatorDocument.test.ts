import { expect, test } from 'bun:test';
import type { SparkLayout } from '$lib/sparkSchema';
import { buildCreatorDocument, readCreatorDocument } from '$lib/creatorDocument';
import { importAklTryPayload } from '$lib/aklTryImport';
import {
	createDefaultCreatorUrlSnapshot,
	cloneCreatorUrlSnapshot,
	creatorContentFromSnapshot,
	creatorUrlContentEqual,
	readCreatorUrlSnapshot,
	writeCreatorUrlParams,
	encodeBase64Url,
	writeLegacyCreatorUrlParams
} from '$lib/layoutCreatorUrl';
import {
	parseSavedLayoutsDocument,
	serializeSavedLayoutsDocument,
	addSavedLayout
} from '$lib/layoutCreatorStorage';
import { buildCreatorShareUrl, readCreatorShareFromSearch } from '$lib/layoutCreatorShare';
import { createCreatorAdaptiveSection } from '$lib/layoutCreatorMappings';

function imported() {
	const layout: SparkLayout = {
		future: { note: 'preserve' },
		keys: [
			{ char: '1', row: -1, col: 0, finger: 'LP', extension: true },
			{ char: 'a', row: 1, col: 0, finger: 'LI', extension: 'finger' },
			{ char: '*', row: 1, col: 4, finger: 'LI' },
			{ char: '!', row: 2, col: 9, finger: 'RP' }
		],
		magic: {
			extension: 'behavior',
			magic_keys: [
				{
					key: '*',
					default: { kind: 'repeat' },
					rules: [{ after: 'th', emit: 'e', extension: 'rule' }],
					extension: 'trigger'
				}
			],
			rules: [
				{ inputs: 'a!', output: 'ax', note: 'editable' },
				{ inputs: 'b!', output: '', note: 'unsupported' }
			]
		}
	};
	const snapshot = importAklTryPayload({
		v: 1,
		format: 'spark/1',
		board: 'ortho',
		name: 'Preserved',
		layout
	}).snapshot!;
	return { layout, snapshot };
}

test('source survives URLs, saves, backups, and sharing without losing unsupported fields', () => {
	const { layout, snapshot } = imported();
	expect(buildCreatorDocument(snapshot).layout).toEqual(layout);
	const url = writeCreatorUrlParams(snapshot);
	expect(url.has('document')).toBe(true);
	const reloaded = readCreatorUrlSnapshot(url);
	expect(buildCreatorDocument(reloaded).layout).toEqual(layout);
	const saved = addSavedLayout([], { snapshot }, { createId: () => 'saved', now: () => 1 });
	const backup = JSON.parse(serializeSavedLayoutsDocument(saved.layouts));
	expect(backup.version).toBe(3);
	expect(backup.layouts[0].query).toBeUndefined();
	const restored = parseSavedLayoutsDocument(backup)[0]!;
	expect(buildCreatorDocument(restored.snapshot).layout).toEqual(layout);
	const share = new URL(
		buildCreatorShareUrl(snapshot, 'https://example.test/create?id=local&edit=1')
	);
	const shared = readCreatorShareFromSearch(share.searchParams)!;
	expect(buildCreatorDocument(shared).layout).toEqual(layout);
	expect(share.searchParams.has('id')).toBe(false);
	expect(creatorUrlContentEqual(shared, snapshot)).toBe(true);
});

test('editing one key or rule preserves unrelated fingers, extensions, and raw rewrites', () => {
	const { snapshot } = imported();
	snapshot.keyConfig.keys.find((key) => key.slot === '1,0')!.value = 'b';
	snapshot.magicDraft.sections.find((section) => section.trigger === '*')!.rules[0].emit = 'x';
	const doc = buildCreatorDocument(snapshot).layout;
	expect(doc.keys.find((key) => key.row === 1 && key.col === 0)).toMatchObject({
		char: 'b',
		finger: 'LI',
		extension: 'finger'
	});
	expect(doc.keys.find((key) => key.row === -1)).toMatchObject({ char: '1', extension: true });
	expect(doc.magic?.magic_keys?.[0]).toMatchObject({
		extension: 'trigger',
		rules: [{ after: 'th', emit: 'x', extension: 'rule' }]
	});
	expect(doc.magic?.rules).toEqual(snapshot.sparkSource?.magic?.rules);
});

test('removing an editable raw-rule projection keeps unsupported raw rewrites', () => {
	const { snapshot } = imported();
	snapshot.magicDraft.sections = snapshot.magicDraft.sections.filter(
		(section) => section.trigger !== '!'
	);
	expect(buildCreatorDocument(snapshot).layout.magic?.rules).toEqual([
		{ inputs: 'b!', output: '', note: 'unsupported' }
	]);
});

test('incomplete rows, group identities, disabled mappings, and multi-character fallbacks stay outside Spark', () => {
	const snapshot = createDefaultCreatorUrlSnapshot();
	snapshot.includeMagicKey = true;
	const section = snapshot.magicDraft.sections[0];
	section.fallbackKind = 'emit';
	section.fallbackEmit = 'the';
	section.rules[0].after = 'unfinished';
	const group = createCreatorAdaptiveSection('My group');
	group.rules[0].trigger = 'a';
	snapshot.adaptiveDraft.groups.push(group);
	snapshot.disabledMappingIds = ['disabled'];
	const doc = buildCreatorDocument(snapshot);
	expect(doc.layout.magic?.magic_keys?.[0].default).toBeUndefined();
	expect(doc.emulayout.magicDraft.sections[0].fallbackEmit).toBe('the');
	const restored = readCreatorDocument(doc)!;
	expect(restored.magicDraft.sections[0].id).toBe(section.id);
	expect(restored.magicDraft.sections[0].rules[0]).toEqual(section.rules[0]);
	expect(restored.adaptiveDraft.groups[0]).toEqual(group);
	expect(restored.disabledMappingIds).toEqual(['disabled']);
	expect(cloneCreatorUrlSnapshot({ ...restored, preview: true, section: 'feel' }).section).toBe(
		'feel'
	);
	expect('preview' in doc.emulayout).toBe(false);
	expect('sparkEditorBaseline' in doc.emulayout).toBe(false);
});

test('new invalid documents and future versions cannot fall back to legacy fields', () => {
	const doc = buildCreatorDocument(createDefaultCreatorUrlSnapshot());
	expect(readCreatorDocument({ ...doc, version: 2 })).toBeNull();
	expect(readCreatorDocument({ ...doc, layout: { keys: 'invalid' } })).toBeNull();
	const params = new URLSearchParams({
		document: encodeBase64Url(JSON.stringify({ ...doc, version: 2 })),
		name: 'Unexpected',
		share: '2'
	});
	expect(readCreatorUrlSnapshot(params).name).toBe('New layout');
	expect(readCreatorShareFromSearch(params)).toBeNull();
	expect(
		parseSavedLayoutsDocument({
			version: 3,
			layouts: [
				{
					id: 'bad',
					name: 'Unexpected',
					createdAt: 1,
					query: 'name=Unexpected',
					document: { ...doc, version: 2 }
				}
			]
		})
	).toEqual([]);
});

test('legacy links and version-1/2 saves migrate to the same document writer', () => {
	const snapshot = { ...createDefaultCreatorUrlSnapshot(), name: 'Legacy' };
	const params = writeLegacyCreatorUrlParams(snapshot);
	params.set('share', '1');
	expect(readCreatorShareFromSearch(params)?.name).toBe('Legacy');
	for (const version of [1, 2]) {
		const layouts = parseSavedLayoutsDocument({
			version,
			layouts: [{ id: 'legacy', name: 'Legacy', createdAt: 1, query: params.toString() }]
		});
		const migrated = JSON.parse(serializeSavedLayoutsDocument(layouts));
		expect(migrated.version).toBe(3);
		expect(migrated.layouts[0].document.format).toBe('spark/1');
		expect(creatorUrlContentEqual(layouts[0].snapshot, creatorContentFromSnapshot(snapshot))).toBe(
			true
		);
	}
});

test('row identity is stable but does not make identical drafts dirty, while source extensions do', () => {
	const first = createDefaultCreatorUrlSnapshot(),
		second = createDefaultCreatorUrlSnapshot();
	expect(first.magicDraft.sections[0].id).not.toBe(second.magicDraft.sections[0].id);
	expect(creatorUrlContentEqual(first, second)).toBe(true);
	const { snapshot } = imported();
	const changed = cloneCreatorUrlSnapshot(snapshot);
	changed.sparkSource!.id = 'changed extension';
	expect(creatorUrlContentEqual(changed, snapshot)).toBe(false);
});

test('untrusted editor recovery rejects duplicate identities, invalid key bounds, and malformed preferences', () => {
	const doc = buildCreatorDocument(createDefaultCreatorUrlSnapshot());
	const duplicate = structuredClone(doc);
	duplicate.emulayout.magicDraft.sections.push(duplicate.emulayout.magicDraft.sections[0]);
	expect(readCreatorDocument(duplicate)).toBeNull();
	const invalidKey = structuredClone(doc);
	invalidKey.emulayout.keyConfig.keys[0].slot = '99,999999999';
	expect(readCreatorDocument(invalidKey)).toBeNull();
	const invalidLesson = structuredClone(doc);
	invalidLesson.emulayout.practiceLesson.customText = 123 as never;
	expect(readCreatorDocument(invalidLesson)).toBeNull();
});

test('changing the primary duplicate updates canonical Spark ordering without losing source fingers', () => {
	const snapshot = importAklTryPayload({
		v: 1,
		format: 'spark/1',
		board: 'ortho',
		name: 'Duplicates',
		layout: {
			keys: [
				{ char: 'a', row: 1, col: 0, finger: 'LI', extension: 'first' },
				{ char: 'a', row: 1, col: 9, finger: 'RP', extension: 'second' }
			]
		}
	}).snapshot!;
	for (const key of snapshot.keyConfig.keys) key.primary = key.slot === '1,9';
	const layout = buildCreatorDocument(snapshot).layout;
	expect(layout.keys[0]).toMatchObject({ col: 9, finger: 'RP', extension: 'second' });
	expect(layout.keys[1]).toMatchObject({ col: 0, finger: 'LI', extension: 'first' });
	expect(buildCreatorDocument(cloneCreatorUrlSnapshot(snapshot)).layout).toEqual(layout);
});
