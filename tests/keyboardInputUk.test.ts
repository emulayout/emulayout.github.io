import { expect, test } from 'bun:test';
import {
	createDefaultKeyboardInputConfig,
	createKeyboardInputPreset,
	setKeyboardInputTopology,
	updateKeyboardInputKey,
	keyboardInputConfigError,
	keyboardInputShiftedValue,
	serializeKeyboardInputConfig,
	parseKeyboardInputConfig,
	createKeyboardInputConfigFromLayout,
	setKeyboardInputType
} from '$lib/keyboardInputConfig';
import { decodeLayout } from '$lib/layoutCodec';
import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
import { createLayoutTestKeyMaps, withKeyboardInputConfig } from '$lib/layoutTestEmulator';
import { buildFeelInputKeyMaps } from '$lib/layoutFeel';

test('QWERTY ISO seeds UK keys, shifted aliases and survives persistence', () => {
	const config = setKeyboardInputTopology(createDefaultKeyboardInputConfig(), 'iso');
	const key = (slot: string) => config.keys.find((key) => key.slot === slot)!;
	expect(key('2,10').value).toBe('\\');
	expect(key('0,12').value).toBe('#');
	expect(keyboardInputShiftedValue(key('0,12'))).toBe('~');
	expect(keyboardInputShiftedValue(key('1,10'))).toBe('@');
	expect(config.baseLayoutModified).toBe(false);
	expect(keyboardInputConfigError(config)).toBeNull();
	expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(config))).toEqual(config);
	const target = decodeLayout(['target', '1', '', 0, ['\\', "'"], [0, 1], [12, 10]]);
	const rows = computeDisplayRows(target);
	const base = createLayoutTestKeyMaps(displayRowsToString(rows), { layout: target, rows });
	const input = withKeyboardInputConfig(base, target, config).inputKeyMap!;
	expect(input['#']).toBe('\\');
	expect(input['~']).toBe('|');
	expect(input['@']).toBe('"');
	expect(buildFeelInputKeyMaps(base, config).inputKeyMap?.['@']).toBe('@');
	expect(keyboardInputConfigError(updateKeyboardInputKey(config, '0,0', '~'))).not.toBeNull();
	expect(
		updateKeyboardInputKey(config, '0,12', '!').keys.find((key) => key.slot === '0,12')
			?.shiftedValue
	).toBeUndefined();
});

test('other layouts and modified QWERTY are not reseeded', () => {
	for (const config of [
		{ ...createDefaultKeyboardInputConfig(), baseLayoutName: 'Other' },
		updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', '1')
	]) {
		const iso = setKeyboardInputTopology(config, 'iso');
		expect(iso.keys.find((key) => key.slot === '2,10')?.value).toBe('');
		expect(iso.keys.find((key) => key.slot === '0,12')?.value).toBe('\\');
		expect(iso.keys.find((key) => key.slot === '0,0')?.value).toBe(config.keys[0].value);
	}
});

test('selecting QWERTY on ISO also seeds the preset; leaving ISO restores US defaults', () => {
	const qwerty = decodeLayout(['QWERTY', '1', '', 0, ['q'], [0], [0]]);
	const config = createKeyboardInputConfigFromLayout(qwerty, 'staggered', {
		topology: 'iso',
		missingKeyPolicy: 'preserve'
	});
	expect(config.keys.find((key) => key.slot === '2,10')?.value).toBe('\\');
	expect(config.keys.find((key) => key.slot === '0,12')?.value).toBe('#');
	for (const restored of [
		setKeyboardInputTopology(config, 'ansi'),
		setKeyboardInputType(config, 'ortho')
	]) {
		expect(restored.keys.find((key) => key.slot === '0,12')?.value).toBe('\\');
		expect(restored.keys.find((key) => key.slot === '1,10')?.shiftedValue).toBeUndefined();
		expect(restored.keys.find((key) => key.slot === '2,10')).toBeUndefined();
	}
});

test('explicit input presets remain distinct on ISO and migrate old UK names', () => {
	const hardware = setKeyboardInputTopology(createDefaultKeyboardInputConfig(), 'iso');
	expect(hardware.baseLayoutName).toBe('QWERTY UK');
	const us = createKeyboardInputPreset('QWERTY', hardware);
	expect(us.baseLayoutName).toBe('QWERTY');
	expect(us.keys.find((key) => key.slot === '0,12')?.value).toBe(String.fromCharCode(92));
	expect(us.keys.find((key) => key.slot === '2,10')?.value).toBe('');
	expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(us)).baseLayoutName).toBe('QWERTY');
	const old = { ...hardware, baseLayoutName: 'QWERTY' };
	expect(parseKeyboardInputConfig(JSON.stringify({ version: 5, config: old })).baseLayoutName).toBe(
		'QWERTY UK'
	);
});
