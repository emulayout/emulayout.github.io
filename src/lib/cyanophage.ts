import type { BoardType, KeyInfo } from '$lib/layout';

/**
 * Cyanophage layout param: 34 chars in fixed QWERTY physical key order, then importLayout()
 * swaps rcdata slots positionally. See cyanophage keyboard_svg.js exportLayout/importLayout.
 *
 * importLayout only swaps when layout.charAt(i) matches an existing rcdata key label.
 * Characters outside this set (e.g. "=", "?", emoji) are ignored and the link layout diverges.
 */

const CYANOPHAGE_IMPORT_CHAR_STRING = String.raw`qwertyuiop-asdfghjkl;'zxcvbnm,./\^`;

/** Characters cyanophage can map via importLayout / exportLayout. */
export const CYANOPHAGE_IMPORT_CHARS: ReadonlySet<string> = new Set(CYANOPHAGE_IMPORT_CHAR_STRING);

const CYAN_DEFAULTS =
	'qwertyuiop-asdfghjkl;\'zxcvbnm,./\\^';

type CyanSlot = { row: number; col: number; defaultChar?: string } | { defaultChar: string };

function buildKeyGrid(keys: Record<string, KeyInfo>): Map<string, string> {
	const grid = new Map<string, string>();
	for (const [char, { row, col }] of Object.entries(keys)) {
		grid.set(`${row},${col}`, char);
	}
	return grid;
}

function getKeyAt(grid: Map<string, string>, row: number, col: number): string | undefined {
	return grid.get(`${row},${col}`);
}

/** Thumb keys in cmini live on row 3+. Cyanophage supports one thumb letter in importLayout. */
export function getCyanophageThumbKeys(
	keys: Record<string, KeyInfo>
): Array<{ char: string; row: number; col: number }> {
	return Object.entries(keys ?? {})
		.filter(([, info]) => info.row >= 3)
		.map(([char, info]) => ({ char, row: info.row, col: info.col }))
		.sort((a, b) => a.col - b.col || a.row - b.row);
}

export function countCyanophageThumbKeys(keys: Record<string, KeyInfo>): number {
	return getCyanophageThumbKeys(keys).length;
}

export type CyanophageIncompatibility =
	| { kind: 'unsupported-chars'; chars: string[] }
	| { kind: 'multiple-thumb-keys'; count: number };

/** Reasons a layout cannot be imported or measured faithfully in cyanophage. */
export function getCyanophageIncompatibilities(keys: Record<string, KeyInfo>): CyanophageIncompatibility[] {
	const incompatibilities: CyanophageIncompatibility[] = [];

	const unsupportedChars = getUnsupportedCyanophageChars(keys);
	if (unsupportedChars.length > 0) {
		incompatibilities.push({ kind: 'unsupported-chars', chars: unsupportedChars });
	}

	const thumbKeyCount = countCyanophageThumbKeys(keys);
	if (thumbKeyCount > 1) {
		incompatibilities.push({ kind: 'multiple-thumb-keys', count: thumbKeyCount });
	}

	return incompatibilities;
}

export function formatCyanophageIncompatibilities(
	incompatibilities: CyanophageIncompatibility[]
): string {
	const parts: string[] = [];

	for (const issue of incompatibilities) {
		if (issue.kind === 'unsupported-chars') {
			parts.push(`unsupported chars: ${formatUnsupportedCyanophageChars(issue.chars)}`);
		} else if (issue.kind === 'multiple-thumb-keys') {
			parts.push(`${issue.count} thumb keys (cyanophage supports one)`);
		}
	}

	return parts.join('; ');
}

/** Ergo / ortho / mini: 3×10 grid + punctuation column + \\^ thumb defaults. */
function getErgoSlots(): CyanSlot[] {
	const slots: CyanSlot[] = [];
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 0, col, defaultChar: col === 10 ? '-' : undefined });
	}
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 1, col, defaultChar: col === 10 ? "'" : undefined });
	}
	for (let col = 0; col < 10; col++) {
		slots.push({ row: 2, col });
	}
	slots.push({ defaultChar: '\\' }, { defaultChar: '^' });
	return slots;
}

