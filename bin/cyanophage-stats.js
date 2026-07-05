import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCyanophageCompatible, buildCyanophageCharPositionMap } from '../src/lib/cyanophage.ts';

/**
 * Cyanophage stats (English word-frequency input).
 * Tier 1 metrics only: Total Word Effort and Effort.
 *
 * Ported from cyanophage keyboard_svg.js measureDictionary / measureWords.
 */

/** Analyzer id exported to the site (separate from cmini monkeyracer). */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** @type {readonly ['total-word-effort', 'effort']} */
export const CYANOPHAGE_STAT_KEYS = ['total-word-effort', 'effort'];

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

/** @typedef {Map<string, { row: number, col: number }>} CharPositionMap */
/** @typedef {Record<string, number>} WordFrequencyMap */
/** @typedef {number[]} CompactCyanophageStats */
/** @typedef {{ totalWordEffort: number, effort: number }} CyanophageStats */

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
 * @param {number} row
 * @param {number} col
 */
function getEffort(charMap, effortGrid, row, col) {
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
 * @param {CharPositionMap} charMap
 * @param {WordFrequencyMap} words
 * @param {Record<string, number>} wordEffort
 * @param {number[][]} effortGrid
 * @returns {CyanophageStats | null}
 */
export function measureCorpusEffort(charMap, words, wordEffort, effortGrid) {
	let inputLength = 0;
	let totalWordEffort = 0;
	let effort = 0;
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

		for (let i = 0; i < wordLen; i++) {
			const char = word.charAt(i);
			const pos = charMap.get(char);
			if (!pos || pos.col < 0) continue;
			effort += count * getEffort(charMap, effortGrid, pos.row, pos.col);
		}
	}

	if (inputLength === 0) return null;

	const invInputLength = 1 / inputLength;
	totalWordEffort *= TOTAL_WORD_EFFORT_CORPUS_SCALE * invInputLength;

	return {
		totalWordEffort: totalWordEffort / TOTAL_WORD_EFFORT_DISPLAY_DIVISOR,
		effort: EFFORT_DISPLAY_MULTIPLIER * effort * invInputLength
	};
}

/**
 * @param {CyanophageStats} stats
 * @returns {CompactCyanophageStats}
 */
export function encodeCyanophageStats(stats) {
	return [
		Math.round(stats.totalWordEffort * CYANOPHAGE_STAT_VALUE_SCALE),
		Math.round(stats.effort * CYANOPHAGE_STAT_VALUE_SCALE)
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
	const analyzerStats = measureCorpusEffort(charMap, data.words, wordEffort, data.effortGrid);
	if (!analyzerStats) return null;

	return encodeCyanophageStats(analyzerStats);
}
