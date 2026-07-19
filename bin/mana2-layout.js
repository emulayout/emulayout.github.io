/**
 * Convert cmini layout JSON → Mana2 `.jsonc` layout files.
 * Incompatible layouts return null (odd boards, duplicates, oversized grids, etc.).
 */

/** Bump when conversion rules change (invalidates mana2 stats cache). */
export const MANA2_CONVERTER_VERSION = 1;

/** cmini finger label → Mana2 fingermap digit (0–9). */
const FINGER_TO_DIGIT = {
	LP: 0,
	LR: 1,
	LM: 2,
	LI: 3,
	LT: 4,
	RT: 5,
	RI: 6,
	RM: 7,
	RR: 8,
	RP: 9,
	TB: 4
};

const MAX_FINGER_ROWS = 3;
const MAX_THUMB_KEYS = 4;
const MAX_COL = 14;
const MAX_ROW = 3;

/**
 * @typedef {{
 *   row: number,
 *   col: number,
 *   finger?: string
 * }} CminiKey
 */

/**
 * @typedef {{
 *   name?: string,
 *   board?: string,
 *   keys?: Record<string, CminiKey>
 * }} CminiLayout
 */

/**
 * @typedef {{
 *   layout: { fingers: string[], thumbs: [string, string] },
 *   fingermap: string[],
 *   board: {
 *     isRowStaggered: boolean,
 *     mirrorLeftRowStagger: boolean,
 *     splitAngle: number,
 *     rowOrColumnStagger: number[]
 *   },
 *   layers: null,
 *   magic: { magicKeys: null, rules: [] }
 * }} Mana2LayoutFile
 */

/**
 * Escape a key label for Mana2 row tokenization.
 * @param {string} key
 * @returns {string | null}
 */
function mana2TokenForKey(key) {
	if (key === ' ' || key === 'space') return 'space';
	if (key === 'skip') return null;
	if (typeof key !== 'string' || key.length === 0) return null;

	const runes = [...key];
	if (runes.length === 1) {
		const ch = runes[0];
		if (ch === '(' || ch === ')' || ch === '<' || ch === '>') return null;
		return ch;
	}

	// Mana2 only accepts a few multi-letter tokens; cmini multi-char keys are skipped.
	return null;
}

/**
 * @param {string | undefined} finger
 * @param {number} col
 * @param {number} row
 */
function fingerDigit(finger, col, row) {
	if (typeof finger === 'string' && finger in FINGER_TO_DIGIT) {
		return FINGER_TO_DIGIT[finger];
	}
	if (row >= MAX_FINGER_ROWS) {
		return col < 5 ? 4 : 5;
	}
	if (col <= 0) return 0;
	if (col === 1) return 1;
	if (col === 2) return 2;
	if (col === 3 || col === 4) return 3;
	if (col === 5 || col === 6) return 6;
	if (col === 7) return 7;
	if (col === 8) return 8;
	return 9;
}

/**
 * @param {string | undefined} board
 */
function boardShape(board) {
	const kind = typeof board === 'string' ? board.toLowerCase() : 'ortho';
	if (kind === 'stagger' || kind === 'angle') {
		return {
			isRowStaggered: true,
			mirrorLeftRowStagger: false,
			splitAngle: 0,
			rowOrColumnStagger: [0, 0.25, 0.75]
		};
	}
	// ortho / mini / unknown — match mana2 `*_ortho` layouts
	return {
		isRowStaggered: true,
		mirrorLeftRowStagger: false,
		splitAngle: 0,
		rowOrColumnStagger: [0, 0, 0]
	};
}

/**
 * @param {Record<string, CminiKey>} keys
 * @param {number} row
 * @returns {Map<number, { key: string, finger?: string }>}
 */
function keysOnRow(keys, row) {
	/** @type {Map<number, { key: string, finger?: string }>} */
	const byCol = new Map();
	for (const [key, info] of Object.entries(keys)) {
		if (!info || typeof info.row !== 'number' || typeof info.col !== 'number') continue;
		if (info.row !== row) continue;
		byCol.set(info.col, { key, finger: info.finger });
	}
	return byCol;
}

/**
 * Build a Mana2 finger/fingermap row with `skip` for gaps.
 * @param {Map<number, { key: string, finger?: string }>} byCol
 * @param {number} row
 * @param {number} minCol
 * @param {number} maxCol
 * @returns {{ tokens: string[], fingers: string[], ok: boolean, reason?: string }}
 */
function buildRow(byCol, row, minCol, maxCol) {
	/** @type {string[]} */
	const tokens = [];
	/** @type {string[]} */
	const fingers = [];
	/** @type {Set<string>} */
	const seen = new Set();

	for (let col = minCol; col <= maxCol; col++) {
		const entry = byCol.get(col);
		if (!entry) {
			tokens.push('skip');
			fingers.push(String(fingerDigit(undefined, col, row)));
			continue;
		}
		const token = mana2TokenForKey(entry.key);
		if (token == null) {
			return { tokens: [], fingers: [], ok: false, reason: `unsupported key ${JSON.stringify(entry.key)}` };
		}
		if (seen.has(token)) {
			return { tokens: [], fingers: [], ok: false, reason: `duplicate key ${token}` };
		}
		seen.add(token);
		tokens.push(token);
		fingers.push(String(fingerDigit(entry.finger, col, row)));
	}

	return { tokens, fingers, ok: true };
}

