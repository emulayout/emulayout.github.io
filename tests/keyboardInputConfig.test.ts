import { describe, expect, test } from 'bun:test';
import {
	clearKeyboardInputConfig,
	cloneKeyboardInputConfig,
	createDefaultKeyboardInputConfig,
	createKeyboardInputConfigFromLayout,
	keyboardInputEditorWidthTerms,
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
		expect(config.baseLayoutModified).toBe(false);
		expect(keyboardInputConfigLabel(config)).toBe('QWERTY');
		expect(config.keyboardType).toBe('staggered');
		expect(config.keys).toHaveLength(36);
		expect(config.keys.find((key) => key.slot === '0,12')?.value).toBe('\\');
		expect(config.keys.filter((key) => key.thumbHand)).toEqual([
			{ slot: '3,0', value: '', thumbHand: 'l' },
			{ slot: '3,1', value: '', thumbHand: 'r' }
		]);
		expect(
			config.keys.filter((key) => key.thumbHand).map((key) => keyboardInputEffectiveValue(key))
		).toEqual(['', '']);
		expect(keyboardInputPlaceholderValue('1,0')).toBe('a');
		expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(config))).toEqual(config);
		expect(parseKeyboardInputConfig('{')).toEqual(config);
	});

	test('preserves thumb hands when a catalog layout becomes the editable base', () => {
		const config = createKeyboardInputConfigFromLayout(decodeLayout(thumbLayout));
		expect(config.baseLayoutName).toBe('thumb-base');
		expect(config.baseLayoutModified).toBe(false);
		expect(keyboardInputConfigLabel(config)).toBe('thumb-base');
		expect(config.keyboardType).toBe('ortho');
		expect(config.keys).toHaveLength(36);
		expect(config.keys.find((key) => key.slot === '0,2')?.value).toBe('');
		expect(config.keys.find((key) => key.slot === '0,2')?.inert).toBe(true);
		expect(keyboardInputEffectiveValue(config.keys.find((key) => key.slot === '0,2')!)).toBe('');
		expect(config.keys.filter((key) => key.thumbHand)).toEqual([
			{ slot: '3,2', value: 'e', thumbHand: 'l' },
			{ slot: '3,6', value: 'r', thumbHand: 'r' }
		]);
	});

	test('keeps imported omissions inert until the user assigns them', () => {
		const imported = createKeyboardInputConfigFromLayout(decodeLayout(thumbLayout));
		const inertKey = imported.keys.find((key) => key.slot === '0,2')!;
		expect(keyboardInputConfigError(imported)).toBeNull();
		expect(keyboardInputMissingAnsiValues(imported)).toContain('t');
		expect(
			updateKeyboardInputKey(imported, inertKey.slot, '').keys.find(
				(key) => key.slot === inertKey.slot
			)?.inert
		).toBe(true);

		const assigned = updateKeyboardInputKey(imported, inertKey.slot, '1');
		expect(assigned.baseLayoutName).toBe('thumb-base');
		expect(assigned.baseLayoutModified).toBe(true);
		expect(keyboardInputConfigLabel(assigned)).toBe('Custom');
		expect(assigned.keys.find((key) => key.slot === inertKey.slot)).toEqual({
			slot: '0,2',
			value: '1'
		});
		expect(
			keyboardInputEffectiveValue(assigned.keys.find((key) => key.slot === inertKey.slot)!)
		).toBe('1');

		const cleared = clearKeyboardInputConfig(imported);
		expect(cleared.keys.some((key) => key.inert)).toBe(false);
		expect(keyboardInputEffectiveValue(cleared.keys.find((key) => key.slot === '0,2')!)).toBe('e');
	});

	test('migrates version-one input configurations without making their blank keys inert', () => {
		const legacy = JSON.stringify({
			version: 1,
			config: {
				baseLayoutName: null,
				keyboardType: 'staggered',
				keys: [{ slot: '0,0', value: '' }]
			}
		});

		const migrated = parseKeyboardInputConfig(legacy);
		expect(migrated.keys.find((key) => key.slot === '0,0')).toEqual({ slot: '0,0', value: '' });
		expect(keyboardInputEffectiveValue(migrated.keys.find((key) => key.slot === '0,0')!)).toBe('q');
		expect(migrated.baseLayoutModified).toBe(false);
		expect(JSON.parse(serializeKeyboardInputConfig(migrated)).version).toBe(3);
	});

	test('uses QWERTY placeholders for empty keys and rejects effective duplicates', () => {
		const original = createDefaultKeyboardInputConfig();
		const edited = updateKeyboardInputKey(original, '0,0', '1');
		expect(original.keys[0].value).toBe('q');
		expect(edited.keys[0].value).toBe('1');
		expect(keyboardInputConfigLabel(edited)).toBe('Custom');
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
		expect(cleared.baseLayoutModified).toBe(false);
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
			baseLayoutModified: false,
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

	test('sizes the editor to the full QWERTY slot grid, not just assigned keys', () => {
		const staggered = createDefaultKeyboardInputConfig();
		expect(keyboardInputEditorWidthTerms(staggered)).toEqual({ keyUnits: 13, gapCount: 12 });
		expect(keyboardInputEditorWidthTerms(clearKeyboardInputConfig(staggered))).toEqual({
			keyUnits: 13,
			gapCount: 12
		});

		const ortho = { ...staggered, keyboardType: 'ortho' as const };
		expect(keyboardInputEditorWidthTerms(ortho)).toEqual({ keyUnits: 13.48, gapCount: 11 });
	});

	test('recognizes the eight resting home-key slots', () => {
		const highlightedColumns = Array.from({ length: 11 }, (_, column) => column).filter((column) =>
			isKeyboardInputHomeKeySlot(1, column)
		);
		expect(highlightedColumns).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);
	});
});
