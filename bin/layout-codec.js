/** Keep in sync with layoutCodec.ts */

/** @type {readonly ['angle', 'stagger', 'ortho', 'mini']} */
export const BOARD_TYPES = ['angle', 'stagger', 'ortho', 'mini'];

/** @type {Record<(typeof BOARD_TYPES)[number], number>} */
export const BOARD_CODE = {
	angle: 0,
	stagger: 1,
	ortho: 2,
	mini: 3
};

export const LAYOUT_FLAG_THUMB_KEYS = 1;
export const LAYOUT_FLAG_ALL_LETTERS = 2;
export const LAYOUT_FLAG_MAGIC_KEY = 4;
export const LAYOUT_FLAG_INTERNATIONAL = 8;

/** @typedef {[
 *   string,
 *   number,
 *   number,
 *   string,
 *   number,
 *   string[],
 *   number[],
 *   number[],
 *   string
 * ]} CompactLayout */

/**
 * @param {Object} layout
 * @returns {CompactLayout}
 */
export function encodeLayout(layout) {
	const entries = Object.entries(layout.keys ?? {});
	let flags = 0;

	if (layout.hasThumbKeys) flags |= LAYOUT_FLAG_THUMB_KEYS;
	if (layout.hasAllLetters) flags |= LAYOUT_FLAG_ALL_LETTERS;
	if (layout.hasMagicKey) flags |= LAYOUT_FLAG_MAGIC_KEY;
	if (layout.characterSet === 'international') flags |= LAYOUT_FLAG_INTERNATIONAL;

	return [
		layout.name,
		layout.user,
		BOARD_CODE[layout.board] ?? BOARD_CODE.ortho,
		layout.updatedAt,
		flags,
		entries.map(([key]) => key),
		entries.map(([, info]) => info.row),
		entries.map(([, info]) => info.col),
		layout.displayValue
	];
}

/** @param {CompactLayout | { name: string }} entry */
export function layoutEntryName(entry) {
	return Array.isArray(entry) ? entry[0] : entry.name;
}