/**
 * @param {CminiLayout} layout
 * @returns {{ file: Mana2LayoutFile, reason?: undefined } | { file: null, reason: string }}
 */
export function convertCminiLayoutToMana2(layout) {
	if (!layout?.keys || typeof layout.keys !== 'object') {
		return { file: null, reason: 'missing keys' };
	}

	/** @type {Record<string, CminiKey>} */
	const keys = layout.keys;
	const entries = Object.entries(keys).filter(
		([, info]) => info && typeof info.row === 'number' && typeof info.col === 'number'
	);
	if (entries.length === 0) return { file: null, reason: 'no positioned keys' };

	let maxRow = 0;
	let maxCol = 0;
	let minCol = Infinity;
	for (const [, info] of entries) {
		if (info.row < 0 || info.row > MAX_ROW) return { file: null, reason: `row out of range (${info.row})` };
		if (info.col < 0 || info.col > MAX_COL) return { file: null, reason: `col out of range (${info.col})` };
		maxRow = Math.max(maxRow, info.row);
		maxCol = Math.max(maxCol, info.col);
		if (info.row < MAX_FINGER_ROWS) minCol = Math.min(minCol, info.col);
	}
	if (!Number.isFinite(minCol)) minCol = 0;

	const fingerRowCount = Math.min(MAX_FINGER_ROWS, maxRow + 1);
	if (fingerRowCount < 3 && maxRow < 2) {
		// Allow 2-row layouts by padding a skip row? Prefer skip — mana2 expects usable boards.
		return { file: null, reason: 'fewer than 3 finger rows' };
	}

	/** @type {string[]} */
	const fingerRows = [];
	/** @type {string[]} */
	const fingermap = [];
	/** @type {Set<string>} */
	const usedTokens = new Set();

	for (let row = 0; row < MAX_FINGER_ROWS; row++) {
		const byCol = keysOnRow(keys, row);
		const built = buildRow(byCol, row, minCol, maxCol);
		if (!built.ok) return { file: null, reason: built.reason ?? 'row build failed' };

		for (const token of built.tokens) {
			if (token === 'skip') continue;
			if (usedTokens.has(token)) return { file: null, reason: `duplicate key ${token}` };
			usedTokens.add(token);
		}

		fingerRows.push(built.tokens.join(' '));
		fingermap.push(built.fingers.join(' '));
	}

	/** @type {{ key: string, col: number, finger?: string }[]} */
	const thumbEntries = [];
	for (const [key, info] of entries) {
		if (info.row < MAX_FINGER_ROWS) continue;
		thumbEntries.push({ key, col: info.col, finger: info.finger });
	}
	if (thumbEntries.length > MAX_THUMB_KEYS) {
		return { file: null, reason: `too many thumb keys (${thumbEntries.length})` };
	}

	thumbEntries.sort((a, b) => a.col - b.col || a.key.localeCompare(b.key));

	/** @type {string[]} */
	const leftThumbs = [];
	/** @type {string[]} */
	const rightThumbs = [];

	for (const entry of thumbEntries) {
		const token = mana2TokenForKey(entry.key);
		if (token == null) return { file: null, reason: `unsupported thumb key ${JSON.stringify(entry.key)}` };
		if (usedTokens.has(token)) return { file: null, reason: `duplicate key ${token}` };
		usedTokens.add(token);

		const hand =
			typeof entry.finger === 'string' && entry.finger.startsWith('R')
				? 'right'
				: typeof entry.finger === 'string' && entry.finger.startsWith('L')
					? 'left'
					: entry.col < 5
						? 'left'
						: 'right';
		if (hand === 'right') rightThumbs.push(token);
		else leftThumbs.push(token);
	}

	if (!usedTokens.has('space') && !usedTokens.has(' ')) {
		// Prefer left thumb slot (Mana2 bundled layouts use `["space", ""]`).
		if (leftThumbs.length === 0) leftThumbs.push('space');
		else if (rightThumbs.length === 0) rightThumbs.push('space');
		else leftThumbs.push('space');
		usedTokens.add('space');
	}

	/** @type {Mana2LayoutFile} */
	const file = {
		layout: {
			fingers: fingerRows,
			thumbs: [leftThumbs.join(' '), rightThumbs.join(' ')]
		},
		fingermap,
		board: boardShape(layout.board),
		layers: null,
		magic: {
			magicKeys: null,
			rules: []
		}
	};

	return { file };
}

/**
 * Stable filesystem id for a cmini layout filename (unique, shell-safe).
 * @param {string} cminiFilename
 */
export function mana2LayoutIdFromFilename(cminiFilename) {
	const base = cminiFilename.replace(/\.json$/i, '');
	const safe = base
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);
	let hash = 0;
	for (let i = 0; i < cminiFilename.length; i++) {
		hash = (hash * 31 + cminiFilename.charCodeAt(i)) >>> 0;
	}
	const suffix = hash.toString(16).padStart(8, '0');
	return `${safe || 'layout'}-${suffix}`;
}
