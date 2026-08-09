import { describe, expect, test } from 'bun:test';
import {
	createLayoutTestKeyMaps,
	insertTextAtSelection,
	resolveLayoutTestKeyDown,
	withKeyboardInputConfig,
	type LayoutTestKeyInput,
	type LayoutTestKeyOptions
} from '$lib/layoutTestEmulator';
import { decodeLayout, type CompactLayout } from '$lib/layoutCodec';
import {
	applyAnglemodToDisplayRows,
	computeDisplayRows,
	displayRowsToString
} from '$lib/layoutDisplay';

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
		keyMaps: {
			keyMap: { KeyA: 'x', Semicolon: ';' },
			shiftKeyMap: { KeyA: 'X', Semicolon: ':' }
		},
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
			withKeyboardInputConfig(
				createLayoutTestKeyMaps('q w'),
				decodeLayout(target),
				{
					baseLayoutName: 'custom',
					keyboardType: 'ortho',
					keys: [
						{ slot: '0,0', value: 'b' },
						{ slot: '0,1', value: 'l' },
						{ slot: '3,4', value: 'e', thumbHand: 'l' }
					]
				},
				{ includeThumbKeys: false }
			).inputKeyMap
		).toEqual({ b: 'q', B: 'Q', l: 'w', L: 'W' });
		expect(
			resolveLayoutTestKeyDown(keyInput({ key: 'b', code: 'KeyB' }), {
				...keyOptions(),
				keyMaps: maps
			})
		).toEqual({
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'insert', text: 'q' }
		});
		expect(
			resolveLayoutTestKeyDown(keyInput({ key: 'e', code: 'KeyE' }), {
				...keyOptions(),
				keyMaps: maps
			})
		).toEqual({
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'insert', text: 'r' }
		});
	});

	test('preserves sparse and extended target slots in configured translation', () => {
		const target = decodeLayout([
			'sparse-target',
			1,
			2,
			'2026-01-01T00:00:00Z',
			2,
			['q', 'a', 'z', '.', 'l', '!'],
			[0, 1, 2, 2, 2, 0],
			[0, 0, 0, 2, 3, 13]
		]);
		const rows = computeDisplayRows(target);
		const maps = withKeyboardInputConfig(
			createLayoutTestKeyMaps(displayRowsToString(rows), { layout: target, rows }),
			target,
			{
				baseLayoutName: 'custom',
				keyboardType: 'ortho',
				keys: [
					{ slot: '2,0', value: 'z' },
					{ slot: '2,1', value: 'x' },
					{ slot: '2,2', value: 'c' },
					{ slot: '2,3', value: 'v' },
					{ slot: '0,13', value: '1' }
				]
			}
		);

		expect(maps.inputKeyMap).toEqual({
			'1': '!',
			z: 'z',
			Z: 'Z',
			x: '',
			X: '',
			c: '.',
			C: '>',
			v: 'l',
			V: 'L'
		});
	});

	test('indexes configured translation by transformed visual slots', () => {
		const target = decodeLayout([
			'anglemod-target',
			1,
			2,
			'2026-01-01T00:00:00Z',
			2,
			['q', 'a', 'z', 'x', 'c', 'v', 'b'],
			[0, 1, 2, 2, 2, 2, 2],
			[0, 0, 0, 1, 2, 3, 4]
		]);
		const rows = applyAnglemodToDisplayRows(computeDisplayRows(target));
		const maps = withKeyboardInputConfig(
			createLayoutTestKeyMaps(displayRowsToString(rows), { layout: target, rows }),
			target,
			{
				baseLayoutName: 'custom',
				keyboardType: 'ortho',
				keys: [
					{ slot: '2,0', value: 'a' },
					{ slot: '2,4', value: 'e' }
				]
			}
		);

		expect(maps.inputKeyMap).toEqual({ a: 'x', A: 'X', e: 'z', E: 'Z' });
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

	test('leaves browser modifier shortcuts and unmapped keys alone', () => {
		expect(resolveLayoutTestKeyDown(keyInput({ ctrlKey: true }), keyOptions())).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
		expect(resolveLayoutTestKeyDown(keyInput({ altKey: true }), keyOptions())).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
		expect(resolveLayoutTestKeyDown(keyInput({ metaKey: true }), keyOptions())).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
		expect(resolveLayoutTestKeyDown(keyInput({ code: 'F1' }), keyOptions())).toEqual({
			preventDefault: false,
			stopPropagation: false
		});
	});
});
