import { expect, test } from 'bun:test';
import { createLayoutFromSparkKeys } from '$lib/creatorGeometry';
import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';

test('Spark geometry preserves primary source order, physical duplicates, gaps, and thumb hands', () => {
	const layout = createLayoutFromSparkKeys([
		{ row: 1, col: 9, char: 'a', finger: 'LI' },
		{ row: 1, col: 0, char: 'a', finger: 'LP' },
		{ row: 1, col: 2, char: 'b', finger: 'LM' },
		{ row: 3, col: 0, char: 'e', finger: 'LT' },
		{ row: 3, col: 1, char: 'e', finger: 'RT' },
		{ row: -1, col: 0, char: '1', finger: 'LP' },
		{ row: 0, col: 1, finger: 'LR' }
	]);
	expect(layout.keys.a).toEqual({ row: 1, col: 9, hand: 'l' });
	expect(layout.keys.e).toEqual({ row: 3, col: 0, hand: 'l', thumbHand: 'l' });
	expect(layout.thumbKeysByHand).toEqual({ l: [{ key: 'e', col: 0 }], r: [{ key: 'e', col: 1 }] });
	expect(layout.positionBySlot.has('0,1')).toBe(false);
	expect(layout.keys['1']).toBeUndefined();
	const rows = computeDisplayRows(layout);
	const maps = createLayoutTestKeyMaps(displayRowsToString(rows), { layout, rows });
	expect(maps.slotKeyMap?.['1,0']).toBe('a');
	expect(maps.slotKeyMap?.['1,2']).toBe('b');
	expect(maps.slotKeyMap?.['1,9']).toBe('a');
});

test('runtime geometry keeps ASCII key normalization without changing canonical source', () => {
	const keys = [{ row: 0, col: 0, char: 'Q', finger: 'LP' as const }];
	const layout = createLayoutFromSparkKeys(keys);
	expect(layout.positionBySlot.get('0,0')).toBe('q');
	expect(layout.keys.q).toEqual({ row: 0, col: 0, hand: 'l' });
	expect(keys[0].char).toBe('Q');
});
