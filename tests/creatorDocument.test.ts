import legacyUrl from './fixtures/creator-legacy-url.json';
import { expect, spyOn, test } from 'bun:test';
import * as sparkCompiler from '$lib/sparkCompiler';
import type { SparkLayout } from '$lib/sparkSchema';
import {
	buildCreatorDocument,
	creatorDocumentSignature,
	readCreatorDocument,
	updateCreatorDocument
} from '$lib/creatorDocument';
import { importAklTryPayload } from '$lib/aklTryImport';
import {
	createDefaultCreatorSnapshot,
	cloneCreatorSnapshot,
	creatorContentFromSnapshot,
	creatorContentEqual
} from '$lib/creatorContent';
import { readCreatorUrlSnapshot, writeCreatorUrlParams } from '$lib/layoutCreatorUrl';
import { encodeBase64Url } from '$lib/creatorUrlEncoding';
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
	expect(creatorContentEqual(shared, snapshot)).toBe(true);
});

test('normalizes proxied source content before reconciliation and validation', () => {
	const { layout, snapshot } = imported();
	const source = new Proxy(snapshot.sparkSource!, {});
	expect(() => structuredClone(source)).toThrow();
	const document = buildCreatorDocument({ ...snapshot, sparkSource: source });
	expect(document.layout).toEqual(layout);
	expect(readCreatorDocument(document)).not.toBeNull();
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
	const snapshot = createDefaultCreatorSnapshot();
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
	expect(doc.emulayout.magicDraft.sections[0].draft?.fallbackEmit).toBe('the');
	const restored = readCreatorDocument(doc)!;
	expect(restored.magicDraft.sections[0].id).toBe(section.id);
	expect(restored.magicDraft.sections[0].rules[0]).toEqual(section.rules[0]);
	expect(restored.adaptiveDraft.groups[0]).toEqual(group);
	expect(restored.disabledMappingIds).toEqual(['disabled']);
	expect(cloneCreatorSnapshot({ ...restored, preview: true, section: 'feel' }).section).toBe(
		'feel'
	);
	expect('preview' in doc.emulayout).toBe(false);
	expect('sparkEditorBaseline' in doc.emulayout).toBe(false);
});

test('new invalid documents and future versions cannot fall back to legacy fields', () => {
	const doc = buildCreatorDocument(createDefaultCreatorSnapshot());
	expect(readCreatorDocument({ ...doc, version: 99 })).toBeNull();
	expect(readCreatorDocument({ ...doc, layout: { keys: 'invalid' } })).toBeNull();
	const params = new URLSearchParams({
		document: encodeBase64Url(JSON.stringify({ ...doc, version: 99 })),
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
					document: { ...doc, version: 99 }
				}
			]
		})
	).toEqual([]);
});

test('legacy links and version-1/2 saves migrate to the same document writer', () => {
	const params = new URLSearchParams(legacyUrl);
	const snapshot = readCreatorUrlSnapshot(params);
	params.set('share', '1');
	expect(readCreatorShareFromSearch(params)?.name).toBe('Legacy fixture');
	for (const version of [1, 2]) {
		const layouts = parseSavedLayoutsDocument({
			version,
			layouts: [{ id: 'legacy', name: 'Legacy fixture', createdAt: 1, query: params.toString() }]
		});
		const migrated = JSON.parse(serializeSavedLayoutsDocument(layouts));
		expect(migrated.version).toBe(3);
		expect(migrated.layouts[0].document.format).toBe('spark/1');
		expect(creatorContentEqual(layouts[0].snapshot, creatorContentFromSnapshot(snapshot))).toBe(
			true
		);
	}
});

test('row identity is stable but does not make identical drafts dirty, while source extensions do', () => {
	const first = createDefaultCreatorSnapshot(),
		second = createDefaultCreatorSnapshot();
	expect(first.magicDraft.sections[0].id).not.toBe(second.magicDraft.sections[0].id);
	expect(creatorContentEqual(first, second)).toBe(true);
	const { snapshot } = imported();
	const changed = cloneCreatorSnapshot(snapshot);
	changed.sparkSource!.id = 'changed extension';
	expect(creatorContentEqual(changed, snapshot)).toBe(false);
});

