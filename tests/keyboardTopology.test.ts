import {
	keyboardInputControlLabel,
	keyboardInputTopology,
	setKeyboardInputType
} from '$lib/keyboardInputConfig';
import { describe, expect, test } from 'bun:test';
import { decodeLayout } from '$lib/layoutCodec';
import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
import {
	createLayoutTestKeyMaps,
	withKeyboardInputConfig,
	resolveLayoutTestKeyDown
} from '$lib/layoutTestEmulator';
import {
	createDefaultKeyboardInputConfig,
	setKeyboardInputTopology,
	updateKeyboardInputKey,
	createKeyboardInputConfigFromLayout,
	parseKeyboardInputConfig,
	serializeKeyboardInputConfig,
	keyboardInputRows
} from '$lib/keyboardInputConfig';
import {
	resolvePhysicalKeys,
	topologyPreviewRows,
	KEYBOARD_TOPOLOGIES
} from '$lib/keyboardTopology';
import { buildFeelCharMap } from '$lib/layoutFeel';
import {
	collectReachableTargetCharacters,
	unreachableTargetLayoutKeys,
	filterWordsByReachableCharacters
} from '$lib/layoutKeyReachability';
import { easyHarlot } from './fixtures/topologyLayouts';

const iso = decodeLayout(easyHarlot('iso'));
const ansi = decodeLayout(easyHarlot('ansi'));
const rows = computeDisplayRows(iso);
const base = createLayoutTestKeyMaps(displayRowsToString(rows), { layout: iso, rows });

