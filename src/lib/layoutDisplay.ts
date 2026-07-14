import type { BoardType, KeyInfo } from '$lib/layout';
import { SPLIT_COL } from '$lib/cmini/keyboard';

export const THUMB_ROW = 3;

/** One character in the monospace layout display; `slot` is `"row,col"` for real keys. */
export type DisplayCell = {
	char: string;
	slot: string | null;
};

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

function cell(char: string, slot: string | null = null): DisplayCell {
	return { char, slot };
}

function joinDisplayRowCells(
	slotChars: Array<{ char: string; slot: string | null } | undefined>,
	splitCol: number,
	minCol = 0
): DisplayCell[] {
	const occupiedMax = slotChars.reduce(
		(max, entry, i) => (entry !== undefined && entry.char !== ' ' ? i : max),
		0
	);
	const maxCol = Math.max(minCol, occupiedMax);
	const filled = Array.from({ length: maxCol + 1 }, (_, i) => slotChars[i] ?? { char: ' ', slot: null });
	const left = filled.slice(0, splitCol);
	const right = filled.slice(splitCol);
	const out: DisplayCell[] = [];
	for (let i = 0; i < left.length; i++) {
		if (i > 0) out.push(cell(' '));
		out.push(cell(left[i].char, left[i].slot));
	}
	out.push(cell(' '), cell(' '));
	for (let i = 0; i < right.length; i++) {
		if (i > 0) out.push(cell(' '));
		out.push(cell(right[i].char, right[i].slot));
	}
	return out;
}

/**
 * Place thumb keys under index-finger home columns (left col 3, right col 6).
 */
function formatThumbRowCells(
	entries: DisplayKeyEntry[],
	rowNum: number,
	splitCol: number,
	mainRowMaxCol: number
): DisplayCell[] {
	const { left, right } = splitThumbEntries(entries, splitCol);
	const maxCol = Math.max(mainRowMaxCol, 9, ...entries.map((entry) => entry.col));
	const slots: Array<{ char: string; slot: string | null } | undefined> = Array.from(
		{ length: maxCol + 1 },
		() => undefined
	);

	const leftCols = thumbTargetCols('left', left.length);
	const rightCols = thumbTargetCols('right', right.length);

	for (let i = 0; i < left.length; i++) {
		const entry = left[i];
		slots[leftCols[i]] = { char: entry.key, slot: `${rowNum},${entry.col}` };
	}
	for (let i = 0; i < right.length; i++) {
		const entry = right[i];
		slots[rightCols[i]] = { char: entry.key, slot: `${rowNum},${entry.col}` };
	}

	for (let i = 0; i < slots.length; i++) {
		if (!slots[i]) slots[i] = { char: ' ', slot: null };
	}

	return joinDisplayRowCells(slots, splitCol, mainRowMaxCol);
}

function indentCells(count: number): DisplayCell[] {
	return Array.from({ length: count }, () => cell(' '));
}

/**
 * Monospace layout rows with optional `"row,col"` slots for per-key styling.
 * Keep in sync with historical sync-time formatting (thumb packing + stagger/angle indents).
 */
export function computeDisplayRows(
	layout: {
		keys?: Record<string, DisplayKeyInfo | KeyInfo>;
		board?: BoardType | string;
	},
	splitCol = SPLIT_COL
): DisplayCell[][] {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return [];
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

			let rowCells: DisplayCell[];
			if (rowNum >= THUMB_ROW) {
				rowCells = formatThumbRowCells(entries, rowNum, splitCol, mainRowMaxCol);
			} else {
				const r: Array<{ char: string; slot: string | null } | undefined> = [];
				for (const { key, col } of entries) {
					r[col] = { char: key, slot: `${rowNum},${col}` };
				}
				const maxCol = r.reduce((max, _, i) => (r[i] !== undefined ? i : max), 0);
				const filled = Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? { char: ' ', slot: null });
				rowCells = joinDisplayRowCells(filled, splitCol);
			}

			if (isAnsiDisplay) {
				if (rowNum === 1) {
					return [...indentCells(1), ...rowCells];
				} else if (rowNum === 2) {
					return [...indentCells(2), ...rowCells];
				} else if (rowNum >= THUMB_ROW) {
					// Match home-row indent so thumb keys line up with index columns above
					return [...indentCells(1), ...rowCells];
				}
			}

			return rowCells;
		});

	// Match computeDisplayValue: trim leading whitespace on first row, drop trailing empty rows.
	if (out.length === 0) return out;

	const first = out[0];
	let start = 0;
	while (start < first.length && first[start].char === ' ' && first[start].slot === null) {
		start++;
	}
	out[0] = first.slice(start);

	while (
		out.length > 0 &&
		out[out.length - 1].every((c) => c.char === ' ' && c.slot === null)
	) {
		out.pop();
	}

	return out;
}