/**
 * ANSI / ISO stagger: wider top row — index 32 is the backslash-key cap (cmini row 0 col 11).
 */
function getStaggeredSlots(): CyanSlot[] {
	const slots: CyanSlot[] = [];
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 0, col, defaultChar: col === 10 ? '-' : undefined });
	}
	for (let col = 0; col <= 10; col++) {
		slots.push({ row: 1, col, defaultChar: col === 10 ? "'" : undefined });
	}
	for (let col = 0; col < 10; col++) {
		slots.push({ row: 2, col });
	}
	slots.push({ row: 0, col: 11, defaultChar: '\\' }, { defaultChar: '^' });
	return slots;
}

function getSlotsForBoard(board: BoardType): CyanSlot[] {
	switch (board) {
		case 'stagger':
		case 'angle':
			return getStaggeredSlots();
		case 'ortho':
		case 'mini':
		default:
			return getErgoSlots();
	}
}

/** Punctuation placeholders for empty cmini cols 10/11 mapped to cyanophage slots 10 and 21. */
const PUNCT_PLACEHOLDER_SLOT_10 = ['-', ';', '/', ',', '.', "'"] as const;
const PUNCT_PLACEHOLDER_SLOT_21 = ["'", ';', '/', ',', '.', '-', '^'] as const;

function pickPunctPlaceholder(used: ReadonlySet<string>, fallbacks: readonly string[]): string {
	for (const candidate of fallbacks) {
		if (!used.has(candidate)) return candidate;
	}
	return fallbacks[0];
}

const CYANOPHAGE_IMPORT_SLOT_COUNT = 34;

function buildLayoutImportString(keys: Record<string, KeyInfo>, board: BoardType): string {
	const grid = buildKeyGrid(keys);
	const slots = getSlotsForBoard(board);
	const chars: Array<string | null> = Array.from({ length: CYANOPHAGE_IMPORT_SLOT_COUNT }, () => null);

	for (let index = 0; index < CYANOPHAGE_IMPORT_SLOT_COUNT; index++) {
		const slot = slots[index];
		if (!('row' in slot)) continue;
		const assigned = getKeyAt(grid, slot.row, slot.col);
		if (assigned) chars[index] = assigned;
	}

	const thumbKeys = getCyanophageThumbKeys(keys);
	chars[33] = thumbKeys.length === 1 ? thumbKeys[0].char : '^';

	for (const index of [10, 21]) {
		if (chars[index] !== null) continue;
		const used = new Set(
			chars.filter((char, charIndex): char is string => char !== null && charIndex !== index)
		);
		const fallbacks = index === 10 ? PUNCT_PLACEHOLDER_SLOT_10 : PUNCT_PLACEHOLDER_SLOT_21;
		chars[index] = pickPunctPlaceholder(used, fallbacks);
	}

	for (let index = 0; index < CYANOPHAGE_IMPORT_SLOT_COUNT; index++) {
		if (chars[index] !== null) continue;
		const slot = slots[index];
		if ('defaultChar' in slot && slot.defaultChar) {
			const used = new Set(chars.filter((char): char is string => char !== null));
			chars[index] = pickPunctPlaceholder(used, [slot.defaultChar]);
			continue;
		}
		const used = new Set(chars.filter((char): char is string => char !== null));
		const fallback = CYAN_DEFAULTS[index] ?? '-';
		chars[index] = pickPunctPlaceholder(used, [fallback]);
	}

	return chars.join('');
}

/** 34-char cyanophage import string (without ANSI/ISO export suffix). */
export function formatLayoutImportString(
	keys: Record<string, KeyInfo>,
	board: BoardType,
	displayValue?: string
): string {
	if (!keys || Object.keys(keys).length === 0) {
		const fallback = displayValue ? formatLayoutFromDisplayValue(displayValue) : '';
		return fallback.length === CYANOPHAGE_IMPORT_SLOT_COUNT ? fallback : '';
	}
	return buildLayoutImportString(keys, board);
}

