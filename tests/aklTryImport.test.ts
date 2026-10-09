import { describe, expect, test } from 'bun:test';
import { importAklTryPayload, readAklTryHash, readSparkImportText } from '../src/lib/aklTryImport';
import { createLayoutFromKeyConfig } from '../src/lib/layoutCreator';
import { compileCreatorInputProfile } from '../src/lib/layoutCreatorMappings';
import { resolveLayoutInput } from '../src/lib/layoutInputBehaviors';
import { cloneCreatorSnapshot } from '../src/lib/creatorContent';
import { updateKeyboardInputKey } from '../src/lib/keyboardInputConfig';
import {
	addSavedLayout,
	parseSavedLayoutsDocument,
	serializeSavedLayoutsDocument
} from '../src/lib/layoutCreatorStorage';

const qwertyKeys = [
	['q', 0, 0, 'LP'],
	['w', 0, 1, 'LR'],
	['a', 1, 0, 'LP'],
	['b', 1, 1, 'LI'],
	['h', 1, 5, 'RI'],
	['j', 1, 6, 'RI'],
	[';', 1, 9, 'RP'],
	['/', 2, 9, 'RP'],
	['e', 3, 2, 'LT'],
	['r', 3, 6, 'RT']
].map(([char, row, col, finger]) => ({ char, row, col, finger }));

test('pasted raw Spark and AKL wrappers reuse the link importer', () => {
	const defaults = { name: 'Current', author: 'Author', board: 'staggered' as const };
	const raw = readSparkImportText(JSON.stringify(payload().layout), defaults);
	expect(raw.snapshot?.name).toBe('Current');
	expect(raw.snapshot?.author).toBe('Author');
	expect(raw.snapshot?.keyConfig.keyboardType).toBe('staggered');
	expect(raw.snapshot?.includeMagicKey).toBe(true);
	expect(raw.snapshot?.includeAdaptiveKey).toBe(true);
	expect(raw.snapshot?.includeChiralKey).toBe(true);
	expect(raw.notice).toContain('Will import without');
	const wrapped = readSparkImportText(JSON.stringify(payload()), defaults);
	expect(wrapped.snapshot?.name).toBe('idioms-example');
	expect(wrapped.snapshot?.keyConfig.keyboardType).toBe('ortho');
	for (const value of [
		null,
		{},
		{ ...payload(), v: 2 },
		{ ...payload(), format: 'spark/2' },
		{ schema: 2, keys: qwertyKeys },
		{ keys: [] }
	]) {
		expect(readSparkImportText(JSON.stringify(value), defaults).snapshot).toBeNull();
	}
	expect(readSparkImportText('{', defaults).snapshot).toBeNull();
	expect(readSparkImportText(' '.repeat(65537), defaults).notice).toContain('64 KiB');
});

function payload() {
	return {
		v: 1,
		name: 'idioms-example',
		author: 'Someone',
		board: 'ortho',
		source: 'https://akl.gg/#example',
		format: 'spark/1',
		layout: {
			keys: qwertyKeys.map((key) => ({ ...key })),
			magic: {
				magic_keys: [
					{
						key: ';',
						default: { kind: 'repeat' },
						rules: [{ after: 'th', emit: 'e' }],
						except: ['q']
					}
				],
				chiral_keys: [
					{
						key: '/',
						same: { kind: 'char', char: 'e' },
						opposite: { kind: 'char', char: 'i' },
						except: ['b']
					}
				],
				adaptive_swaps: [{ trigger: 'a', swap: ['h', 'j'] }],
				rules: [{ inputs: 'ab', output: 'ax' }]
			}
		}
	};
}

