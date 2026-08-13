import type { LayoutData } from '$lib/layout';
import {
	BOARD_CODE,
	LAYOUT_FLAG_ADAPTIVE_SWAP,
	LAYOUT_FLAG_ALL_LETTERS,
	LAYOUT_FLAG_MAGIC_KEY,
	LAYOUT_FLAG_REPEAT_KEY,
	LAYOUT_FLAG_THUMB_KEYS,
	decodeLayout,
	type CompactLayout
} from '$lib/layoutCodec';
import {
	normalizeKeyboardInputValue,
	parseKeyboardInputSlot,
	type KeyboardInputConfig
} from '$lib/keyboardInputConfig';
import { THUMB_ROW } from '$lib/layoutDisplay';

export const LAYOUT_CREATOR_NEW_TAB = 'new';
export const LAYOUT_CREATOR_NEW_LAYOUT_NAME = 'New layout';
export const CREATOR_MAGIC_KEY = '*';

export type LayoutCreatorTabValue = typeof LAYOUT_CREATOR_NEW_TAB | `saved:${string}`;

export type CreatorSpecialKeys = {
	magicKey?: boolean;
	adaptiveKey?: boolean;
};

export type CreateLayoutFromKeyConfigOptions = CreatorSpecialKeys & {
	name?: string;
};

/** Standard stagger QWERTY used as the unsaved creator canvas. */
const DEFAULT_CREATOR_ROWS = [
	['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
	['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
	['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
] as const;

/**
 * Build the in-memory starter layout for a new creation.
 * Saved drafts will replace this factory once local-storage persistence exists.
 */
export function createDefaultCreatorLayout(name = LAYOUT_CREATOR_NEW_LAYOUT_NAME): LayoutData {
	const keyChars: string[] = [];
	const rows: number[] = [];
	const cols: number[] = [];

	for (let row = 0; row < DEFAULT_CREATOR_ROWS.length; row++) {
		for (let col = 0; col < DEFAULT_CREATOR_ROWS[row].length; col++) {
			keyChars.push(DEFAULT_CREATOR_ROWS[row][col]);
			rows.push(row);
			cols.push(col);
		}
	}

	const compact: CompactLayout = [
		name,
		0,
		BOARD_CODE.stagger,
		'',
		LAYOUT_FLAG_ALL_LETTERS,
		keyChars,
		rows,
		cols
	];
	return decodeLayout(compact);
}

export function keyboardConfigHasMagicKey(config: KeyboardInputConfig): boolean {
	return config.keys.some((key) => normalizeKeyboardInputValue(key.value) === CREATOR_MAGIC_KEY);
}

/** Clear `*` from every editor slot so turning Magic off does not leave a trigger on the board. */
export function removeMagicKeysFromConfig(config: KeyboardInputConfig): KeyboardInputConfig {
	let changed = false;
	const keys = config.keys.map((key) => {
		if (normalizeKeyboardInputValue(key.value) !== CREATOR_MAGIC_KEY) return key;
		changed = true;
		return {
			slot: key.slot,
			value: '',
			...(key.inert ? { inert: true } : {}),
			...(key.thumbHand ? { thumbHand: key.thumbHand } : {})
		};
	});
	if (!changed) return config;
	return {
		...config,
		baseLayoutModified: config.baseLayoutName ? true : config.baseLayoutModified,
		keys
	};
}

function extraMagicKeySlot(assigned: readonly { row: number; column: number }[]): {
	row: number;
	column: number;
} {
	const row = 1;
	let maxColumn = -1;
	for (const key of assigned) {
		if (key.row === row) maxColumn = Math.max(maxColumn, key.column);
	}
	return { row, column: maxColumn + 1 };
}

/** Build a draft layout from the creator key editor. Empty slots are omitted. */
export function createLayoutFromKeyConfig(
	config: KeyboardInputConfig,
	options: CreateLayoutFromKeyConfigOptions = {}
): LayoutData {
	const name = options.name ?? LAYOUT_CREATOR_NEW_LAYOUT_NAME;
	const assigned = config.keys.flatMap((key) => {
		const value = normalizeKeyboardInputValue(key.value);
		const position = parseKeyboardInputSlot(key.slot);
		if (!value || !position) return [];
		return [{ value, ...position, thumbHand: key.thumbHand }];
	});

	const keyChars: string[] = [];
	const rows: number[] = [];
	const cols: number[] = [];
	const thumbs: { col: number; hand: 'l' | 'r' }[] = [];

	for (const key of assigned) {
		keyChars.push(key.value);
		rows.push(key.row);
		cols.push(key.column);
		if (key.row >= THUMB_ROW) {
			thumbs.push({
				col: key.column,
				hand: key.thumbHand ?? (key.column < 5 ? 'l' : 'r')
			});
		}
	}

	if (options.magicKey && !keyChars.includes(CREATOR_MAGIC_KEY)) {
		const extra = extraMagicKeySlot(assigned);
		keyChars.push(CREATOR_MAGIC_KEY);
		rows.push(extra.row);
		cols.push(extra.column);
	}

	thumbs.sort((a, b) => a.col - b.col);
	const thumbHands = thumbs.map((thumb) => thumb.hand).join('');

	const letters = new Set<string>();
	for (const key of keyChars) {
		for (const character of key.toLowerCase()) {
			if (character >= 'a' && character <= 'z') letters.add(character);
		}
	}

	let flags = 0;
	if (thumbs.length > 0) flags |= LAYOUT_FLAG_THUMB_KEYS;
	if (letters.size === 26) flags |= LAYOUT_FLAG_ALL_LETTERS;
	if (keyChars.includes(CREATOR_MAGIC_KEY)) flags |= LAYOUT_FLAG_MAGIC_KEY;
	if (keyChars.includes('@')) flags |= LAYOUT_FLAG_REPEAT_KEY;
	if (options.adaptiveKey) flags |= LAYOUT_FLAG_ADAPTIVE_SWAP;

	const compact: CompactLayout = [
		name,
		0,
		config.keyboardType === 'ortho' ? BOARD_CODE.ortho : BOARD_CODE.stagger,
		'',
		flags,
		keyChars,
		rows,
		cols,
		thumbHands || undefined
	];
	return decodeLayout(compact);
}