test('untrusted editor recovery rejects duplicate identities, invalid key bounds, and malformed preferences', () => {
	const doc = buildCreatorDocument(createDefaultCreatorSnapshot());
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
	expect(buildCreatorDocument(cloneCreatorSnapshot(snapshot)).layout).toEqual(layout);
});

test('version-2 recovery references Spark values and rejects broken references', () => {
	const { snapshot } = imported();
	const document = buildCreatorDocument(snapshot);
	expect(document.version).toBe(2);
	const section = document.emulayout.magicDraft.sections.find((section) => section.source === 0)!;
	expect(section.draft).toBeUndefined();
	expect(section.rules[0]).toEqual({ id: snapshot.magicDraft.sections[0].rules[0].id, source: 0 });
	const key = document.emulayout.keyConfig.keys.find((key) => key.slot === '1,0')!;
	expect('value' in key).toBe(false);
	expect(JSON.stringify(key)).not.toContain('"a"');
	expect(readCreatorDocument(document)?.keyConfig).toEqual(snapshot.keyConfig);
	const broken = structuredClone(document);
	broken.emulayout.magicDraft.sections[0].source = 999;
	expect(readCreatorDocument(broken)).toBeNull();
	const invalidRow = structuredClone(document);
	invalidRow.emulayout.magicDraft.sections[0].rules[0] = { id: 'bad', source: -1 };
	expect(readCreatorDocument(invalidRow)).toBeNull();
});

test('version-1 documents migrate without changing recovery state or unsupported source', () => {
	const { snapshot } = imported();
	const { sparkSource, sparkEditorBaseline, ...emulayout } = creatorContentFromSnapshot(snapshot);
	void sparkEditorBaseline;
	const legacy = { version: 1, format: 'spark/1', layout: sparkSource, emulayout };
	const restored = readCreatorDocument(legacy)!;
	expect(restored.magicDraft).toEqual(snapshot.magicDraft);
	expect(buildCreatorDocument(restored).layout).toEqual(snapshot.sparkSource!);
	expect(buildCreatorDocument(restored).version).toBe(2);
});

test('migrating version-1 editor-created duplicates preserves the legacy last-slot primary', () => {
	const content = creatorContentFromSnapshot(createDefaultCreatorSnapshot());
	content.keyConfig.keys.find((key) => key.slot === '0,0')!.value = 'e';
	const layout = buildCreatorDocument(content).layout;
	// Version 1 stored slot order, while the old runtime chose the last duplicate.
	layout.keys.sort((a, b) => a.row - b.row || a.col - b.col);
	const restored = readCreatorDocument({
		version: 1,
		format: 'spark/1',
		layout,
		emulayout: content
	})!;
	expect(buildCreatorDocument(restored).layout.keys.find((key) => key.char === 'e')?.col).toBe(2);
});

test('editing through an incomplete row preserves its source extensions, while deleting it removes the rule', () => {
	const { snapshot } = imported();
	let document = buildCreatorDocument(snapshot);
	let draft = structuredClone(snapshot.magicDraft);
	draft.sections.find((section) => section.trigger === '*')!.rules[0].emit = '';
	document = updateCreatorDocument(document, { magicDraft: draft });
	expect(document.layout.magic?.magic_keys?.[0].rules).toBeUndefined();
	const deleted = readCreatorDocument(document)!.magicDraft;
	deleted.sections.find((section) => section.trigger === '*')!.rules = [];
	expect(
		updateCreatorDocument(document, { magicDraft: deleted }).layout.magic?.magic_keys?.[0].rules
	).toBeUndefined();
	const recovered = readCreatorDocument(document)!;
	expect(
		recovered.magicDraft.sections.find((section) => section.trigger === '*')!.rules[0].emit
	).toBe('');
	draft = recovered.magicDraft;
	draft.sections.find((section) => section.trigger === '*')!.rules[0].emit = 'z';
	document = updateCreatorDocument(document, { magicDraft: draft });
	expect(document.layout.magic?.magic_keys?.[0].rules?.[0]).toMatchObject({
		emit: 'z',
		extension: 'rule'
	});
	expect(document.emulayout.magicDraft.sections[0].rules[0]).toMatchObject({ source: 0 });
	draft = readCreatorDocument(document)!.magicDraft;
	draft.sections.find((section) => section.trigger === '*')!.rules = [];
	document = updateCreatorDocument(document, { magicDraft: draft });
	expect(document.layout.magic?.magic_keys?.[0].rules).toBeUndefined();
});

