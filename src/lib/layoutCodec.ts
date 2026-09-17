import type { AuthorId, KeyInfo, LayoutData, ThumbKeyEntry } from '$lib/layout';
import { computeCharacterSet } from '$lib/layoutCharacterSet';
import { THUMB_ROW } from '$lib/layoutDisplay';

export const LAYOUT_FLAG_THUMB_KEYS = 1;
export const LAYOUT_FLAG_ALL_LETTERS = 2;
export const LAYOUT_FLAG_MAGIC_KEY = 4;
export const LAYOUT_FLAG_INTERNATIONAL = 8;
export const LAYOUT_FLAG_CYANOPHAGE_COMPATIBLE = 16;
export const LAYOUT_FLAG_CYANOPHAGE_THUMB_RIGHT = 32;
export const LAYOUT_FLAG_MAGIC_KEY_MAPPINGS = 64;
export const LAYOUT_FLAG_ADAPTIVE_SWAP_MAPPINGS = 128;
export const LAYOUT_FLAG_ADAPTIVE_SWAP = 256;
export const LAYOUT_FLAG_REPEAT_KEY = 512;
export const LAYOUT_FLAG_CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED = 1024;

/** Current wire format field count (no displayValue). */
export const COMPACT_LAYOUT_FIELD_COUNT = 8;

/** Default hand split for thumb keys without an explicit thumbHand. */
const THUMB_SPLIT_COL = 5;

/**
 * Geometry-neutral wire format for one layout in all-layouts.json.
 */
export type CurrentCompactLayout = [
	name: string,
	user: AuthorId | number,
	updatedAt: string,
	flags: number,
	keyChars: string[],
	rows: number[],
	cols: number[],
	/** Thumb keys in column order: 'l' or 'r' per thumb key. */
	thumbHands?: string
];

/**
 * Published catalog wire format. The numeric compatibility slot is the historical board field;
 * new clients discard it, but retaining it keeps a refreshed catalog readable by an older bundle.
 */
export type LegacyCompactLayout = [
	name: string,
	user: AuthorId | number,
	compatibilitySlot: number,
	updatedAt: string,
	flags: number,
	keyChars: string[],
	rows: number[],
	cols: number[],
	thumbHands?: string
];

export type CompactLayout = CurrentCompactLayout | LegacyCompactLayout;
export type CompactLayoutFile = CompactLayout[];

export function positionSlotKey(row: number, col: number): string {
	return `${row},${col}`;
}

/**
 * Resolve optional trailing fields. Current format: [..., thumbHands?].
 * Legacy format: [..., displayValue, thumbHands?].
 */
function resolveTrailingFields(entry: unknown[]): { thumbHands: string | undefined } {
	const a = entry[7];
	const b = entry[8];

	// Current: field 7 is thumbHands ('l'/'r' only) or absent
	if (typeof a === 'string' && /^[lr]*$/.test(a) && b === undefined) {
		return { thumbHands: a || undefined };
	}
	// Legacy pre-board-removal format after normalization: field 7 is displayValue, field 8 is thumbHands
	if (typeof b === 'string') {
		return { thumbHands: b || undefined };
	}
	if (typeof a === 'string' && /^[lr]*$/.test(a)) {
		return { thumbHands: a || undefined };
	}
	return { thumbHands: undefined };
}

export function decodeLayout(entry: CompactLayout | unknown[]): LayoutData {
	const raw = entry as unknown[];
	const normalized =
		typeof raw[2] === 'number'
			? [raw[0], raw[1], raw[3], raw[4], raw[5], raw[6], raw[7], raw[8], raw[9]]
			: raw;
	const [name, user, updatedAt, flags, keyChars, rows, cols] = normalized as CurrentCompactLayout;
	const { thumbHands } = resolveTrailingFields(normalized);

	const keys: Record<string, KeyInfo> = {};
	const positionBySlot = new Map<string, string>();
	const thumbIndices: number[] = [];
	for (let i = 0; i < keyChars.length; i++) {
		const keyInfo: KeyInfo = { row: rows[i], col: cols[i] };
		if (rows[i] >= THUMB_ROW) {
			thumbIndices.push(i);
		}
		const key = keyChars[i];
		if (key) keys[key] = keyInfo;
		positionBySlot.set(positionSlotKey(rows[i], cols[i]), key ?? '');
	}

	if (thumbHands && thumbIndices.length > 0) {
		thumbIndices.sort((a, b) => cols[a] - cols[b]);
		for (let j = 0; j < thumbIndices.length; j++) {
			const hand = thumbHands[j] === 'r' ? 'r' : 'l';
			const key = keyChars[thumbIndices[j]];
			if (key && keys[key]) keys[key].thumbHand = hand;
		}
	}

	const thumbKeysByHand: { l: ThumbKeyEntry[]; r: ThumbKeyEntry[] } = { l: [], r: [] };
	const orderedThumbIndices = [...thumbIndices].sort((a, b) => cols[a] - cols[b]);
	for (let j = 0; j < orderedThumbIndices.length; j++) {
		const index = orderedThumbIndices[j];
		const hand =
			thumbHands && thumbHands[j]
				? thumbHands[j] === 'r'
					? 'r'
					: 'l'
				: cols[index] < THUMB_SPLIT_COL
					? 'l'
					: 'r';
		const key = keyChars[index];
		if (key) thumbKeysByHand[hand].push({ key: key.toLowerCase(), col: cols[index] });
	}

	return {
		name,
		user: String(user),
		keys,
		positionBySlot,
		thumbKeysByHand,
		hasThumbKeys: (flags & LAYOUT_FLAG_THUMB_KEYS) !== 0,
		hasAllLetters: (flags & LAYOUT_FLAG_ALL_LETTERS) !== 0,
		hasMagicKey: (flags & LAYOUT_FLAG_MAGIC_KEY) !== 0,
		hasRepeatKey: (flags & LAYOUT_FLAG_REPEAT_KEY) !== 0,
		hasMagicKeyMappings: (flags & LAYOUT_FLAG_MAGIC_KEY_MAPPINGS) !== 0,
		cyanophageStatsNeedMagicMappings:
			(flags & LAYOUT_FLAG_CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED) !== 0,
		hasAdaptiveSwap: (flags & LAYOUT_FLAG_ADAPTIVE_SWAP) !== 0,
		hasAdaptiveSwapMappings: (flags & LAYOUT_FLAG_ADAPTIVE_SWAP_MAPPINGS) !== 0,
		characterSet: computeCharacterSet(keyChars),
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
