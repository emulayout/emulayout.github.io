import { describe, expect, test } from 'bun:test';
import {
	createLayoutTestKeyMaps,
	insertTextAtSelection,
	resolveLayoutTestKeyDown,
	shouldCaptureLayoutTestKeyUp,
	usesMetaThumbKeys,
	withKeyboardInputConfig,
	type LayoutTestKeyInput,
	type LayoutTestKeyOptions
} from '$lib/layoutTestEmulator';
import { decodeLayout, type CompactLayout } from '$lib/layoutCodec';

function keyInput(overrides: Partial<LayoutTestKeyInput> = {}): LayoutTestKeyInput {
	return {
		key: 'a',
		code: 'KeyA',
		shiftKey: false,
		ctrlKey: false,
		altKey: false,
		metaKey: false,
		...overrides
	};
}

function keyOptions(overrides: Partial<LayoutTestKeyOptions> = {}): LayoutTestKeyOptions {
	return {
		hasThumbKeys: false,
		thumbKeysByHand: { l: [], r: [] },
		keyMaps: {
			keyMap: { KeyA: 'x', Semicolon: ';' },
			shiftKeyMap: { KeyA: 'X', Semicolon: ':' }
		},
		metaThumbKeys: false,
		...overrides
	};
}

describe('layout test key maps and text edits', () => {
	test('derives base and shifted mappings from display rows', () => {
		const maps = createLayoutTestKeyMaps(
			'q w e r t y u i o p\n' + 'a s d f g h j k l ;\n' + 'z x c v b n m , . /'
		);

		expect(maps.keyMap.KeyA).toBe('a');
		expect(maps.shiftKeyMap.KeyA).toBe('A');
		expect(maps.keyMap.Semicolon).toBe(';');
		expect(maps.shiftKeyMap.Semicolon).toBe(':');
	});

	test('translates configured input-layout characters by position, including thumbs', () => {
		const target: CompactLayout = [
			'target',
			1,
			2,
			'2026-01-01T00:00:00Z',
			3,
			['q', 'w', 'r'],
			[0, 0, 3],
			[0, 1, 2],
			'l'
		];
		const maps = withKeyboardInputConfig(createLayoutTestKeyMaps('q w'), decodeLayout(target), {
			baseLayoutName: 'custom',
			keyboardType: 'ortho',
			keys: [
				{ slot: '0,0', value: 'b' },
				{ slot: '0,1', value: 'l' },
				{ slot: '3,4', value: 'e', thumbHand: 'l' }
			]
		});

		expect(maps.inputKeyMap).toEqual({ b: 'q', B: 'Q', l: 'w', L: 'W', e: 'r', E: 'R' });
		expect(
			resolveLayoutTestKeyDown(keyInput({ key: 'b', code: 'KeyB' }), {
				...keyOptions(),
				hasThumbKeys: true,
				thumbKeysByHand: decodeLayout(target).thumbKeysByHand,
				keyMaps: maps
			})
		).toEqual({
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'insert', text: 'q' }
		});
	});

	test('replaces the current selection and advances the cursor', () => {
		expect(insertTextAtSelection('hello world', 6, 11, 'layout')).toEqual({
			value: 'hello layout',
			cursor: 12
		});
	});
});

describe('layout test keydown decisions', () => {
	test('clears on Escape and remaps normal or shifted keys', () => {
		expect(resolveLayoutTestKeyDown(keyInput({ key: 'Escape' }), keyOptions())).toEqual({
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'clear' }
		});
		expect(resolveLayoutTestKeyDown(keyInput(), keyOptions())).toEqual({
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'insert', text: 'x' }
		});
		expect(resolveLayoutTestKeyDown(keyInput({ shiftKey: true }), keyOptions())).toEqual({
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'insert', text: 'X' }
		});
	});

	test('leaves browser shortcuts alone when the layout has no thumb keys', () => {
		expect(resolveLayoutTestKeyDown(keyInput({ ctrlKey: true }), keyOptions())).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
		expect(resolveLayoutTestKeyDown(keyInput({ code: 'F1' }), keyOptions())).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
	});

	test('maps non-Apple Alt thumb keys and captures held-thumb sequences', () => {
		const options = keyOptions({
			hasThumbKeys: true,
			thumbKeysByHand: {
				l: [
					{ key: 'r', col: 2 },
					{ key: 'e', col: 3 }
				],
				r: [
					{ key: 'n', col: 6 },
					{ key: 's', col: 7 }
				]
			}
		});

		expect(
			resolveLayoutTestKeyDown(
				keyInput({ key: 'Alt', code: 'AltLeft', shiftKey: true, altKey: true }),
				options
			)
		).toEqual({
			preventDefault: true,
			stopPropagation: true,
			edit: { type: 'insert', text: 'E' }
		});
		expect(
			resolveLayoutTestKeyDown(keyInput({ key: 'Alt', code: 'AltRight', altKey: true }), options)
		).toEqual({
			preventDefault: true,
			stopPropagation: true,
			edit: { type: 'insert', text: 'n' }
		});
		expect(resolveLayoutTestKeyDown(keyInput({ altKey: true }), options)).toEqual({
			preventDefault: true,
			stopPropagation: true,
			edit: { type: 'insert', text: 'x' }
		});
	});

	test('uses Command thumbs on Apple platforms while preserving blocking modifiers', () => {
		const options = keyOptions({
			hasThumbKeys: true,
			metaThumbKeys: true,
			thumbKeysByHand: {
				l: [{ key: 'e', col: 3 }],
				r: [{ key: 'n', col: 6 }]
			}
		});

		expect(
			resolveLayoutTestKeyDown(keyInput({ key: 'Meta', code: 'MetaLeft', metaKey: true }), options)
		).toEqual({
			preventDefault: true,
			stopPropagation: true,
			edit: { type: 'insert', text: 'e' }
		});
		expect(resolveLayoutTestKeyDown(keyInput({ altKey: true }), options)).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
	});
});

describe('layout test platform and keyup handling', () => {
	test('selects the thumb modifier from the platform', () => {
		expect(usesMetaThumbKeys('MacIntel', '')).toBe(true);
		expect(usesMetaThumbKeys('', 'iPhone')).toBe(true);
		expect(usesMetaThumbKeys('Linux x86_64', 'Macintosh')).toBe(false);
	});

	test('captures only the configured thumb key releases', () => {
		expect(shouldCaptureLayoutTestKeyUp('AltLeft', true, false)).toBe(true);
		expect(shouldCaptureLayoutTestKeyUp('MetaLeft', true, false)).toBe(false);
		expect(shouldCaptureLayoutTestKeyUp('MetaRight', true, true)).toBe(true);
		expect(shouldCaptureLayoutTestKeyUp('MetaRight', false, true)).toBe(false);
	});
});
