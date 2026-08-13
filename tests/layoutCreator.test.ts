import { describe, expect, test } from 'bun:test';
import {
	createDefaultKeyboardInputConfig,
	updateKeyboardInputKey
} from '../src/lib/keyboardInputConfig';
import {
	LAYOUT_CREATOR_NEW_LAYOUT_NAME,
	createDefaultCreatorLayout,
	createLayoutFromKeyConfig,
	keyboardConfigHasMagicKey,
	removeMagicKeysFromConfig
} from '../src/lib/layoutCreator';
import { computeDisplayRows, displayRowsToString } from '../src/lib/layoutDisplay';
import { createLayoutTestKeyMaps } from '../src/lib/layoutTestEmulator';

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

	test('adds a magic key without duplicating an existing *', () => {
		const layout = createLayoutFromKeyConfig(createDefaultKeyboardInputConfig(), {
			magicKey: true
		});
		const withExistingStar = updateKeyboardInputKey(
			createDefaultKeyboardInputConfig(),
			'1,10',
			'*'
		);
		const reused = createLayoutFromKeyConfig(withExistingStar, { magicKey: true });

		expect(layout.hasMagicKey).toBe(true);
		expect(layout.positionBySlot.get('1,11')).toBe('*');
		expect(reused.hasMagicKey).toBe(true);
		expect(reused.positionBySlot.get('1,10')).toBe('*');
		expect(reused.positionBySlot.has('1,11')).toBe(false);
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

describe('removeMagicKeysFromConfig', () => {
	test('clears * from editor slots', () => {
		const withStar = updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', '*');

		expect(keyboardConfigHasMagicKey(withStar)).toBe(true);
		expect(keyboardConfigHasMagicKey(removeMagicKeysFromConfig(withStar))).toBe(false);
		expect(removeMagicKeysFromConfig(withStar).keys.find((key) => key.slot === '0,0')?.value).toBe(
			''
		);
	});
});