test('editor preferences do not rewrite raw source or exception projections just to retain metadata', () => {
	const { layout } = imported();
	layout.magic!.rules!.push({ inputs: 'a*', output: 'ax', note: 'Keep raw authoring' });
	layout.magic!.magic_keys![0].except = ['q'];
	const snapshot = importAklTryPayload({
		v: 1,
		format: 'spark/1',
		board: 'ortho',
		name: 'Preserved',
		layout
	}).snapshot!;
	const document = updateCreatorDocument(buildCreatorDocument(snapshot), {
		includeAdaptiveKey: true
	});
	expect(document.layout).toEqual(layout);
});

test('build, clone, and signature operations compile a baseline-backed source only once', () => {
	const { layout, snapshot } = imported();
	const compilation = spyOn(sparkCompiler, 'compileSparkLayout');
	try {
		const document = buildCreatorDocument(snapshot);
		expect(compilation).toHaveBeenCalledTimes(1);
		expect(document.layout).toEqual(layout);
		compilation.mockClear();
		const cloned = cloneCreatorSnapshot(snapshot);
		expect(compilation).toHaveBeenCalledTimes(1);
		expect(cloned.sparkSource).toEqual(layout);
		compilation.mockClear();
		expect(creatorDocumentSignature(snapshot)).toBeTruthy();
		expect(compilation).toHaveBeenCalledTimes(1);
	} finally {
		compilation.mockRestore();
	}
});

test('projection reuse is confined to an operation and never bypasses external validation', () => {
	const { snapshot } = imported();
	const original = cloneCreatorSnapshot(snapshot);
	const originalSignature = creatorDocumentSignature(snapshot);
	const rule = snapshot.magicDraft.sections.find((section) => section.trigger === '*')!.rules[0];
	rule.emit = 'x';
	const edited = cloneCreatorSnapshot(snapshot);
	expect(creatorDocumentSignature(snapshot)).not.toBe(originalSignature);
	expect(edited.sparkSource?.magic?.magic_keys?.[0].rules?.[0]).toMatchObject({
		emit: 'x',
		extension: 'rule'
	});
	expect(original.sparkSource?.magic?.magic_keys?.[0].rules?.[0].emit).toBe('e');
	const document = buildCreatorDocument(snapshot);
	document.layout.keys[0].char = 'invalid';
	expect(readCreatorDocument(document)).toBeNull();
});

test('source without an editor baseline still derives its baseline before reconciliation', () => {
	const { layout, snapshot } = imported();
	delete snapshot.sparkEditorBaseline;
	const document = buildCreatorDocument(snapshot);
	expect(document.layout).toEqual(layout);
	expect(readCreatorDocument(document)?.sparkSource).toEqual(layout);
});

test('a supplied baseline does not let reconciliation repair invalid source input', () => {
	const { snapshot } = imported();
	snapshot.sparkSource!.magic!.magic_keys![0].rules![0].emit = '';
	snapshot.magicDraft.sections.find((section) => section.trigger === '*')!.rules[0].emit = 'x';
	expect(() => buildCreatorDocument(snapshot)).toThrow('must be nonempty text');
});
