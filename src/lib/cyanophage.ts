import type { BoardType, KeyInfo } from '$lib/layout';

/**
 * Cyanophage layout param: 34 chars in fixed QWERTY physical key order, then importLayout()
 * swaps rcdata slots positionally. See cyanophage keyboard_svg.js exportLayout/importLayout.
 */

const CYAN_DEFAULTS =
	'qwertyuiop-asdfghjkl;\'zxcvbnm,./\\^';

type CyanSlot = { row: number; col: number; defaultChar?: string } | { defaultChar: string };

function buildKeyGrid(keys: Record<string, KeyInfo>): Map<string, string> {
	const grid = new Map<string, string>();
	for (const [char, { row, col }] of Object.entries(keys)) {
		grid.set(`${row},${col}`, char);
	}
	return grid;
}

function getKeyAt(grid: Map<string, string>, row: number, col: number): string | undefined {
	return grid.get(`${row},${col}`);
}

/** Ergo / ortho / mini: 3×10 grid + punctuation column + \\^ thumb defaults. */
function getErgoSlots(): CyanSlot[] {
	const slots: CyanSlot[] = [];
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 0, col, defaultChar: col === 10 ? '-' : undefined });
	}
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 1, col, defaultChar: col === 10 ? "'" : undefined });
	}
	for (let col = 0; col < 10; col++) {
		slots.push({ row: 2, col });
	}
	slots.push({ defaultChar: '\\' }, { defaultChar: '^' });
	return slots;
}

/**
 * ANSI / ISO stagger: wider top row — index 32 is the backslash-key cap (cmini row 0 col 11).
 */
function getStaggeredSlots(): CyanSlot[] {
	const slots: CyanSlot[] = [];
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 0, col, defaultChar: col === 10 ? '-' : undefined });
	}
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 1, col, defaultChar: col === 10 ? "'" : undefined });
	}
	for (let col = 0; col < 10; col++) {
		slots.push({ row: 2, col });
	}
	slots.push({ row: 0, col: 11, defaultChar: '\\' }, { defaultChar: '^' });
	return slots;
}

function getSlotsForBoard(board: BoardType): CyanSlot[] {
	switch (board) {
		case 'stagger':
		case 'angle':
			return getStaggeredSlots();
		case 'ortho':
		case 'mini':
		default:
			return getErgoSlots();
	}
}

function formatFromSlots(keys: Record<string, KeyInfo>, board: BoardType): string {
	const grid = buildKeyGrid(keys);
	const slots = getSlotsForBoard(board);

	return slots
		.map((slot, index) => {
			if ('row' in slot) {
				return getKeyAt(grid, slot.row, slot.col) ?? slot.defaultChar ?? CYAN_DEFAULTS[index] ?? '';
			}
			return slot.defaultChar;
		})
		.join('');
}

/**
 * Fallback when keys are missing: parse displayValue the ortho way (legacy).
 */
function formatLayoutFromDisplayValue(displayValue: string): string {
	const grid = displayValue
		.split('\n')
		.map((row) => row.split(/\s+/).filter((char) => char.length > 0));
	const chars: string[] = [];

	const pushRow = (row: number, punctuationDefault: string) => {
		for (let col = 0; col < 10; col++) {
			const char = grid[row]?.[col];
			if (!char) return false;
			chars.push(char);
		}
		chars.push(grid[row]?.[10] ?? punctuationDefault);
		return true;
	};

	if (!pushRow(0, '-')) return displayValue.replace(/\s+/g, '');
	if (!pushRow(1, "'")) return displayValue.replace(/\s+/g, '');

	for (let col = 0; col < 10; col++) {
		const char = grid[2]?.[col];
		if (!char) return displayValue.replace(/\s+/g, '');
		chars.push(char);
	}

	chars.push('\\', '^');
	return chars.join('');
}

export function formatLayoutForCyanophage(
	keys: Record<string, KeyInfo>,
	board: BoardType,
	displayValue?: string
): string {
	if (!keys || Object.keys(keys).length === 0) {
		return displayValue ? formatLayoutFromDisplayValue(displayValue) : '';
	}
	return formatFromSlots(keys, board);
}

export function buildCyanophagePlaygroundUrl(
	keys: Record<string, KeyInfo>,
	board: BoardType,
	displayValue?: string
): string {
	const mode = board === 'stagger' ? 'ansi' : board === 'angle' ? 'iso' : 'ergo';
	const layoutParam = formatLayoutForCyanophage(keys, board, displayValue);
	const encodedLayout = encodeURIComponent(layoutParam);
	return `https://cyanophage.github.io/playground.html?layout=${encodedLayout}&mode=${mode}&lan=english&thumb=l`;
}
