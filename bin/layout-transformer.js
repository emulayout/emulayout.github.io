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
 * @typedef {{ char?: string, row: number, col: number, finger?: string }} LayoutPosition
 * @typedef {{ name?: string, user?: unknown, board?: unknown, keys?: Record<string, LayoutKeyInfo>, positions?: LayoutPosition[] }} RawLayout
 */

/**
 * Transforms a layout object by adding computed properties.
 * @param {RawLayout} layout - The raw layout object from the catalog API
 */
export function transformLayout(layout) {
	/** @type {Record<string, { row: number, col: number, thumbHand?: 'l' | 'r' }>} */
	const keys = {};
	/** @type {{ char: string, row: number, col: number, thumbHand?: 'l' | 'r' }[]} */
	const positions = [];
	const sourcePositions = Array.isArray(layout.positions)
		? layout.positions.map((info) => [info.char ?? '', info])
		: Object.entries(layout.keys ?? {});

	for (const [key, info] of sourcePositions) {
		if (info && typeof info.row === 'number' && typeof info.col === 'number') {
			const position = { char: key, row: info.row, col: info.col };
			if (info.row >= THUMB_ROW) position.thumbHand = computeKeyThumbHand(info);
			positions.push(position);
			if (key) {
				keys[key] = {
					row: position.row,
					col: position.col,
					...(position.thumbHand ? { thumbHand: position.thumbHand } : {})
				};
			}
		}
	}

	const stripped = {
		name: layout.name,
		user: layout.user,
		board: layout.board,
		keys,
		positions
	};

	return {
		...stripped,
		hasThumbKeys: positions.some((position) => position.row >= THUMB_ROW),
		characterSet: computeCharacterSet(positions.map((position) => position.char)),
		hasAllLetters: computeHasAllLetters(positions),
		// Catalog sync replaces this after joining AKL's canonical mappings.
		hasMagicKey: false,
		hasRepeatKey: hasRepeatKey(stripped.keys, undefined),
		cyanophageCompatible: layout.board !== 'unknown' && isCyanophageCompatible(keys),
		cyanophageThumb:
			layout.board !== 'unknown' && isCyanophageCompatible(keys)
				? computeCyanophageThumb(layout)
				: undefined
	};
}

/**
 * Cyanophage supports one thumb key; playground uses thumb=l|r from cmini finger.
 * @param {RawLayout} layout - raw layout with finger on keys
 * @returns {'l' | 'r' | undefined}
 */
function computeCyanophageThumb(layout) {
	const entries = Array.isArray(layout.positions)
		? layout.positions.map((info) => [info.char ?? '', info])
		: Object.entries(layout.keys ?? {});
	const thumbs = entries.filter(([, info]) => info && info.row >= 3);
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
 * @param {{ char: string }[]} positions
 */
function computeHasAllLetters(positions) {
	// Set to track which letters we've found
	const found = new Set();
	for (const { char: key } of positions) {
		if (!key) continue;
		for (let i = 0; i < key.length; i++) {
			const ch = key[i].toLowerCase();
			if (ch >= 'a' && ch <= 'z') found.add(ch);
		}
	}
	return found.size === 26;
}
