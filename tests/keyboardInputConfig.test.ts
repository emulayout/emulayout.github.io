import { describe, expect, test } from 'bun:test';
import {
	clearKeyboardInputConfig,
	cloneKeyboardInputConfig,
	createDefaultKeyboardInputConfig,
	createKeyboardInputConfigFromLayout,
	keyboardInputConfigLabel,
	keyboardInputConfigError,
	keyboardInputEffectiveValue,
	keyboardInputMissingAnsiValues,
	keyboardInputPlaceholderValue,
	keyboardInputRows,
	isKeyboardInputHomeKeySlot,
	navigateKeyboardInputSlot,
	parseKeyboardInputConfig,
	serializeKeyboardInputConfig,
	updateKeyboardInputKey,
	validateKeyboardInputConfig
} from '$lib/keyboardInputConfig';
import { decodeLayout, type CompactLayout } from '$lib/layoutCodec';

const thumbLayout: CompactLayout = [
	'thumb-base',
	1,
	2,
	'2026-01-01T00:00:00Z',
	3,
	['q', 'w', 'e', 'r'],
	[0, 0, 3, 3],
	[0, 1, 2, 6],
	'lr'
];

describe('keyboard input configuration', () => {
	test('provides a complete staggered QWERTY default and round-trips persistence', () => {
		const config = createDefaultKeyboardInputConfig();
		expect(config.baseLayoutName).toBe('QWERTY');
		expect(config.keyboardType).toBe('staggered');
		expect(config.keys).toHaveLength(36);
		expect(config.keys.find((key) => key.slot === '0,12')?.value).toBe('\\');
		expect(config.keys.filter((key) => key.thumbHand)).toEqual([
			{ slot: '3,0', value: '', thumbHand: 'l' },
			{ slot: '3,1', value: '', thumbHand: 'r' }
		]);
		expect(keyboardInputPlaceholderValue('1,0')).toBe('a');
		expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(config))).toEqual(config);
		expect(parseKeyboardInputConfig('{')).toEqual(config);
	});

	test('preserves thumb hands when a catalog layout becomes the editable base', () => {
		const config = createKeyboardInputConfigFromLayout(decodeLayout(thumbLayout));
		expect(config.baseLayoutName).toBe('thumb-base');
		expect(config.keyboardType).toBe('ortho');
		expect(config.keys).toHaveLength(36);
		expect(config.keys.find((key) => key.slot === '0,2')?.value).toBe('');
		expect(keyboardInputEffectiveValue(config.keys.find((key) => key.slot === '0,2')!)).toBe('e');
		expect(config.keys.filter((key) => key.thumbHand)).toEqual([
			{ slot: '3,2', value: 'e', thumbHand: 'l' },
			{ slot: '3,6', value: 'r', thumbHand: 'r' }
		]);
	});

	test('uses QWERTY placeholders for empty keys and rejects effective duplicates', () => {
		const original = createDefaultKeyboardInputConfig();
		const edited = updateKeyboardInputKey(original, '0,0', '1');
		expect(original.keys[0].value).toBe('q');
		expect(edited.keys[0].value).toBe('1');
		expect(cloneKeyboardInputConfig(edited)).not.toBe(edited);
		expect(keyboardInputConfigError(updateKeyboardInputKey(original, '0,0', ''))).toBeNull();
		const duplicate = updateKeyboardInputKey(original, '0,0', 'w');
		expect(keyboardInputConfigError(duplicate)).toBe('Each key value must be unique.');
		expect(validateKeyboardInputConfig(duplicate)).toEqual({
			error: 'Each key value must be unique.',
			invalidSlots: ['0,0', '0,1']
		});
		expect(keyboardInputMissingAnsiValues(duplicate)).toEqual(['q']);
		const uniqueButIncomplete = updateKeyboardInputKey(original, '0,0', '1');
		expect(keyboardInputConfigError(uniqueButIncomplete)).toBeNull();
		expect(keyboardInputMissingAnsiValues(uniqueButIncomplete)).toEqual(['q']);
		const cleared = clearKeyboardInputConfig(original);
		expect(cleared.baseLayoutName).toBeNull();
		expect(cleared.keys.every((key) => key.value === '')).toBe(true);
		expect(keyboardInputConfigError(cleared)).toBeNull();
		expect(validateKeyboardInputConfig(updateKeyboardInputKey(cleared, '0,0', 'w'))).toEqual({
			error: 'Each key value must be unique.',
			invalidSlots: ['0,0', '0,1']
		});
		expect(keyboardInputConfigLabel(cleared)).toBe('QWERTY');
		expect(keyboardInputMissingAnsiValues(cleared)).toEqual([]);
		expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(cleared))).toEqual(cleared);
		expect(keyboardInputConfigError(original)).toBeNull();
	});

	test('rejects collisions with generated shifted event-key aliases', () => {
		const config = updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', ':');

		expect(validateKeyboardInputConfig(config)).toEqual({
			error: 'Each key value must be unique.',
			invalidSlots: ['0,0', '1,9']
		});
	});

	test('moves horizontally across row boundaries and vertically between rows', () => {
		const rows = keyboardInputRows({
			baseLayoutName: null,
			keyboardType: 'ortho',
			keys: [
				{ slot: '0,0', value: 'a' },
				{ slot: '0,1', value: 'b' },
				{ slot: '1,0', value: 'c' },
				{ slot: '1,1', value: 'd' },
				{ slot: '1,2', value: 'e' }
			]
		});
		expect(navigateKeyboardInputSlot(rows, '0,1', 'right')).toBe('1,0');
		expect(navigateKeyboardInputSlot(rows, '1,0', 'left')).toBe('0,1');
		expect(navigateKeyboardInputSlot(rows, '0,1', 'down')).toBe('1,1');
		expect(navigateKeyboardInputSlot(rows, '1,2', 'up')).toBe('0,1');
		expect(navigateKeyboardInputSlot(rows, '0,0', 'left')).toBeNull();
	});

	test('recognizes the eight resting home-key slots', () => {
		const highlightedColumns = Array.from({ length: 11 }, (_, column) => column).filter((column) =>
			isKeyboardInputHomeKeySlot(1, column)
		);
		expect(highlightedColumns).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);
	});
});