describe('physical topology correspondence', () => {
	test('ortholinear hardware ignores stale ISO and fitting preferences and uses grid slots', () => {
		const config = {
			...createDefaultKeyboardInputConfig(),
			keyboardType: 'ortho' as const,
			topology: 'iso' as const,
			missingKeyPolicy: 'shift' as const
		};
		expect(keyboardInputTopology(config)).toBe('ortho');
		expect(keyboardInputControlLabel(config)).toBe('QWERTY');
		const maps = withKeyboardInputConfig(base, iso, config);
		expect(maps.inputKeyMap?.q).toBe('');
		expect(maps.inputKeyMap?.w).toBe('b');
		expect(maps.inputKeyMap?.z).toBe('q');
		expect(
			topologyPreviewRows(iso, rows, keyboardInputTopology(config), config.missingKeyPolicy)
		).toBeUndefined();
		expect(buildFeelCharMap(base, config, iso).b).toBe('w');
		expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(config)).keyboardType).toBe(
			'ortho'
		);
	});
	test('hardware switches remove the ISO extra slot and label only staggered hardware', () => {
		const ansi = createDefaultKeyboardInputConfig();
		expect(keyboardInputControlLabel(ansi)).toBe('QWERTY (ANSI)');
		const iso = setKeyboardInputTopology(ansi, 'iso');
		expect(keyboardInputControlLabel(iso)).toBe('QWERTY UK (ISO)');
		const ortho = setKeyboardInputType(iso, 'ortho');
		expect(ortho.keys.some((key) => key.slot === '2,10')).toBe(false);
		expect(keyboardInputControlLabel(ortho)).toBe('QWERTY');
		expect(keyboardInputControlLabel(setKeyboardInputType(ortho, 'staggered'))).toBe(
			'QWERTY (ANSI)'
		);
	});

	test('preserves intentional holes in another verified ANSI convention', () => {
		const authoredRows = [" flrbk'gou.", ' shntmwyaei,', ' jxvdqpc z'];
		const keys = authoredRows.flatMap((row, r) =>
			[...row].flatMap((char, col) => (char === ' ' ? [] : [{ char, row: r, col }]))
		);
		const target = decodeLayout([
			'c-minor-ansi',
			'1',
			'2026-11-06',
			0,
			keys.map((key) => key.char),
			keys.map((key) => key.row),
			keys.map((key) => key.col)
		]);
		expect(target.physicalTopology?.topology).toBe('ansi');
		const rows = computeDisplayRows(target);
		const maps = withKeyboardInputConfig(
			createLayoutTestKeyMaps(displayRowsToString(rows), { layout: target, rows }),
			target,
			createDefaultKeyboardInputConfig()
		);
		expect(maps.inputKeyMap?.a).toBe('s');
		expect(maps.inputKeyMap?.[',']).toBe('');
		expect(maps.inputKeyMap?.['.']).toBe('z');
		const preview = topologyPreviewRows(target, rows)!;
		expect(preview[2].find((cell) => cell.displayColumn === 7)?.char).toBe('');
		expect(preview[2].find((cell) => cell.displayColumn === 8)?.char).toBe('z');
	});

	test('does not map ISO extra input onto an unrelated extended grid column', () => {
		const target = decodeLayout(['generic', '1', '2026-11-06', 0, ['a'], [2], [10]]);
		const rows = computeDisplayRows(target);
		const config = updateKeyboardInputKey(
			setKeyboardInputTopology(createDefaultKeyboardInputConfig(), 'iso'),
			'2,10',
			'§'
		);
		const maps = withKeyboardInputConfig(
			createLayoutTestKeyMaps(displayRowsToString(rows), { layout: target, rows }),
			target,
			config
		);
		expect(maps.inputKeyMap?.['§']).toBe('');
	});

	test('corrects both verified coordinate conventions without rewriting authored positions or fingers', () => {
		for (const target of [ansi, iso]) {
			const mapping = resolvePhysicalKeys(target);
			expect(mapping.get('0,1')?.inputSlot).toBe('0,0');
			expect(mapping.get('1,1')?.inputSlot).toBe('1,0');
			expect(target.positionBySlot.get('1,1')).toBe('n');
			expect(target.fingerBySlot?.get('1,1')).toBe('LP');
		}
		expect(resolvePhysicalKeys(iso).get('2,0')?.inputSlot).toBeUndefined();
		expect(resolvePhysicalKeys(iso).get('2,1')?.inputSlot).toBe('2,0');
	});

	test('preserve and shift agree across typing, reachability, Feel and preview', () => {
		const preserve = createDefaultKeyboardInputConfig();
		const shifted = { ...preserve, missingKeyPolicy: 'shift' as const };
		for (const config of [preserve, shifted]) {
			const input = withKeyboardInputConfig(base, iso, config);
			expect(input.inputKeyMap?.q).toBe('b');
			expect(input.inputKeyMap?.a).toBe('n');
			expect(input.inputKeyMap?.z).toBe(config === preserve ? 'x' : 'q');
			expect(input.inputKeyMap?.Z).toBe(config === preserve ? 'X' : 'Q');
			expect(
				resolveLayoutTestKeyDown(
					{
						key: 'a',
						code: 'KeyA',
						shiftKey: false,
						ctrlKey: false,
						altKey: false,
						metaKey: false
					},
					{ keyMaps: input }
				).edit
			).toEqual({ type: 'insert', text: 'n' });
			const reachable = collectReachableTargetCharacters(base, iso, config);
			expect(reachable.has('q')).toBe(config === shifted);
			expect(
				filterWordsByReachableCharacters(
					['quit', 'nice'],
					unreachableTargetLayoutKeys(iso, reachable)
				)
			).toEqual(config === shifted ? ['quit', 'nice'] : ['nice']);
			if (config === preserve) expect(buildFeelCharMap(base, config, iso).q).toBeUndefined();
			else expect(buildFeelCharMap(base, config, iso).q).toBe('z');
			const preview = topologyPreviewRows(iso, rows, config.topology, config.missingKeyPolicy)!;
			const q = preview.flat().find((key) => key.char === 'q')!;
			expect(q.slot).toBe('2,0');
			expect(q.displayColumn).toBe(config === preserve ? -1 : 0);
			expect(Boolean(q.unavailableReason)).toBe(config === preserve);
			expect(preview[0][0].char).toBe('b');
		}
	});

	test('ISO hardware adds an independent extra input without shifting ANSI or shared positions', () => {
		let config = setKeyboardInputTopology(createDefaultKeyboardInputConfig(), 'iso');
		config = updateKeyboardInputKey(config, '2,10', '§');
		expect(keyboardInputRows(config)[2].keys[0].slot).toBe('2,10');
		expect(withKeyboardInputConfig(base, iso, config).inputKeyMap?.['§']).toBe('q');
		expect(withKeyboardInputConfig(base, iso, config).inputKeyMap?.z).toBe('x');
		const ansiRows = computeDisplayRows(ansi);
		const ansiMaps = createLayoutTestKeyMaps(displayRowsToString(ansiRows), {
			layout: ansi,
			rows: ansiRows
		});
		expect(withKeyboardInputConfig(ansiMaps, ansi, config).inputKeyMap?.['§']).toBe('');
		expect(withKeyboardInputConfig(ansiMaps, ansi, config).inputKeyMap?.z).toBe('q');
		expect(parseKeyboardInputConfig(serializeKeyboardInputConfig(config))).toEqual(config);
		expect(
			setKeyboardInputTopology(config, 'ansi').keys.find((key) => key.slot === '2,10')
		).toBeUndefined();
	});

	test('base-layout import maps into selected hardware and retains the policy', () => {
		const config = createKeyboardInputConfigFromLayout(iso, 'staggered', {
			topology: 'iso',
			missingKeyPolicy: 'preserve'
		});
		expect(config.keys.find((key) => key.slot === '0,0')?.value).toBe('b');
		expect(config.keys.find((key) => key.slot === '2,10')?.value).toBe('q');
		const shifted = createKeyboardInputConfigFromLayout(iso, 'staggered', {
			topology: 'ansi',
			missingKeyPolicy: 'shift'
		});
		expect(shifted.keys.find((key) => key.slot === '2,0')?.value).toBe('q');
	});

	test('full ISO bottom rows report overflow without wrapping or overwriting another key', () => {
		const target = {
			...iso,
			positionBySlot: new Map(iso.positionBySlot),
			physicalTopology: {
				topology: 'iso' as const,
				keyBySlot: new Map(iso.physicalTopology!.keyBySlot)
			}
		};
		target.positionBySlot.set('2,10', '/');
		target.physicalTopology.keyBySlot.set('2,10', 'Slash');
		const resolved = resolvePhysicalKeys(target, 'ansi', 'shift');
		expect(resolved.get('2,10')?.inputSlot).toBeUndefined();
		expect(resolved.get('2,10')?.reason).toContain('beyond your keyboard');
		expect(resolved.get('2,10')?.column).toBe(10);
		expect(KEYBOARD_TOPOLOGIES.iso.keys.find((key) => key.id === 'IntlBackslash')?.column).toBe(-1);
	});

	test('unrecognized layouts and changed catalog revisions keep their original slots', () => {
		const changed = easyHarlot('iso');
		changed[0] = 'another-iso';
		const generic = decodeLayout(changed);
		expect(generic.physicalTopology).toBeUndefined();
		expect(resolvePhysicalKeys(generic).get('1,1')?.inputSlot).toBe('1,1');
		const revision = easyHarlot('iso');
		(revision[5] as string[])[0] = '!';
		expect(decodeLayout(revision).physicalTopology).toBeUndefined();
	});
});

test('compact staggered rows use physical columns without changing authored slots', () => {
	for (const topology of ['ansi', 'iso'] as const) {
		const layout = decodeLayout(easyHarlot(topology));
		const rows = computeDisplayRows(layout, 'row-stagger');
		const text = displayRowsToString(rows).split('\n');
		expect(text[0].startsWith('b f r l v')).toBe(true);
		expect(text[1].startsWith(' n s h t d')).toBe(true);
		expect(text[2].startsWith(topology === 'iso' ? 'q x z k m j' : '  q z k m j')).toBe(true);
		expect(rows[1].find((cell) => cell.char === 'n')?.slot).toBe('1,1');
		expect(rows[2].find((cell) => cell.char === 'q')?.slot).toBe(
			topology === 'iso' ? '2,0' : '2,1'
		);
	}
});