/**
 * Computes the monospace display string for a layout from key positions.
 */
export function computeDisplayValue(
	layout: {
		keys?: Record<string, DisplayKeyInfo | KeyInfo>;
		board?: BoardType | string;
	},
	splitCol = SPLIT_COL
): string {
	return computeDisplayRows(layout, splitCol)
		.map((row) => row.map((c) => c.char).join(''))
		.join('\n');
}

function rotateBottomRowLeftHandCells(
	rows: DisplayCell[][],
	direction: 'left' | 'right'
): DisplayCell[][] {
	if (rows.length <= 2) return rows;

	const originalRow = rows[2];
	const leading: DisplayCell[] = [];
	const tokens: DisplayCell[] = [];
	const trailing: DisplayCell[] = [];

	let i = 0;
	while (i < originalRow.length && originalRow[i].char === ' ' && originalRow[i].slot === null) {
		leading.push(originalRow[i]);
		i++;
	}
	let j = originalRow.length - 1;
	while (j >= i && originalRow[j].char === ' ' && originalRow[j].slot === null) {
		trailing.unshift(originalRow[j]);
		j--;
	}

	const middle = originalRow.slice(i, j + 1);
	for (const c of middle) {
		if (c.char !== ' ') tokens.push(c);
	}

	if (tokens.length < SPLIT_COL) return rows;

	const leftHand =
		direction === 'left'
			? [tokens[1], tokens[2], tokens[3], tokens[4], tokens[0]]
			: [tokens[4], tokens[0], tokens[1], tokens[2], tokens[3]];
	const transformed = [...leftHand, ...tokens.slice(SPLIT_COL)];

	const rebuilt: DisplayCell[] = [...leading];
	for (let t = 0; t < transformed.length; t++) {
		rebuilt.push(transformed[t]);
		if (t === SPLIT_COL - 1) {
			rebuilt.push(cell(' '), cell(' '));
		} else if (t < transformed.length - 1) {
			rebuilt.push(cell(' '));
		}
	}
	rebuilt.push(...trailing);

	return [...rows.slice(0, 2), rebuilt, ...rows.slice(3)];
}

/** Anglemod left-rotate of bottom-row left hand, preserving slot metadata. */
export function applyAnglemodToDisplayRows(rows: DisplayCell[][]): DisplayCell[][] {
	return rotateBottomRowLeftHandCells(rows, 'left');
}

/** Undo anglemod on structured rows. */
export function removeAnglemodFromDisplayRows(rows: DisplayCell[][]): DisplayCell[][] {
	return rotateBottomRowLeftHandCells(rows, 'right');
}

export function displayRowsToString(rows: DisplayCell[][]): string {
	return rows.map((row) => row.map((c) => c.char).join('')).join('\n');
}

/** True when this slot's character differs from the reference layout. */
export function isSimilarDiffSlot(
	slot: string | null,
	char: string,
	referencePositions: Map<string, string> | null | undefined
): boolean {
	if (!slot || !referencePositions) return false;
	const referenceChar = referencePositions.get(slot);
	if (referenceChar === undefined) return true;
	return referenceChar !== char;
}
