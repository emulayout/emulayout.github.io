/**
 * Transforms layout data by adding computed properties.
 * This allows us to pre-compute values that would otherwise be calculated on the client.
 */

import { isCyanophageCompatible } from '../src/lib/cyanophage.ts';
import { computeCharacterSet } from '../src/lib/layoutCharacterSet.ts';
import { THUMB_ROW } from '../src/lib/layoutDisplay.ts';
import { hasRepeatKey } from './layout-features.js';

const SPLIT_COL = 5;

/**
 * @typedef {{ row: number, col: number, finger?: string, thumbHand?: 'l' | 'r' }} LayoutKeyInfo
 * @typedef {{ name?: string, user?: unknown, board?: unknown, keys?: Record<string, LayoutKeyInfo> }} RawLayout
 */

/**
 * Transforms a layout object by adding computed properties.
 * @param {RawLayout} layout - The raw layout object from the catalog API
 */
export function transformLayout(layout) {
	/** @type {Record<string, { row: number, col: number, thumbHand?: 'l' | 'r' }>} */
	const keys = {};

	if (layout.keys && typeof layout.keys === 'object') {
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info && typeof info.row === 'number' && typeof info.col === 'number') {
				keys[key] = { row: info.row, col: info.col };
				if (info.row >= THUMB_ROW) {
					keys[key].thumbHand = computeKeyThumbHand(info);
				}
			}
		}
	}

	const stripped = {
		name: layout.name,
		user: layout.user,
		board: layout.board,
		keys
	};

	return {
		...stripped,
		hasThumbKeys: computeHasThumbKeys(stripped),
		characterSet: computeCharacterSet(Object.keys(keys)),
		hasAllLetters: computeHasAllLetters(stripped),
		// Catalog sync replaces this after joining cminibrowser's canonical mappings.
		hasMagicKey: false,
		hasRepeatKey: hasRepeatKey(stripped.keys, undefined),
		cyanophageCompatible: isCyanophageCompatible(keys),
		cyanophageThumb: isCyanophageCompatible(keys) ? computeCyanophageThumb(layout) : undefined
	};
}

/**
 * Computes whether a layout has thumb keys (row 3 or higher).
 * A layout has thumb keys if it has keys in more than 3 rows (rows 0, 1, 2, 3+).
 * @param {RawLayout} layout
 */
function computeHasThumbKeys(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	const rows = new Set();
	for (const info of Object.values(layout.keys)) {
		if (info && typeof info.row === 'number') {
			rows.add(info.row);
		}
	}

	// Has thumb keys if there are more than 3 unique rows (0, 1, 2, 3+)
	return rows.size > 3;
}

/**
 * Cyanophage supports one thumb key; playground uses thumb=l|r from cmini finger.
 * @param {RawLayout} layout - raw layout with finger on keys
 * @returns {'l' | 'r' | undefined}
 */
function computeCyanophageThumb(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') return undefined;

	const thumbs = Object.entries(layout.keys).filter(([, info]) => info && info.row >= 3);
	if (thumbs.length !== 1) return undefined;

	const [, info] = thumbs[0];
	const finger = info.finger;
	if (typeof finger === 'string') {
		if (finger[0] === 'L') return 'l';
		if (finger[0] === 'R') return 'r';
	}
	return typeof info.col === 'number' && info.col < SPLIT_COL ? 'l' : 'r';
}

/**
 * @param {{ row: number, col: number, finger?: string }} info
 * @returns {'l' | 'r'}
 */
function computeKeyThumbHand(info) {
	const hand = thumbHand(info.finger);
	if (hand === 'left') return 'l';
	if (hand === 'right') return 'r';
	return info.col < SPLIT_COL ? 'l' : 'r';
}

/**
 * @param {Record<string, { row: number, col: number, thumbHand?: 'l' | 'r' }>} keys
 * @returns {string}
 */
export function encodeThumbHands(keys) {
	return Object.entries(keys ?? {})
		.filter(([, info]) => info.row >= THUMB_ROW)
		.sort((a, b) => a[1].col - b[1].col)
		.map(([, info]) => info.thumbHand ?? (info.col < SPLIT_COL ? 'l' : 'r'))
		.join('');
}

/**
 * @param {string | undefined} finger
 * @returns {'left' | 'right' | null}
 */
function thumbHand(finger) {
	if (!finger || typeof finger !== 'string') return null;
	if (finger[0] === 'L') return 'left';
	if (finger[0] === 'R') return 'right';
	return null;
}

/**
 * Computes whether a layout has all letters a-z (case insensitive).
 * Returns true if all 26 letters are present in the layout keys, false otherwise.
 * @param {RawLayout} layout
 */
function computeHasAllLetters(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	// Set to track which letters we've found
	const found = new Set();
	for (const key of Object.keys(layout.keys)) {
		if (!key) continue;
		for (let i = 0; i < key.length; i++) {
			const ch = key[i].toLowerCase();
			if (ch >= 'a' && ch <= 'z') found.add(ch);
		}
	}
	return found.size === 26;
}
