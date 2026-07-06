import type { BoardType, KeyInfo, LayoutData } from '$lib/layout';

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

export function decodeLayout(entry: CompactLayout): LayoutData {
	const [name, user, boardCode, updatedAt, flags, keyChars, rows, cols, displayValue, thumbHands] =
		entry;

	const keys: Record<string, KeyInfo> = {};
	const thumbIndices: number[] = [];
	for (let i = 0; i < keyChars.length; i++) {
		const keyInfo: KeyInfo = { row: rows[i], col: cols[i] };
		if (rows[i] >= 3) {
			thumbIndices.push(i);
		}
		keys[keyChars[i]] = keyInfo;
	}

	if (thumbHands && thumbIndices.length > 0) {
		thumbIndices.sort((a, b) => cols[a] - cols[b]);
		for (let j = 0; j < thumbIndices.length; j++) {
			const hand = thumbHands[j] === 'r' ? 'r' : 'l';
			keys[keyChars[thumbIndices[j]]].thumbHand = hand;
		}
	}

	return {
		name,
		user,
		board: BOARD_TYPES[boardCode] ?? 'ortho',
		keys,
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
