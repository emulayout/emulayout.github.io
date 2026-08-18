import { describe, expect, test } from 'bun:test';
import {
	createDefaultKeyboardInputConfig,
	updateKeyboardInputKey
} from '../src/lib/keyboardInputConfig';
import {
	LAYOUT_CREATOR_NEW_LAYOUT_NAME,
	addMagicKeyToConfig,
	createDefaultCreatorLayout,
	createLayoutFromKeyConfig,
	keyboardConfigGainedMagicTriggers,
	nextDuplicatedLayoutName
} from '../src/lib/layoutCreator';
import { computeDisplayRows, displayRowsToString } from '../src/lib/layoutDisplay';
import { createLayoutTestKeyMaps } from '../src/lib/layoutTestEmulator';

describe('nextDuplicatedLayoutName', () => {
	test('appends 2, or increments a trailing copy number', () => {
		expect(nextDuplicatedLayoutName('My layout')).toBe('My layout 2');
		expect(nextDuplicatedLayoutName('Vylet v5')).toBe('Vylet v5 2');
		expect(nextDuplicatedLayoutName('Test 3')).toBe('Test 4');
		expect(nextDuplicatedLayoutName('  Test 3  ')).toBe('Test 4');
		expect(nextDuplicatedLayoutName('')).toBe('New layout 2');
	});

	test('advances until the duplicate name is unused, case-insensitively', () => {
		expect(nextDuplicatedLayoutName('My layout', ['My layout', 'My layout 2', 'my layout 3'])).toBe(
			'My layout 4'
		);
		expect(nextDuplicatedLayoutName('Test 3', ['Test 4', 'Test 6'])).toBe('Test 5');
		expect(nextDuplicatedLayoutName('Big 9007199254740992', ['Big 9007199254740992'])).toBe(
			'Big 9007199254740993'
		);
	});
});

describe('createDefaultCreatorLayout', () => {
	test('starts from a stagger QWERTY canvas named New layout', () => {
		const layout = createDefaultCreatorLayout();

		expect(layout.name).toBe(LAYOUT_CREATOR_NEW_LAYOUT_NAME);
		expect(layout.board).toBe('stagger');
		expect(layout.hasAllLetters).toBe(true);
		expect(layout.hasMagicKey).toBe(false);
		expect(layout.hasAdaptiveSwap).toBe(false);
		expect(layout.hasThumbKeys).toBe(false);
		expect(layout.keys.q).toEqual({ row: 0, col: 0 });
		expect(layout.keys.a).toEqual({ row: 1, col: 0 });
		expect(layout.keys.z).toEqual({ row: 2, col: 0 });
		expect(layout.positionBySlot.get('0,0')).toBe('q');
		expect(layout.positionBySlot.get('1,4')).toBe('g');
	});
});

