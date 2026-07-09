import type { BoardType, KeyInfo, LayoutData, ThumbKeyEntry } from '$lib/layout';

/** Keep in sync with BOARD_TYPES in bin/layout-codec.js */
export const BOARD_TYPES = ['angle', 'stagger', 'ortho', 'mini'] as const satisfies readonly BoardType[];

export const BOARD_CODE: Record<BoardType, number> = {
	angle: 0,
	stagger: 1,
	ortho: 2,
	mini: 3
};

export const LAYOUT_FLAG_THUMB_KEYS = 1;
export const LAYOUT_FLAG_ALL_LETTERS = 2;
export const LAYOUT_FLAG_MAGIC_KEY = 4;
export const LAYOUT_FLAG_INTERNATIONAL = 8;
export const LAYOUT_FLAG_CYANOPHAGE_COMPATIBLE = 16;
export const LAYOUT_FLAG_CYANOPHAGE_THUMB_RIGHT = 32;

export const COMPACT_LAYOUT_FIELD_COUNT = 10;

/** Thumb row index and default hand split (matches filterStore / keyboard). */
const THUMB_ROW = 3;
const THUMB_SPLIT_COL = 5;

/** Wire format for one layout in all-layouts.json */
export type CompactLayout = [
	name: string,
	user: number,
	board: number,
	updatedAt: string,
	flags: number,
	keyChars: string[],
	rows: number[],
	cols: number[],
	displayValue: string,
	/** Thumb keys in column order: 'l' or 'r' per thumb key. */
	thumbHands?: string
];

export type CompactLayoutFile = CompactLayout[];

export function positionSlotKey(row: number, col: number): string {
	return `${row},${col}`;
}

export function decodeLayout(entry: CompactLayout): LayoutData {
	const [name, user, boardCode, updatedAt, flags, keyChars, rows, cols, displayValue, thumbHands] =
		entry;

	const keys: Record<string, KeyInfo> = {};
	const positionBySlot = new Map<string, string>();
	const thumbIndices: number[] = [];
	for (let i = 0; i < keyChars.length; i++) {
		const keyInfo: KeyInfo = { row: rows[i], col: cols[i] };
		if (rows[i] >= THUMB_ROW) {
			thumbIndices.push(i);
		}
		keys[keyChars[i]] = keyInfo;
		positionBySlot.set(positionSlotKey(rows[i], cols[i]), keyChars[i]);
	}

	if (thumbHands && thumbIndices.length > 0) {
		thumbIndices.sort((a, b) => cols[a] - cols[b]);
		for (let j = 0; j < thumbIndices.length; j++) {
			const hand = thumbHands[j] === 'r' ? 'r' : 'l';
			keys[keyChars[thumbIndices[j]]].thumbHand = hand;
		}
	}

	const thumbKeysByHand: { l: ThumbKeyEntry[]; r: ThumbKeyEntry[] } = { l: [], r: [] };
	for (const [key, info] of Object.entries(keys)) {
		if (info.row < THUMB_ROW) continue;
		const hand = info.thumbHand ?? (info.col < THUMB_SPLIT_COL ? 'l' : 'r');
		thumbKeysByHand[hand].push({ key: key.toLowerCase(), col: info.col });
	}
	thumbKeysByHand.l.sort((a, b) => a.col - b.col);
	thumbKeysByHand.r.sort((a, b) => a.col - b.col);

	return {
		name,
		user,
		board: BOARD_TYPES[boardCode] ?? 'ortho',
		keys,
		positionBySlot,
		thumbKeysByHand,
		displayValue,
		hasThumbKeys: (flags & LAYOUT_FLAG_THUMB_KEYS) !== 0,
		hasAllLetters: (flags & LAYOUT_FLAG_ALL_LETTERS) !== 0,
		hasMagicKey: (flags & LAYOUT_FLAG_MAGIC_KEY) !== 0,
		characterSet: (flags & LAYOUT_FLAG_INTERNATIONAL) !== 0 ? 'international' : 'english',
		cyanophageCompatible: (flags & LAYOUT_FLAG_CYANOPHAGE_COMPATIBLE) !== 0,
		cyanophageThumb:
			(flags & LAYOUT_FLAG_CYANOPHAGE_COMPATIBLE) !== 0 &&
			(flags & LAYOUT_FLAG_CYANOPHAGE_THUMB_RIGHT) !== 0
				? 'r'
				: (flags & LAYOUT_FLAG_CYANOPHAGE_COMPATIBLE) !== 0
					? 'l'
					: undefined,
		updatedAt
	};
}

export function decodeLayouts(entries: CompactLayoutFile): LayoutData[] {
	return entries.map(decodeLayout);
}
