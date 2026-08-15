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
import { DEFAULT_REPEAT_KEY } from '$lib/repeatKeys';

export const LAYOUT_CREATOR_NEW_TAB = 'new';
export const LAYOUT_CREATOR_NEW_LAYOUT_NAME = 'New layout';
export const CREATOR_MAGIC_KEY = '*';
const TRAILING_COPY_NUMBER = /^(.*)\s(\d+)$/;

/** Next name for a duplicated layout: increment a trailing copy number, or append 2. */
export function nextDuplicatedLayoutName(name: string): string {
	const trimmed = name.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME;
	const match = trimmed.match(TRAILING_COPY_NUMBER);
	if (!match) return `${trimmed} 2`;
	return `${match[1]} ${Number(match[2]) + 1}`;
}
/** Summary-card subtitle when a local draft has no analyzer stats. */
export const LOCAL_LAYOUT_STATS_UNAVAILABLE_DETAIL = 'Local layouts have no analyzer stats.';

export type LayoutCreatorTabValue = typeof LAYOUT_CREATOR_NEW_TAB | `saved:${string}`;

export function savedCreatorTabValue(id: string): LayoutCreatorTabValue {
	return `saved:${id}`;
}

export function savedCreatorTabId(id: string): string {
	return `layout-creator-tab-saved-${id}`;
}

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

/** Build the in-memory starter layout for a new creation. */
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

export function keyboardConfigHasMagicTrigger(config: KeyboardInputConfig): boolean {
	return config.keys.some((key) => {
		const value = normalizeKeyboardInputValue(key.value);
		return value === CREATOR_MAGIC_KEY || value === DEFAULT_REPEAT_KEY;
	});
}

/** Triggers newly assigned on a slot. Clearing a slot never appears here. */
export function keyboardConfigGainedMagicTriggers(
	previous: KeyboardInputConfig,
	next: KeyboardInputConfig
): string[] {
	const previousBySlot = new Map(
		previous.keys.map((key) => [key.slot, normalizeKeyboardInputValue(key.value)])
	);
	const gained: string[] = [];
	for (const key of next.keys) {
		const value = normalizeKeyboardInputValue(key.value);
		if (value !== CREATOR_MAGIC_KEY && value !== DEFAULT_REPEAT_KEY) continue;
		if (previousBySlot.get(key.slot) === value) continue;
		if (!gained.includes(value)) gained.push(value);
	}
	return gained;
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

/** Add an editable `*` key after the home row unless the board already has a Magic trigger. */
export function addMagicKeyToConfig(config: KeyboardInputConfig): KeyboardInputConfig {
	if (keyboardConfigHasMagicTrigger(config)) return config;
	const assigned = config.keys.flatMap((key) => {
		const position = parseKeyboardInputSlot(key.slot);
		return position ? [position] : [];
	});
	const slot = extraMagicKeySlot(assigned);
	return {
		...config,
		baseLayoutModified: config.baseLayoutName ? true : config.baseLayoutModified,
		keys: [...config.keys, { slot: `${slot.row},${slot.column}`, value: CREATOR_MAGIC_KEY }]
	};
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
	if (options.magicKey || keyChars.includes(CREATOR_MAGIC_KEY)) flags |= LAYOUT_FLAG_MAGIC_KEY;
	if (keyChars.includes(DEFAULT_REPEAT_KEY)) flags |= LAYOUT_FLAG_REPEAT_KEY;
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
