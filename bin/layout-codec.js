/** Keep in sync with layoutCodec.ts */

import { encodeThumbHands } from './layout-transformer.js';

/**
 * Historical `unknown` board code retained as a wire-format compatibility slot.
 * Board is no longer domain data, but keeping this numeric field lets an older
 * app bundle read a freshly generated catalog during local and rolling updates.
 */
const LAYOUT_WIRE_COMPATIBILITY_SLOT = 4;

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
export const LAYOUT_FLAG_CHIRAL_KEY = 2048;
export const LAYOUT_FLAG_CHIRAL_KEY_MAPPINGS = 4096;

/** @typedef {[
 *   string,
 *   string,
 *   number,
 *   string,
 *   number,
 *   string[],
 *   number[],
 *   number[],
 *   string | undefined
 * ]} CompactLayout */

/**
 * @param {Object} layout
 * @returns {CompactLayout}
 */
export function encodeLayout(layout) {
	const entries = Array.isArray(layout.positions)
		? layout.positions.map((position) => [position.char, position])
		: Object.entries(layout.keys ?? {});
	const thumbHands = Array.isArray(layout.positions)
		? entries
				.filter(([, info]) => info.row >= 3)
				.sort((left, right) => left[1].col - right[1].col)
				.map(([, info]) => info.thumbHand ?? (info.col < 5 ? 'l' : 'r'))
				.join('')
		: encodeThumbHands(layout.keys);
	let flags = 0;

	if (layout.hasThumbKeys) flags |= LAYOUT_FLAG_THUMB_KEYS;
	if (layout.hasAllLetters) flags |= LAYOUT_FLAG_ALL_LETTERS;
	if (layout.hasMagicKey) flags |= LAYOUT_FLAG_MAGIC_KEY;
	if (layout.characterSet === 'international') flags |= LAYOUT_FLAG_INTERNATIONAL;
	if (layout.cyanophageCompatible) flags |= LAYOUT_FLAG_CYANOPHAGE_COMPATIBLE;
	if (layout.cyanophageThumb === 'r') flags |= LAYOUT_FLAG_CYANOPHAGE_THUMB_RIGHT;
	if (layout.hasMagicKeyMappings) flags |= LAYOUT_FLAG_MAGIC_KEY_MAPPINGS;
	if (layout.hasAdaptiveSwapMappings) flags |= LAYOUT_FLAG_ADAPTIVE_SWAP_MAPPINGS;
	if (layout.hasAdaptiveSwap) flags |= LAYOUT_FLAG_ADAPTIVE_SWAP;
	if (layout.hasChiralKey) flags |= LAYOUT_FLAG_CHIRAL_KEY;
	if (layout.hasChiralKeyMappings) flags |= LAYOUT_FLAG_CHIRAL_KEY_MAPPINGS;
	if (layout.hasRepeatKey) flags |= LAYOUT_FLAG_REPEAT_KEY;
	if (layout.cyanophageStatsNeedMagicMappings) {
		flags |= LAYOUT_FLAG_CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED;
	}

	return [
		layout.name,
		layout.user,
		LAYOUT_WIRE_COMPATIBILITY_SLOT,
		layout.updatedAt,
		flags,
		entries.map(([key]) => key),
		entries.map(([, info]) => info.row),
		entries.map(([, info]) => info.col),
		thumbHands || undefined
	];
}

/** @param {CompactLayout | { name: string }} entry */
export function layoutEntryName(entry) {
	return Array.isArray(entry) ? entry[0] : entry.name;
}
