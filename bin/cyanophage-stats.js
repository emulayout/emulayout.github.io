import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCyanophageCompatible, buildCyanophageCharPositionMap } from '../src/lib/cyanophage.ts';

/**
 * Cyanophage stats (English word-frequency input).
 * Ported from cyanophage keyboard_svg.js measureDictionary / measureWords.
 */

/** Analyzer id exported to the site (separate from cmini monkeyracer). */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** @type {readonly ['total-word-effort', 'effort', 'sfb', 'sfs', 'scissors', 'lsb', 'lh', 'rh']} */
export const CYANOPHAGE_STAT_KEYS = [
	'total-word-effort',
	'effort',
	'sfb',
	'sfs',
	'scissors',
	'lsb',
	'lh',
	'rh'
];

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const CYANOPHAGE_STAT_VALUE_SCALE = 10_000;

/** Display divisor for total word effort (cyanophage UI). */
const TOTAL_WORD_EFFORT_DISPLAY_DIVISOR = 100;

/** Normalizer for per-character effort (cyanophage UI). */
const EFFORT_DISPLAY_MULTIPLIER = 577;

/** Corpus input-length scale applied to total word effort. */
const TOTAL_WORD_EFFORT_CORPUS_SCALE = 1_006_393;

/** Space key position used at word boundaries in bigram effort lookups. */
const SPACE_COL = 6;
const SPACE_ROW = 3;

/** Match cyanophage measureWords word cap. */
const MAX_WORDS = 40_000;

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'cyanophage-data');

/** Default per-key effort grid from cyanophage keyboard_svg.js (ergo/iso layout). */
const DEFAULT_EFFORT_GRID = [
	[5, 3, 2, 1, 2, 7, 7, 2, 1, 2, 3, 5],
	[5, 1, 0, 0, 0, 5, 5, 0, 0, 0, 1, 5],
	[7, 3, 2, 2, 1, 8, 8, 1, 2, 2, 3, 7]
];

/** col 0–12 finger ids — keyboard_svg.js fingerAssignment (ergo). */
const FINGER_ASSIGNMENT = [
	[1, 1, 2, 3, 4, 4, 7, 7, 8, 9, 10, 10, 10],
	[1, 1, 2, 3, 4, 4, 7, 7, 8, 9, 10, 10, 10],
	[1, 1, 2, 3, 4, 4, 7, 7, 8, 9, 10, 10, 10]
];

/** @typedef {Map<string, { row: number, col: number }>} CharPositionMap */
/** @typedef {Record<string, number>} WordFrequencyMap */
/** @typedef {number[]} CompactCyanophageStats */
/**
 * @typedef {{
 *   totalWordEffort: number,
 *   effort: number,
 *   sfb: number,
 *   sfs: number,
 *   scissors: number,
 *   lsb: number,
 *   lh: number,
 *   rh: number
 * }} CyanophageStats
 */

let cachedData = null;

/**
 * @returns {Promise<{ words: WordFrequencyMap, dictionary: string[], bigramEffort: object, effortGrid: number[][] }>}
 */
export async function loadCyanophageData() {
	if (cachedData) return cachedData;

	const [words, dictionaryPayload, bigramEffort] = await Promise.all([
		readFile(join(DATA_DIR, 'words-english.json'), 'utf-8').then(JSON.parse),
		readFile(join(DATA_DIR, 'dictionary.json'), 'utf-8').then(JSON.parse),
		readFile(join(DATA_DIR, 'bigram-effort.json'), 'utf-8').then(JSON.parse)
	]);

	const dictionary = Array.isArray(dictionaryPayload?.dictionary)
		? dictionaryPayload.dictionary
		: [];

	cachedData = {
		words,
		dictionary,
		bigramEffort,
		effortGrid: DEFAULT_EFFORT_GRID
	};
	return cachedData;
}

/**
 * @param {Record<string, { row?: number, col?: number }>} keys
 * @param {string} board
 * @returns {CharPositionMap}
 */
export function buildCharPositionMap(keys, board = 'ortho') {
	return buildCyanophageCharPositionMap(keys, board);
}