/**
 * Fallback when keys are missing: parse displayValue the ortho way (legacy).
 */
function formatLayoutFromDisplayValue(displayValue: string): string {
	const grid = displayValue
		.split('\n')
		.map((row) => row.split(/\s+/).filter((char) => char.length > 0));
	const chars: Array<string | null> = Array.from({ length: 34 }, () => null);

	const fillRow = (row: number, startIndex: number) => {
		for (let col = 0; col < 10; col++) {
			const char = grid[row]?.[col];
			if (!char) return false;
			chars[startIndex + col] = char;
		}
		if (grid[row]?.[10]) {
			chars[startIndex + 10] = grid[row][10];
		}
		return true;
	};

	if (!fillRow(0, 0)) return displayValue.replace(/\s+/g, '');
	if (!fillRow(1, 11)) return displayValue.replace(/\s+/g, '');

	for (let col = 0; col < 10; col++) {
		const char = grid[2]?.[col];
		if (!char) return displayValue.replace(/\s+/g, '');
		chars[22 + col] = char;
	}

	const thumbRow = grid[3]?.[0];
	chars[32] = '\\';
	chars[33] = thumbRow ?? '^';

	for (const index of [10, 21]) {
		if (chars[index] !== null) continue;
		const used = new Set(
			chars.filter((char, charIndex): char is string => char !== null && charIndex !== index)
		);
		const fallbacks = index === 10 ? PUNCT_PLACEHOLDER_SLOT_10 : PUNCT_PLACEHOLDER_SLOT_21;
		chars[index] = pickPunctPlaceholder(used, fallbacks);
	}

	return chars.join('');
}

export function formatLayoutForCyanophage(
	keys: Record<string, KeyInfo>,
	board: BoardType,
	displayValue?: string
): string {
	const layout = formatLayoutImportString(keys, board, displayValue);
	if (!layout) return '';

	// ANSI/ISO exportLayout appends rcdata[35] when it is not "$" (always "back" on those modes).
	if (board === 'stagger' || board === 'angle') {
		return layout + 'back';
	}

	return layout;
}

/** Unsupported key labels for cyanophage import and effort measurement. */
export function getUnsupportedCyanophageChars(keys: Record<string, KeyInfo>): string[] {
	const unsupported = new Set<string>();

	for (const char of Object.keys(keys ?? {})) {
		if (char.length !== 1 || !CYANOPHAGE_IMPORT_CHARS.has(char)) {
			unsupported.add(char);
		}
	}

	return [...unsupported].sort();
}

/** True when the layout can be imported and measured faithfully in cyanophage. */
export function isCyanophageCompatible(keys: Record<string, KeyInfo>): boolean {
	if (!keys || Object.keys(keys).length === 0) return false;
	return getCyanophageIncompatibilities(keys).length === 0;
}

export function formatUnsupportedCyanophageChars(chars: string[]): string {
	if (chars.length === 0) return '';
	if (chars.length <= 4) return chars.map((char) => JSON.stringify(char)).join(', ');
	return `${chars
		.slice(0, 3)
		.map((char) => JSON.stringify(char))
		.join(', ')}, +${chars.length - 3} more`;
}

function encodeCyanophageLayoutParam(layout: string): string {
	// encodeURIComponent leaves `'` unescaped, which breaks query strings for layouts like 'l...
	return encodeURIComponent(layout).replace(/'/g, '%27');
}

export function buildCyanophagePlaygroundUrl(
	keys: Record<string, KeyInfo>,
	board: BoardType,
	displayValue?: string
): string | null {
	if (!isCyanophageCompatible(keys)) return null;

	const mode = board === 'stagger' ? 'ansi' : board === 'angle' ? 'iso' : 'ergo';
	const layoutParam = formatLayoutForCyanophage(keys, board, displayValue);
	const encodedLayout = encodeCyanophageLayoutParam(layoutParam);
	return `https://cyanophage.github.io/playground.html?layout=${encodedLayout}&mode=${mode}&lan=english&thumb=l`;
}
