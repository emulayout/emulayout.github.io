import type { BoardType, KeyInfo } from '$lib/layout';
import { SPLIT_COL } from '$lib/cmini/keyboard';

export const THUMB_ROW = 3;

type DisplayKeyInfo = {
	row: number;
	col: number;
	thumbHand?: 'l' | 'r';
	finger?: string;
};

type DisplayKeyEntry = {
	key: string;
	col: number;
	thumbHand?: 'l' | 'r';
	finger?: string;
};

/**
 * @param {string | undefined} finger
 * @returns {'left' | 'right' | null}
 */
function thumbHandFromFinger(finger: string | undefined): 'left' | 'right' | null {
	if (!finger || typeof finger !== 'string') return null;
	if (finger[0] === 'L') return 'left';
	if (finger[0] === 'R') return 'right';
	return null;
}

function resolveThumbSide(
	entry: DisplayKeyEntry,
	splitCol: number
): 'left' | 'right' {
	if (entry.thumbHand === 'l') return 'left';
	if (entry.thumbHand === 'r') return 'right';
	const fromFinger = thumbHandFromFinger(entry.finger);
	if (fromFinger) return fromFinger;
	return entry.col < splitCol ? 'left' : 'right';
}

/**
 * @param {DisplayKeyEntry[]} entries
 * @param {number} splitCol
 */
function splitThumbEntries(entries: DisplayKeyEntry[], splitCol: number) {
	const left: DisplayKeyEntry[] = [];
	const right: DisplayKeyEntry[] = [];
	for (const entry of entries) {
		if (resolveThumbSide(entry, splitCol) === 'left') {
			left.push(entry);
		} else {
			right.push(entry);
		}
	}
	left.sort((a, b) => a.col - b.col);
	right.sort((a, b) => a.col - b.col);
	return { left, right };
}

/**
 * Thumb columns aligned with index-finger home positions (cols 3 and 6).
 * Left: 1 key → col 3; 2 keys → cols 3–4; 3 keys → cols 2–4; …
 * Right: 1 key → col 6; 2 keys → cols 6–7; 3 keys → cols 6–8; …
 */
function thumbTargetCols(hand: 'left' | 'right', count: number): number[] {
	if (count === 0) return [];

	if (hand === 'left') {
		if (count === 1) return [3];
		const startCol = 4 - (count - 1);
		return Array.from({ length: count }, (_, i) => startCol + i);
	}

	const start = 6;
	return Array.from({ length: count }, (_, i) => start + i);
}

function joinDisplayRow(slots: string[], splitCol: number, minCol = 0): string {
	const occupiedMax = slots.reduce(
		(max, _, i) => (slots[i] !== undefined && slots[i] !== ' ' ? i : max),
		0
	);
	const maxCol = Math.max(minCol, occupiedMax);
	const filled = Array.from({ length: maxCol + 1 }, (_, i) => slots[i] ?? ' ');
	return filled.slice(0, splitCol).join(' ') + '  ' + filled.slice(splitCol).join(' ');
}

/**
 * Place thumb keys under index-finger home columns (left col 3, right col 6).
 */
function formatThumbRow(
	entries: DisplayKeyEntry[],
	splitCol: number,
	mainRowMaxCol: number
): string {
	const { left, right } = splitThumbEntries(entries, splitCol);
	const maxCol = Math.max(mainRowMaxCol, 9, ...entries.map((entry) => entry.col));
	const slots = Array.from({ length: maxCol + 1 }, () => ' ');

	const leftCols = thumbTargetCols('left', left.length);
	const rightCols = thumbTargetCols('right', right.length);

	for (let i = 0; i < left.length; i++) {
		slots[leftCols[i]] = left[i].key;
	}
	for (let i = 0; i < right.length; i++) {
		slots[rightCols[i]] = right[i].key;
	}

	return joinDisplayRow(slots, splitCol, mainRowMaxCol);
}

/**
 * Computes the monospace display string for a layout from key positions.
 * Keep in sync with historical sync-time formatting (thumb packing + stagger/angle indents).
 */
export function computeDisplayValue(
	layout: {
		keys?: Record<string, DisplayKeyInfo | KeyInfo>;
		board?: BoardType | string;
	},
	splitCol = SPLIT_COL
): string {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return '';
	}

	/** @type {Record<number, DisplayKeyEntry[]>} */
	const rows: Record<number, DisplayKeyEntry[]> = {};
	for (const [key, info] of Object.entries(layout.keys)) {
		if (!info || typeof info.row !== 'number' || typeof info.col !== 'number') continue;
		if (!rows[info.row]) rows[info.row] = [];
		rows[info.row].push({
			key,
			col: info.col,
			thumbHand: info.thumbHand,
			finger: 'finger' in info ? (info.finger as string | undefined) : undefined
		});
	}

	const isAnsiDisplay = layout.board === 'stagger' || layout.board === 'angle';

	let mainRowMaxCol = 0;
	for (const [row, entries] of Object.entries(rows)) {
		if (Number(row) >= THUMB_ROW) continue;
		for (const { col } of entries) {
			mainRowMaxCol = Math.max(mainRowMaxCol, col);
		}
	}

	const out = Object.keys(rows)
		.sort((a, b) => Number(a) - Number(b))
		.map((row) => {
			const rowNum = Number(row);
			const entries = rows[rowNum];

			let rowString: string;
			if (rowNum >= THUMB_ROW) {
				rowString = formatThumbRow(entries, splitCol, mainRowMaxCol);
			} else {
				const r: string[] = [];
				for (const { key, col } of entries) {
					r[col] = key;
				}
				const maxCol = r.reduce((max, _, i) => (r[i] !== undefined ? i : max), 0);
				const filled = Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? ' ');
				rowString =
					filled.slice(0, splitCol).join(' ') + '  ' + filled.slice(splitCol).join(' ');
			}

			if (isAnsiDisplay) {
				if (rowNum === 1) {
					return ' ' + rowString;
				} else if (rowNum === 2) {
					return '  ' + rowString;
				} else if (rowNum >= THUMB_ROW) {
					// Match home-row indent so thumb keys line up with index columns above
					return ' ' + rowString;
				}
			}

			return rowString;
		})
		.join('\n');

	return out.trimStart().replace(/\n+$/, '');
}