/**
 * @param {CharPositionMap} charMap
 * @param {string} char
 * @returns {{ row: number, col: number } | null}
 */
function getPosition(charMap, char) {
	const pos = charMap.get(char);
	if (!pos || pos.col < 0) return null;
	return pos;
}

/**
 * @param {number} row
 * @param {number} col
 */
function getFinger(row, col) {
	if (row > 2) {
		return col <= 4 ? 5 : 6;
	}
	return FINGER_ASSIGNMENT[row]?.[col] ?? -1;
}

/**
 * @param {number[][]} effortGrid
 * @param {number} row
 * @param {number} col
 */
function getEffort(effortGrid, row, col) {
	if (row < 0 || col < 0) return 0;
	return effortGrid[row]?.[col] ?? 0;
}

/**
 * @param {object} bigramEffort
 * @param {number} col1
 * @param {number} row1
 * @param {number} col2
 * @param {number} row2
 */
function lookupBigramEffort(bigramEffort, col1, row1, col2, row2) {
	if (col1 < 0 || row1 < 0 || col2 < 0 || row2 < 0) return 0;
	return bigramEffort[col1]?.[row1]?.[col2]?.[row2] ?? 0;
}

/**
 * @param {CharPositionMap} charMap
 * @param {object} bigramEffort
 * @param {string} char1
 * @param {string} char2
 */
function pairBigramEffort(charMap, bigramEffort, char1, char2) {
	const pos1 = charMap.get(char1);
	const pos2 = charMap.get(char2);
	if (!pos1 || !pos2) return 0;
	return lookupBigramEffort(bigramEffort, pos1.col, pos1.row, pos2.col, pos2.row);
}

/**
 * @param {CharPositionMap} charMap
 * @param {object} bigramEffort
 * @param {string} char1
 */
function wordEndBigramEffort(charMap, bigramEffort, char1) {
	const pos1 = charMap.get(char1);
	if (!pos1) return 0;
	return lookupBigramEffort(bigramEffort, pos1.col, pos1.row, SPACE_COL, SPACE_ROW);
}

/**
 * @param {CharPositionMap} charMap
 * @param {string[]} dictionary
 * @param {object} bigramEffort
 * @returns {Record<string, number>}
 */
export function measureDictionaryWordEffort(charMap, dictionary, bigramEffort) {
	/** @type {Record<string, number>} */
	const wordEffort = {};

	for (const word of dictionary) {
		let total = 0;
		const wordLen = word.length;
		if (wordLen === 0) continue;

		for (let i = 1; i < wordLen; i++) {
			total += pairBigramEffort(charMap, bigramEffort, word.charAt(i - 1), word.charAt(i));
		}

		total += wordEndBigramEffort(charMap, bigramEffort, word.charAt(wordLen - 1));

		for (let i = 2; i < wordLen; i++) {
			total += 0.2 * pairBigramEffort(charMap, bigramEffort, word.charAt(i - 2), word.charAt(i));
		}

		if (wordLen >= 2) {
			total += 0.2 * wordEndBigramEffort(charMap, bigramEffort, word.charAt(wordLen - 2));
		}

		wordEffort[word] = 0.1 * total;
	}

	return wordEffort;
}

/**
 * @param {number} prevCol
 * @param {number} col
 */
function isLatStretch(prevCol, col) {
	return (
		(prevCol === 3 && col === 5) ||
		(prevCol === 8 && col === 6) ||
		(prevCol === 5 && col === 3) ||
		(prevCol === 6 && col === 8) ||
		(prevCol === 2 && col === 5) ||
		(prevCol === 9 && col === 6) ||
		(prevCol === 5 && col === 2) ||
		(prevCol === 6 && col === 9)
	);
}

/**
 * @param {CharPositionMap} charMap
 * @param {WordFrequencyMap} words
 * @param {Record<string, number>} wordEffort
 * @param {number[][]} effortGrid
 * @returns {CyanophageStats | null}
 */
