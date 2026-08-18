import { describe, expect, test } from 'bun:test';
import {
	clearKeyboardInputConfig,
	createDefaultKeyboardInputConfig,
	updateKeyboardInputKey,
	type KeyboardInputConfig
} from '../src/lib/keyboardInputConfig';
import { createLayoutFromKeyConfig } from '../src/lib/layoutCreator';
import {
	applyAnglemodToDisplayRows,
	ansiThumbDisplayColumn,
	ansiThumbOffsetCss,
	computeDisplayRows,
	fillPreviewKeyboardRows,
	removeAnglemodFromDisplayRows,
	splitThumbDisplayKeys,
	thumbTargetColumns,
	type DisplayCell
} from '../src/lib/layoutDisplay';

function previewRowsFromConfig(
	update: (config: KeyboardInputConfig) => KeyboardInputConfig
): DisplayCell[][] {
	const layout = createLayoutFromKeyConfig(update(createDefaultKeyboardInputConfig()));
	return fillPreviewKeyboardRows(computeDisplayRows(layout));
}

function slottedRow(rows: DisplayCell[][], rowNumber: number): DisplayCell[] {
	return (
		rows.find((row) => row.some((cell) => cell.slot?.startsWith(`${rowNumber},`))) ?? []
	).filter((cell): cell is DisplayCell & { slot: string } => cell.slot !== null);
}

describe('thumbTargetColumns', () => {
	test('places a single pair under the index-finger columns with a gap between them', () => {
		expect(thumbTargetColumns('left', 1)).toEqual([3]);
		expect(thumbTargetColumns('right', 1)).toEqual([6]);
	});

	test('grows extra thumbs outward from those index columns', () => {
		expect(thumbTargetColumns('left', 2)).toEqual([3, 4]);
		expect(thumbTargetColumns('left', 3)).toEqual([2, 3, 4]);
		expect(thumbTargetColumns('right', 2)).toEqual([6, 7]);
		expect(thumbTargetColumns('right', 3)).toEqual([6, 7, 8]);
	});
});

describe('ansiThumbDisplayColumn', () => {
	test('shifts stagger thumbs a half column so they sit between bottom-row index keys', () => {
		expect(ansiThumbDisplayColumn(3)).toBe(2.5);
		expect(ansiThumbDisplayColumn(6)).toBe(5.5);
	});
});

describe('ansiThumbOffsetCss', () => {
	test('uses the same size and gap formula as the presentation keyboard', () => {
		expect(ansiThumbOffsetCss(2.5, 'var(--preview-key-size)', 'var(--preview-key-gap)')).toBe(
			'calc(var(--preview-key-size) * 3.18 + var(--preview-key-gap) * 2.5)'
		);
	});
});

describe('anglemod display rows', () => {
	test('rotates characters while keeping them attached to their visual slots', () => {
		const layout = createLayoutFromKeyConfig(createDefaultKeyboardInputConfig());
		const rows = computeDisplayRows(layout);
		const applied = applyAnglemodToDisplayRows(rows);

		expect(
			slottedRow(applied, 2)
				.slice(0, 5)
				.map(({ char, slot }) => ({ char, slot }))
		).toEqual([
			{ char: 'x', slot: '2,0' },
			{ char: 'c', slot: '2,1' },
			{ char: 'v', slot: '2,2' },
			{ char: 'b', slot: '2,3' },
			{ char: 'z', slot: '2,4' }
		]);
		expect(
			slottedRow(removeAnglemodFromDisplayRows(applied), 2)
				.slice(0, 5)
				.map(({ char }) => char)
		).toEqual(['z', 'x', 'c', 'v', 'b']);
	});
});

describe('splitThumbDisplayKeys', () => {
	test('keeps duplicate thumb letters on their assigned hands', () => {
		const keys = [
			{ char: 'e', slot: '3,0' },
			{ char: 'e', slot: '3,1' }
		];
		const split = splitThumbDisplayKeys(keys, {
			l: [{ key: 'e', col: 0 }],
			r: [{ key: 'e', col: 1 }]
		});

		expect(split.left).toEqual([{ char: 'e', slot: '3,0' }]);
		expect(split.right).toEqual([{ char: 'e', slot: '3,1' }]);
		expect(thumbTargetColumns('left', split.left.length)).toEqual([3]);
		expect(thumbTargetColumns('right', split.right.length)).toEqual([6]);
	});
});

function emptyLetterRow(row: number): DisplayCell[] {
	return Array.from({ length: 10 }, (_, col) => ({ char: '', slot: `${row},${col}` }));
}

describe('fillPreviewKeyboardRows', () => {
	test('places empty keys around a lone letter so it keeps its column', () => {
		const rows = previewRowsFromConfig((config) =>
			updateKeyboardInputKey(clearKeyboardInputConfig(config), '0,2', 'e')
		);

		expect(slottedRow(rows, 0)).toEqual([
			{ char: '', slot: '0,0' },
			{ char: '', slot: '0,1' },
			{ char: 'e', slot: '0,2' },
			...emptyLetterRow(0).slice(3)
		]);
		expect(slottedRow(rows, 1)).toEqual(emptyLetterRow(1));
		expect(slottedRow(rows, 2)).toEqual(emptyLetterRow(2));
	});

	test('fills an unassigned key between letters and pads the letter row to 10', () => {
		const rows = previewRowsFromConfig((config) => {
			const cleared = clearKeyboardInputConfig(config);
			return updateKeyboardInputKey(updateKeyboardInputKey(cleared, '0,0', 'q'), '0,2', 'e');
		});

		expect(slottedRow(rows, 0)).toEqual([
			{ char: 'q', slot: '0,0' },
			{ char: '', slot: '0,1' },
			{ char: 'e', slot: '0,2' },
			...emptyLetterRow(0).slice(3)
		]);
	});

	test('keeps a complete home row unchanged', () => {
		const rows = previewRowsFromConfig((config) => config);

		expect(slottedRow(rows, 1).slice(0, 10)).toEqual([
			{ char: 'a', slot: '1,0' },
			{ char: 's', slot: '1,1' },
			{ char: 'd', slot: '1,2' },
			{ char: 'f', slot: '1,3' },
			{ char: 'g', slot: '1,4' },
			{ char: 'h', slot: '1,5' },
			{ char: 'j', slot: '1,6' },
			{ char: 'k', slot: '1,7' },
			{ char: 'l', slot: '1,8' },
			{ char: ';', slot: '1,9' }
		]);
	});

	test('does not invent empty thumb keys', () => {
		const rows = previewRowsFromConfig((config) =>
			updateKeyboardInputKey(clearKeyboardInputConfig(config), '3,0', 'e')
		);

		expect(slottedRow(rows, 3)).toEqual([{ char: 'e', slot: '3,0' }]);
	});

	test('shows the three letter rows on an empty board', () => {
		expect(fillPreviewKeyboardRows([])).toEqual([
			emptyLetterRow(0),
			emptyLetterRow(1),
			emptyLetterRow(2)
		]);
	});

	test('is unchanged when applied twice', () => {
		const once = previewRowsFromConfig((config) =>
			updateKeyboardInputKey(clearKeyboardInputConfig(config), '0,2', 'e')
		);

		expect(fillPreviewKeyboardRows(once)).toEqual(once);
	});
});
