import { expect, test } from 'bun:test';
import {
	inferCatalogKeyboardTopology,
	validateCatalogKeyboardTopology
} from '$lib/catalogKeyboardTopologies';
import { decodeLayout } from '$lib/layoutCodec';
import { resolvePhysicalKeys } from '$lib/keyboardTopology';

function positions(rows: string[]) {
	return rows.flatMap((row, r) =>
		[...row].flatMap((char, col) => (char === ' ' ? [] : [{ char, row: r, col }]))
	);
}
const burnt = [" flrbk'wou.", ' shntmgyaei,', 'zjxvdqpc'];
const ring = [" jhrbk'wou.", ' slntmgyaie', 'zfxvdqpc ,'];
function slots(rows: string[]) {
	return new Map(positions(rows).map((key) => [`${key.row},${key.col}`, key.char]));
}

test('new ISO names, letter changes, ring variants and holes require no registry entries', () => {
	for (const name of ['burnt-iso', 'future-layout-iso', 'future-isomtr']) {
		for (const rows of [burnt, ring, [' flhbqjwau.', ' srntkgyoie', "zvxdm pc',"]]) {
			expect(inferCatalogKeyboardTopology(name, slots(rows))).toEqual({
				topology: 'iso',
				coordinates: 'offset-v1'
			});
		}
	}
	expect(
		inferCatalogKeyboardTopology('future-ansi', slots([burnt[0], burnt[1], ' jxvdqpcz']))?.topology
	).toBe('ansi');
});

test('markers and coordinate structure must agree; sparse and ordinary grids are untouched', () => {
	expect(
		inferCatalogKeyboardTopology('stand-iso', slots(['fmpwvzjou.', 'stndyxraei', "qkbcglh'/,"]))
	).toBeUndefined();
	expect(inferCatalogKeyboardTopology('example-ortho', slots(burnt))).toBeUndefined();
	expect(inferCatalogKeyboardTopology('no-marker', slots(burnt))).toBeUndefined();
	expect(inferCatalogKeyboardTopology('example-ansi', slots(burnt))).toBeUndefined();
	expect(
		inferCatalogKeyboardTopology('example-iso', slots([burnt[0], ' shntmgyae', burnt[2]]))
	).toBeUndefined();
	expect(
		inferCatalogKeyboardTopology('example-iso', slots([burnt[0], burnt[1], burnt[2] + '    /']))
	).toBeUndefined();
	for (const invalid of [
		null,
		{},
		{ topology: 'iso', coordinates: 'future' },
		{ topology: 'ortho', coordinates: 'offset-v1' }
	]) {
		expect(validateCatalogKeyboardTopology(invalid, slots(burnt))).toBeUndefined();
	}
});

test('sync publishes metadata and current/legacy clients preserve authored slots and fingers', () => {
	const source = {
		name: 'brand-new-iso',
		user: '1',
		positions: positions(ring).map((key) => ({ ...key, finger: 'LP' }))
	};
	const result = Bun.spawnSync([
		process.execPath,
		'-e',
		`import {encodeLayout} from './bin/layout-codec.js'; console.log(JSON.stringify(encodeLayout(${JSON.stringify(source)})));`
	]);
	expect(result.exitCode).toBe(0);
	const wire = JSON.parse(result.stdout.toString());
	expect(wire[9].keyboardTopology).toEqual({ topology: 'iso', coordinates: 'offset-v1' });
	for (const entry of [wire, [wire[0], wire[1], ...wire.slice(3)]]) {
		const layout = decodeLayout(entry);
		expect(layout.positionBySlot.get('2,9')).toBe(',');
		expect(layout.fingerBySlot?.get('2,9')).toBe('LP');
		expect(resolvePhysicalKeys(layout, 'iso').get('1,1')?.inputSlot).toBe('1,0');
		expect(resolvePhysicalKeys(layout, 'iso').get('2,0')?.physicalId).toBe('IntlBackslash');
		expect(resolvePhysicalKeys(layout, 'ansi', 'preserve').get('2,0')?.inputSlot).toBeUndefined();
		expect(resolvePhysicalKeys(layout, 'ansi', 'shift').get('2,0')?.inputSlot).toBe('2,0');
	}
	// Explicit, valid metadata is independent of the display name.
	wire[0] = 'renamed without a marker';
	expect(decodeLayout(wire).physicalTopology?.topology).toBe('iso');
	wire[9].keyboardTopology.coordinates = 'future';
	expect(decodeLayout(wire).physicalTopology).toBeUndefined();
	// Old published catalogs get identical behavior from the shared fallback.
	wire[0] = 'brand-new-iso';
	delete wire[9].keyboardTopology;
	expect(decodeLayout(wire).physicalTopology?.topology).toBe('iso');
});