describe('createLayoutFromKeyConfig', () => {
	test('keeps duplicate thumb letters on opposite hands', () => {
		const withDuplicateThumbs = ['3,0', '3,1'].reduce(
			(config, slot) => updateKeyboardInputKey(config, slot, 'e'),
			createDefaultKeyboardInputConfig()
		);
		const layout = createLayoutFromKeyConfig(withDuplicateThumbs);

		expect(layout.thumbKeysByHand.l).toEqual([{ key: 'e', col: 0 }]);
		expect(layout.thumbKeysByHand.r).toEqual([{ key: 'e', col: 1 }]);
		expect(layout.positionBySlot.get('3,0')).toBe('e');
		expect(layout.positionBySlot.get('3,1')).toBe('e');
	});

	test('keeps duplicate letters on their own slots for typing', () => {
		const withDuplicates = ['0,0', '0,1', '0,2'].reduce(
			(config, slot) => updateKeyboardInputKey(config, slot, 'e'),
			createDefaultKeyboardInputConfig()
		);
		const layout = createLayoutFromKeyConfig(withDuplicates);
		const rows = computeDisplayRows(layout);
		const maps = createLayoutTestKeyMaps(displayRowsToString(rows), { layout, rows });

		expect(layout.positionBySlot.get('0,0')).toBe('e');
		expect(layout.positionBySlot.get('0,1')).toBe('e');
		expect(layout.positionBySlot.get('0,2')).toBe('e');
		expect(maps.keyMap.KeyQ).toBe('e');
		expect(maps.keyMap.KeyW).toBe('e');
		expect(maps.keyMap.KeyE).toBe('e');
		expect(maps.slotKeyMap?.['0,0']).toBe('e');
		expect(maps.slotKeyMap?.['0,1']).toBe('e');
		expect(maps.slotKeyMap?.['0,2']).toBe('e');
	});

	test('replacing q with an existing e does not shift later keys', () => {
		const withDuplicateE = updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', 'e');
		const layout = createLayoutFromKeyConfig(withDuplicateE);
		const rows = computeDisplayRows(layout);
		const maps = createLayoutTestKeyMaps(displayRowsToString(rows), { layout, rows });

		expect(maps.keyMap.KeyQ).toBe('e');
		expect(maps.keyMap.KeyW).toBe('w');
		expect(maps.keyMap.KeyE).toBe('e');
	});

	test('adds an editable magic key without duplicating an existing trigger', () => {
		const withAddedStar = addMagicKeyToConfig(createDefaultKeyboardInputConfig());
		const layout = createLayoutFromKeyConfig(withAddedStar, {
			magicKey: true
		});
		const withExistingStar = updateKeyboardInputKey(
			createDefaultKeyboardInputConfig(),
			'1,10',
			'*'
		);
		const reusedConfig = addMagicKeyToConfig(withExistingStar);
		const reused = createLayoutFromKeyConfig(reusedConfig, { magicKey: true });

		expect(layout.hasMagicKey).toBe(true);
		expect(withAddedStar.keys.find((key) => key.slot === '1,11')?.value).toBe('*');
		expect(layout.positionBySlot.get('1,11')).toBe('*');
		expect(reusedConfig).toBe(withExistingStar);
		expect(reused.hasMagicKey).toBe(true);
		expect(reused.positionBySlot.get('1,10')).toBe('*');
		expect(reused.positionBySlot.has('1,11')).toBe(false);
	});

	test('does not inject * when the board already has @', () => {
		const withAt = updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', '@');
		const withMagic = addMagicKeyToConfig(withAt);
		const layout = createLayoutFromKeyConfig(withMagic, { magicKey: true });

		expect(withMagic).toBe(withAt);
		expect(layout.hasMagicKey).toBe(true);
		expect(layout.hasRepeatKey).toBe(true);
		expect(layout.keys['@']).toEqual({ row: 0, col: 0 });
		expect(layout.keys['*']).toBeUndefined();
	});

	test('uses a custom layout name', () => {
		const layout = createLayoutFromKeyConfig(createDefaultKeyboardInputConfig(), {
			name: 'Custom draft'
		});

		expect(layout.name).toBe('Custom draft');
	});

	test('marks adaptive independently of magic', () => {
		const adaptiveOnly = createLayoutFromKeyConfig(createDefaultKeyboardInputConfig(), {
			adaptiveKey: true
		});
		const both = createLayoutFromKeyConfig(createDefaultKeyboardInputConfig(), {
			magicKey: true,
			adaptiveKey: true
		});

		expect(adaptiveOnly.hasAdaptiveSwap).toBe(true);
		expect(adaptiveOnly.hasMagicKey).toBe(false);
		expect(both.hasAdaptiveSwap).toBe(true);
		expect(both.hasMagicKey).toBe(true);
	});
});

describe('keyboardConfigGainedMagicTriggers', () => {
	test('reports newly assigned @ and * without treating clears as gains', () => {
		const empty = createDefaultKeyboardInputConfig();
		const withAt = updateKeyboardInputKey(empty, '0,0', '@');
		const withStar = updateKeyboardInputKey(withAt, '0,1', '*');
		const clearedAt = updateKeyboardInputKey(withStar, '0,0', '');
		const otherKey = updateKeyboardInputKey(withAt, '0,1', 'w');

		expect(keyboardConfigGainedMagicTriggers(empty, withAt)).toEqual(['@']);
		expect(keyboardConfigGainedMagicTriggers(withAt, withStar)).toEqual(['*']);
		expect(keyboardConfigGainedMagicTriggers(withStar, clearedAt)).toEqual([]);
		expect(keyboardConfigGainedMagicTriggers(withAt, otherKey)).toEqual([]);
		expect(keyboardConfigGainedMagicTriggers(withAt, withAt)).toEqual([]);
	});
});