export function measureLayoutStats(charMap, words, wordEffort, effortGrid) {
	let inputLength = 0;
	let totalWordEffort = 0;
	let effortSum = 0;
	let sfb = 0;
	let sfs = 0;
	let scissors = 0;
	let lsb = 0;
	let lh = 0;
	let rh = 0;
	let wordCount = 0;

	for (const word in words) {
		if (wordCount >= MAX_WORDS) break;
		wordCount += 1;

		const count = words[word];
		const wordLen = word.length;
		inputLength += count * (wordLen + 1);

		if (wordEffort[word]) {
			totalWordEffort += wordEffort[word] * count;
		}

		let prevChar = '';
		let prevCol = -1;
		let prevRow = -1;
		let prevFinger = -1;
		let ppFinger = -1;
		let ppChar = '';

		for (let i = 0; i < wordLen; i++) {
			const char = word.charAt(i);
			if (i > 0) prevChar = word.charAt(i - 1);

			const pos = getPosition(charMap, char);
			if (!pos) continue;

			const { row, col } = pos;
			if (i > 0) {
				const prevPos = getPosition(charMap, prevChar);
				if (prevPos) prevCol = prevPos.col;
			}

			if (col <= 5) {
				lh += count;
			} else {
				rh += count;
			}

			effortSum += count * getEffort(effortGrid, row, col);

			const finger = getFinger(row, col);

			if (i > 0 && prevCol >= 0) {
				if (finger === prevFinger && prevChar !== char) {
					sfb += count;
				}

				if (isLatStretch(prevCol, col)) {
					lsb += count;
				}

				if (
					Math.abs(col - prevCol) === 1 &&
					Math.abs(row - prevRow) >= 2 &&
					((finger <= 4 && prevFinger <= 4 && finger !== prevFinger) ||
						(finger >= 7 && prevFinger >= 7 && finger !== prevFinger))
				) {
					scissors += count;
				}
			}

			if (i > 1 && prevCol >= 0 && finger === ppFinger && ppChar !== char) {
				sfs += count;
			}

			ppChar = prevChar;
			ppFinger = prevFinger;
			prevCol = col;
			prevRow = row;
			prevChar = char;
			prevFinger = finger;
		}
	}

	if (inputLength === 0) return null;

	const invInputLength = 1 / inputLength;
	const handTotal = lh + rh;
	totalWordEffort *= TOTAL_WORD_EFFORT_CORPUS_SCALE * invInputLength;

	return {
		totalWordEffort: totalWordEffort / TOTAL_WORD_EFFORT_DISPLAY_DIVISOR,
		effort: EFFORT_DISPLAY_MULTIPLIER * effortSum * invInputLength,
		sfb: sfb * invInputLength,
		sfs: sfs * invInputLength,
		scissors: scissors * invInputLength,
		lsb: lsb * invInputLength,
		lh: handTotal > 0 ? lh / handTotal : 0.5,
		rh: handTotal > 0 ? rh / handTotal : 0.5
	};
}

/** @deprecated Use measureLayoutStats */
export function measureCorpusEffort(charMap, words, wordEffort, effortGrid) {
	return measureLayoutStats(charMap, words, wordEffort, effortGrid);
}

/**
 * @param {CyanophageStats} stats
 * @returns {CompactCyanophageStats}
 */
export function encodeCyanophageStats(stats) {
	return [
		Math.round(stats.totalWordEffort * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.effort * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.sfb * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.sfs * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.scissors * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.lsb * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.lh * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.rh * CYANOPHAGE_STAT_VALUE_SCALE)
	];
}

/**
 * @param {object} rawLayout
 * @param {{ words: WordFrequencyMap, dictionary: string[], bigramEffort: object, effortGrid: number[][] } | null} data
 * @returns {CompactCyanophageStats | null}
 */
export function buildCyanophageStats(rawLayout, data) {
	if (!data?.words || !rawLayout?.keys) return null;
	if (!isCyanophageCompatible(rawLayout.keys)) return null;

	const board = rawLayout.board ?? 'ortho';
	const charMap = buildCyanophageCharPositionMap(rawLayout.keys, board);
	if (charMap.size === 0) return null;

	const wordEffort = measureDictionaryWordEffort(charMap, data.dictionary, data.bigramEffort);
	const stats = measureLayoutStats(charMap, data.words, wordEffort, data.effortGrid);
	if (!stats) return null;

	return encodeCyanophageStats(stats);
}
