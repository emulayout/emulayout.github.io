export type QwertyKeyPos = { row: number; col: number };

export type KeyMap = Record<string, string>;

/**
 * Number of keys in the "left hand" before the visual split between hands.
 * (Used mainly for reconstructing displayValue spacing.)
 */
export const SPLIT_COL = 5;

// Standard QWERTY layout positions (row, col) mapped to KeyboardEvent.code
// Row 0: q w e r t y u i o p [ ]
// Row 1: a s d f g h j k l ; '
// Row 2: z x c v b n m , . /
export const QWERTY_KEY_MAP: Record<string, QwertyKeyPos> = {
	KeyQ: { row: 0, col: 0 },
	KeyW: { row: 0, col: 1 },
	KeyE: { row: 0, col: 2 },
	KeyR: { row: 0, col: 3 },
	KeyT: { row: 0, col: 4 },
	KeyY: { row: 0, col: 5 },
	KeyU: { row: 0, col: 6 },
	KeyI: { row: 0, col: 7 },
	KeyO: { row: 0, col: 8 },
	KeyP: { row: 0, col: 9 },
	BracketLeft: { row: 0, col: 10 },
	BracketRight: { row: 0, col: 11 },
	KeyA: { row: 1, col: 0 },
	KeyS: { row: 1, col: 1 },
	KeyD: { row: 1, col: 2 },
	KeyF: { row: 1, col: 3 },
	KeyG: { row: 1, col: 4 },
	KeyH: { row: 1, col: 5 },
	KeyJ: { row: 1, col: 6 },
	KeyK: { row: 1, col: 7 },
	KeyL: { row: 1, col: 8 },
	Semicolon: { row: 1, col: 9 },
	Quote: { row: 1, col: 10 },
	KeyZ: { row: 2, col: 0 },
	KeyX: { row: 2, col: 1 },
	KeyC: { row: 2, col: 2 },
	KeyV: { row: 2, col: 3 },
	KeyB: { row: 2, col: 4 },
	KeyN: { row: 2, col: 5 },
	KeyM: { row: 2, col: 6 },
	Comma: { row: 2, col: 7 },
	Period: { row: 2, col: 8 },
	Slash: { row: 2, col: 9 }
};

// Map base QWERTY characters to their shifted versions
export const QWERTY_CHAR_TO_SHIFTED: Record<string, string> = {
	',': '<',
	'.': '>',
	'/': '?',
	';': ':',
	"'": '"',
	'[': '{',
	']': '}',
	'\\': '|',
	'`': '~',
	'-': '_',
	'=': '+'
};

function splitRowChars(row: string): string[] {
	return row.split(/\s+/).filter((c) => c.length > 0);
}

/**
 * Applies anglemod to the QWERTY bottom row (row index 2) by left-rotating
 * the first 5 columns.
 *
 * Example: "z x c v b" -> "x c v b z"
 */
export function applyAnglemodToDisplayValue(displayValue: string): string {
	const rows = displayValue.split('\n');
	if (rows.length <= 2) return displayValue;

	const originalRow2 = rows[2];
	const chars = splitRowChars(originalRow2);
	if (chars.length < SPLIT_COL) return displayValue;

	// Left rotation for first 5 columns: [0,1,2,3,4] -> [1,2,3,4,0]
	const transformed = [chars[1], chars[2], chars[3], chars[4], chars[0], ...chars.slice(SPLIT_COL)];

	// Reconstruct with spacing similar to original: a single space between keys,
	// with a double-space after the split between hands.
	let rebuiltRow = '';
	for (let i = 0; i < transformed.length; i++) {
		rebuiltRow += transformed[i];
		if (i === SPLIT_COL - 1) {
			rebuiltRow += '  ';
		} else if (i < transformed.length - 1) {
			rebuiltRow += ' ';
		}
	}

	// Preserve leading/trailing whitespace from original
	const leadingWhitespace = originalRow2.match(/^\s*/)?.[0] ?? '';
	const trailingWhitespace = originalRow2.match(/\s*$/)?.[0] ?? '';

	const result = [
		...rows.slice(0, 2),
		leadingWhitespace + rebuiltRow + trailingWhitespace,
		...rows.slice(3)
	];
	return result.join('\n');
}

/**
 * Builds a KeyboardEvent.code -> layout character mapping from a layout displayValue.
 */
export function buildKeyMap(displayValue: string): KeyMap {
	const map: KeyMap = {};
	const rows = displayValue.split('\n');
	const rowChars = rows.map(splitRowChars);

	for (const [keyCode, { row, col }] of Object.entries(QWERTY_KEY_MAP)) {
		const ch = rowChars[row]?.[col];
		if (ch && ch.length === 1) {
			map[keyCode] = ch;
		}
	}

	return map;
}

/**
 * Builds a KeyboardEvent.code -> character mapping for when Shift is pressed.
 *
 * - For punctuation keys: return the shifted QWERTY character for that key.
 * - For letter keys: uppercase the character from the base map if it's a-z.
 */
export function buildShiftKeyMap(baseKeyMap: KeyMap): KeyMap {
	const map: KeyMap = {};

	for (const keyCode of Object.keys(QWERTY_KEY_MAP)) {
		if (!keyCode.startsWith('Key')) {
			const baseChar = baseKeyMap[keyCode];
			if (!baseChar) continue;
			const shifted = QWERTY_CHAR_TO_SHIFTED[baseChar];
			if (shifted) map[keyCode] = shifted;
		}
	}

	for (const keyCode of Object.keys(QWERTY_KEY_MAP)) {
		if (keyCode.startsWith('Key')) {
			const baseChar = baseKeyMap[keyCode];
			if (baseChar && /[a-z]/.test(baseChar)) {
				map[keyCode] = baseChar.toUpperCase();
			}
		}
	}

	return map;
}
