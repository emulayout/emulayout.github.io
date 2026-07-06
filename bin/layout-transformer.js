/**
 * Transforms layout data by adding computed properties.
 * This allows us to pre-compute values that would otherwise be calculated on the client.
 */

import { isCyanophageCompatible } from '../src/lib/cyanophage.ts';

/**
 * Transforms a layout object by adding computed properties.
 * @param {Object} layout - The raw layout object from the repo
 * @returns {Object} - The transformed layout with computed properties
 */
export function transformLayout(layout) {
	/** @type {Record<string, { row: number, col: number }>} */
	const keys = {};

	if (layout.keys && typeof layout.keys === 'object') {
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info && typeof info.row === 'number' && typeof info.col === 'number') {
				keys[key] = { row: info.row, col: info.col };
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
		displayValue: computeDisplayValue(layout),
		characterSet: computeCharacterSet(stripped),
		hasAllLetters: computeHasAllLetters(stripped),
		hasMagicKey: computeHasMagicKey(stripped),
		cyanophageCompatible: isCyanophageCompatible(keys),
		cyanophageThumb: isCyanophageCompatible(keys) ? computeCyanophageThumb(layout) : undefined
	};
}

/**
 * Computes whether a layout has thumb keys (row 3 or higher).
 * A layout has thumb keys if it has keys in more than 3 rows (rows 0, 1, 2, 3+).
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
 * @param {Object} layout - raw layout with finger on keys
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
	return typeof info.col === 'number' && info.col < 5 ? 'l' : 'r';
}

const THUMB_ROW = 3;

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
 * Place thumb keys under the hand they belong to, aligned with main-row columns.
 * Left-thumb keys are right-aligned in the left hand (e.g. under h/k); right-thumb
 * keys are left-aligned in the right hand.
 *
 * @param {Array<{ key: string, col: number, finger?: string }>} entries
 * @param {number} splitCol
 */
function formatThumbRow(entries, splitCol) {
	const left = [];
	const right = [];
	for (const entry of entries) {
		const hand = thumbHand(entry.finger);
		if (hand === 'left') {
			left.push(entry);
		} else if (hand === 'right') {
			right.push(entry);
		} else if (entry.col < splitCol) {
			left.push(entry);
		} else {
			right.push(entry);
		}
	}
	left.sort((a, b) => a.col - b.col);
	right.sort((a, b) => a.col - b.col);

	const maxCol = Math.max(
		left.length > 0 ? splitCol - 1 : 0,
		right.length > 0 ? splitCol + right.length - 1 : 0
	);
	/** @type {string[]} */
	const slots = Array.from({ length: maxCol + 1 }, () => ' ');

	for (let i = 0; i < left.length; i++) {
		slots[splitCol - left.length + i] = left[i].key;
	}
	for (let i = 0; i < right.length; i++) {
		slots[splitCol + i] = right[i].key;
	}

	return slots.slice(0, splitCol).join(' ') + '  ' + slots.slice(splitCol).join(' ');
}

/**
 * Computes the displayValue string representation of a layout.
 */
function computeDisplayValue(layout, splitCol = 5) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return '';
	}

	/** @type {Record<number, Array<{ key: string, col: number, finger?: string }>>} */
	const rows = {};
	Object.entries(layout.keys).forEach(([key, info]) => {
		if (!info || typeof info.row !== 'number' || typeof info.col !== 'number') return;
		if (!rows[info.row]) rows[info.row] = [];
		rows[info.row].push({ key, col: info.col, finger: info.finger });
	});

	const isAnsiDisplay = layout.board === 'stagger' || layout.board === 'angle';

	const out = Object.keys(rows)
		.sort((a, b) => Number(a) - Number(b))
		.map((row) => {
			const rowNum = Number(row);
			const entries = rows[rowNum];

			let rowString;
			if (rowNum >= THUMB_ROW) {
				rowString = formatThumbRow(entries, splitCol);
			} else {
				/** @type {string[]} */
				const r = [];
				for (const { key, col } of entries) {
					r[col] = key;
				}
				const maxCol = r.reduce((max, _, i) => (r[i] !== undefined ? i : max), 0);
				const filled = Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? ' ');
				rowString =
					filled.slice(0, splitCol).join(' ') +
					'  ' +
					filled.slice(splitCol).join(' ');
			}

			if (isAnsiDisplay) {
				if (rowNum === 1) {
					return ' ' + rowString;
				} else if (rowNum === 2) {
					return '  ' + rowString;
				}
			}

			return rowString;
		})
		.join('\n');

	return out.trim();
}

/**
 * Computes the character set of a layout.
 * Returns "english" if all keys are basic ASCII/Latin characters,
 * "international" if any keys contain foreign characters (Extended Latin, Cyrillic, Japanese, Chinese, etc.)
 */
function computeCharacterSet(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return 'english';
	}

	// Check all key characters
	for (const key of Object.keys(layout.keys)) {
		// Skip if key is empty or just whitespace
		if (!key || key.trim() === '') continue;

		// Check each character in the key
		for (let i = 0; i < key.length; i++) {
			const charCode = key.charCodeAt(i);

			// Basic ASCII printable range is 32-126 (space through tilde)
			// This includes: letters (a-z, A-Z), numbers (0-9), and basic punctuation
			// Anything outside this range is considered "international"
			if (charCode < 32 || charCode > 126) {
				return 'international';
			}
		}
	}

	return 'english';
}

/**
 * Computes whether a layout has all letters a-z (case insensitive).
 * Returns true if all 26 letters are present in the layout keys, false otherwise.
 */
function computeHasAllLetters(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	// Set to track which letters we've found
	const foundLetters = new Set();

	// Check all keys
	for (const key of Object.keys(layout.keys)) {
		if (!key || typeof key !== 'string') continue;

		// Convert to lowercase and check each character
		const lowerKey = key.toLowerCase();
		for (let i = 0; i < lowerKey.length; i++) {
			const char = lowerKey[i];
			// Check if it's a letter a-z
			if (char >= 'a' && char <= 'z') {
				foundLetters.add(char);
			}
		}
	}

	// Check if we have all 26 letters
	return foundLetters.size === 26;
}

/**
 * Computes whether a layout has a magic key assigned.
 */
function computeHasMagicKey(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	// Check if any key in the keys object is "*" or "@"
	return Object.keys(layout.keys).some((key) => key === '*' || key === '@');
}