function encodeBase64UrlUtf8(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('akl.gg try import', () => {
	test('preserves ordinary typing around raw and chiral rules, including after reload', () => {
		const imported = importAklTryPayload(payload()).snapshot!;
		for (const snapshot of [imported, cloneCreatorSnapshot(imported)]) {
			const profile = compileCreatorInputProfile(
				snapshot.includeMagicKey,
				snapshot.magicDraft,
				snapshot.includeAdaptiveKey,
				snapshot.adaptiveDraft,
				Object.keys(createLayoutFromKeyConfig(snapshot.keyConfig).keys),
				snapshot.chiralDraft,
				createLayoutFromKeyConfig(snapshot.keyConfig).keys
			);
			expect(profile).toBeDefined();
			for (const [history, key, expected] of [
				['a', 'b', 'x'],
				['b', 'b', 'b'],
				['', 'b', 'b'],
				['b', '/', '/'],
				['', '/', '/'],
				['a', '/', 'i'],
				['h', '/', 'e'],
				['th', ';', 'e'],
				['q', ';', ';'],
				['a', ';', 'a']
			]) {
				expect(resolveLayoutInput(profile, history, key).text).toBe(expected);
			}
		}
	});

	test('preserves literal whitespace contexts in imported drafts', () => {
		const value = payload();
		value.layout.magic.magic_keys[0].rules.push({ after: ' ', emit: 'x' });
		value.layout.magic.rules.push({ inputs: ' b', output: ' x' });
		const result = importAklTryPayload(value);
		expect(result.notice).not.toContain('whitespace-context rules');
		expect(result.snapshot!.magicDraft.sections.flatMap((section) => section.rules)).toContainEqual(
			expect.objectContaining({ after: ' ', emit: 'x' })
		);
		expect(result.snapshot!.magicDraft.sections.flatMap((section) => section.rules)).toContainEqual(
			expect.objectContaining({ after: 'th', emit: 'e' })
		);
	});

	test('keeps the first duplicate as primary across geometry sorting, URL cloning, and edits', () => {
		for (const keys of [
			[
				{ char: 'a', row: 0, col: 0, finger: 'LP' },
				{ char: 'a', row: 1, col: 9, finger: 'RP' }
			],
			[
				{ char: 'a', row: 3, col: 6, finger: 'RT' },
				{ char: 'a', row: 0, col: 0, finger: 'LP' }
			]
		]) {
			const value = { ...payload(), layout: { keys } };
			const imported = importAklTryPayload(value).snapshot!;
			const saved = addSavedLayout([], { snapshot: imported }).layouts;
			const restored = parseSavedLayoutsDocument(
				JSON.parse(serializeSavedLayoutsDocument(saved))
			)[0].snapshot;
			for (const snapshot of [imported, cloneCreatorSnapshot(imported), restored]) {
				const layout = createLayoutFromKeyConfig(snapshot.keyConfig);
				expect(layout.keys.a).toMatchObject({ row: keys[0].row, col: keys[0].col });
				expect(layout.positionBySlot.size).toBe(2);
				const edited = updateKeyboardInputKey(snapshot.keyConfig, '0,1', 'w');
				expect(createLayoutFromKeyConfig(edited).keys.a).toEqual(layout.keys.a);
				const primarySlot = `${keys[0].row},${keys[0].col}`;
				expect(
					updateKeyboardInputKey(snapshot.keyConfig, primarySlot, 'a').keys.find(
						(key) => key.slot === primarySlot
					)?.primary
				).toBe(true);
				expect(
					updateKeyboardInputKey(snapshot.keyConfig, primarySlot, 'z').keys.find(
						(key) => key.slot === primarySlot
					)?.primary
				).toBeUndefined();
			}
		}
	});

	test('omits huge coordinates before they reach the renderer and keeps supported extra keys', () => {
		const value = payload();
		value.layout.keys.push(
			{ char: 'x', row: 0, col: 4294967295, finger: 'RP' },
			{ char: 'y', row: 9999999, col: 0, finger: 'LT' },
			{ char: '\\', row: 0, col: 12, finger: 'RP' }
		);
		const result = importAklTryPayload(value);
		expect(result.notice).toContain('keys outside supported keyboard bounds');
		expect(createLayoutFromKeyConfig(result.snapshot!.keyConfig).keys.x).toBeUndefined();
		expect(createLayoutFromKeyConfig(result.snapshot!.keyConfig).keys.y).toBeUndefined();
		expect(createLayoutFromKeyConfig(result.snapshot!.keyConfig).keys['\\']).toMatchObject({
			row: 0,
			col: 12
		});
		expect(readAklTryHash(`#akl=${'A'.repeat(64 * 1024 + 1)}`).snapshot).toBeNull();
	});

	test('imports keys, geometry, thumbs, and all representable contextual idioms', () => {
		const result = importAklTryPayload(payload());
		const snapshot = result.snapshot!;

		expect(snapshot.name).toBe('idioms-example');
		expect(snapshot.author).toBe('Someone');
		expect(snapshot.preview).toBe(true);
		expect(snapshot.keyConfig.keyboardType).toBe('ortho');
		expect(snapshot.keyConfig.keys.find((key) => key.slot === '3,2')?.thumbHand).toBe('l');
		expect(snapshot.keyConfig.keys.find((key) => key.slot === '3,6')?.thumbHand).toBe('r');
		expect(snapshot.includeMagicKey).toBe(true);
		expect(snapshot.includeAdaptiveKey).toBe(true);

		const semicolon = snapshot.magicDraft.sections.find((section) => section.trigger === ';')!;
		expect(semicolon.fallbackKind).toBe('repeat-last');
		expect(semicolon.rules.map(({ after, emit }) => [after, emit])).toEqual([
			['th', 'e'],
			['q', ';']
		]);
		expect(snapshot.magicDraft.sections.find((section) => section.trigger === 'b')?.rules).toEqual(
			expect.arrayContaining([expect.objectContaining({ after: 'a', emit: 'x' })])
		);
		expect(snapshot.adaptiveDraft.rules[0]).toMatchObject({ trigger: 'a', left: 'h', right: 'j' });
		expect(result.source).toBe('https://akl.gg/#example');
	});

	test('omits unsupported number-row keys and reports the omission', () => {
		const value = payload();
		value.layout.keys.push({ char: '1', row: -1, col: 0, finger: 'LP' });
		const result = importAklTryPayload(value);
		expect(result.snapshot?.keyConfig.keys.some((key) => key.value === '1')).toBe(false);
		expect(result.notice).toContain('the number row');
	});

	test('reads unpadded base64url UTF-8 and rejects malformed or unknown payloads', () => {
		const value = { ...payload(), name: 'Graphite — café' };
		const hash = `#akl=${encodeBase64UrlUtf8(value)}`;
		expect(readAklTryHash(hash).snapshot?.name).toBe('Graphite — café');
		expect(readAklTryHash('#akl=A').notice).toBe("Couldn't read this akl.gg link.");
		expect(readAklTryHash('#akl=_w').notice).toBe("Couldn't read this akl.gg link.");
		expect(readAklTryHash('#akl=e30').notice).toBe("Couldn't read this akl.gg link.");
		expect(
			readAklTryHash(`#akl=${encodeURIComponent(JSON.stringify(payload()))}`).snapshot
		).toBeNull();
		expect(importAklTryPayload({ ...payload(), v: 2 }).snapshot).toBeNull();
		expect(readAklTryHash('#something-else').notice).toBeNull();
	});
});
