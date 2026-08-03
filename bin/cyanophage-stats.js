import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	isCyanophageMeasurable,
	buildCyanophageCharPositionMap,
	resolveCyanophageThumb
} from '../src/lib/cyanophage.ts';
import { hasMagicKey } from './layout-features.js';
import { prepareCyanophageContextualRewrite } from './cyanophage-magic.js';

/**
 * Cyanophage stats (English word-frequency input).
 * Ported from cyanophage keyboard_svg.js / keyboard_svg_magic.js
 * measureDictionary / measureWords.
 */

/** Analyzer id exported to the site (separate from cmini monkeyracer). */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Cmini-style finger keys (cyanophage ids 1–10, 5/6 = thumbs; no TB). */
export const CYANOPHAGE_FINGER_STAT_KEYS = [
	'LI',
	'LM',
	'LR',
	'LP',
	'RI',
	'RM',
	'RR',
	'RP',
	'LT',
	'RT'
];

/** Per-finger travel-distance keys, in the same order as finger usage. */
export const CYANOPHAGE_FINGER_DISTANCE_STAT_KEYS = CYANOPHAGE_FINGER_STAT_KEYS.map(
	(finger) => `distance-${finger}`
);

/** @type {readonly string[]} */
export const CYANOPHAGE_STAT_KEYS = [
	'total-word-effort',
	'effort',
	'distance',
	'sfb',
	'sfs',
	'scissors',
	'lsb',
	'alternate',
	'alt-sfs',
	'roll',
	'roll-in',
	'roll-out',
	'roll-in-2',
	'roll-out-2',
	'roll-in-3',
	'roll-out-3',
	'redirect',
	'redirect-weak',
	'lh',
	'rh',
	...CYANOPHAGE_FINGER_STAT_KEYS,
	...CYANOPHAGE_FINGER_DISTANCE_STAT_KEYS
];

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const CYANOPHAGE_STAT_VALUE_SCALE = 10_000;

/** Display divisor for total word effort (cyanophage UI). */
const TOTAL_WORD_EFFORT_DISPLAY_DIVISOR = 100;

/** Normalizer for per-character effort (cyanophage UI). */
const EFFORT_DISPLAY_MULTIPLIER = 577;

/** Cyanophage's display scale for total and per-finger travel distance. */
const DISTANCE_DISPLAY_MULTIPLIER = 5.110882176 * 100;

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

/** @type {Record<number, string>} Cyanophage finger id → cmini-style key. */
const CYANOPHAGE_FINGER_ID_TO_KEY = {
	1: 'LP',
	2: 'LR',
	3: 'LM',
	4: 'LI',
	5: 'LT',
	6: 'RT',
	7: 'RI',
	8: 'RM',
	9: 'RR',
	10: 'RP'
};

/** Starting row/column for Cyanophage finger ids 0–10; index 0 is unused. */
const FINGER_HOME_POSITIONS = [
	[0, 0],
	[1, 1],
	[1, 2],
	[1, 3],
	[1, 4],
	[3, 4],
	[3, 7],
	[1, 7],
	[1, 8],
	[1, 9],
	[1, 10]
];

/** @typedef {Map<string, { row: number, col: number }>} CharPositionMap */
/** @typedef {Record<string, number>} WordFrequencyMap */
/** @typedef {Record<number, Record<number, Record<number, Record<number, number>>>>} BigramEffortMap */
/**
 * @typedef {{
 *   words: WordFrequencyMap,
 *   dictionary: string[],
 *   bigramEffort: BigramEffortMap,
 *   effortGrid: number[][],
 *   effortWords: string[]
 * }} CyanophageData
 */
/** @typedef {number[]} CompactCyanophageStats */
/**
 * @typedef {{
 *   totalWordEffort: number,
 *   effort: number,
 *   distance: number,
 *   sfb: number,
 *   sfs: number,
 *   scissors: number,
 *   lsb: number,
 *   alternate: number,
 *   'alt-sfs': number,
 *   roll: number,
 *   'roll-in': number,
 *   'roll-out': number,
 *   'roll-in-2': number,
 *   'roll-out-2': number,
 *   'roll-in-3': number,
 *   'roll-out-3': number,
 *   redirect: number,
 *   'redirect-weak': number,
 *   lh: number,
 *   rh: number,
 *   LI: number,
 *   LM: number,
 *   LR: number,
 *   LP: number,
 *   RI: number,
 *   RM: number,
 *   RR: number,
 *   RP: number,
 *   LT: number,
 *   RT: number,
 *   'distance-LI': number,
 *   'distance-LM': number,
 *   'distance-LR': number,
 *   'distance-LP': number,
 *   'distance-RI': number,
 *   'distance-RM': number,
 *   'distance-RR': number,
 *   'distance-RP': number,
 *   'distance-LT': number,
 *   'distance-RT': number
 * }} CyanophageStats
 */

/** @type {CyanophageData | null} */
let cachedData = null;

/**
 * @returns {Promise<CyanophageData>}
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

	const dictionarySet = new Set(dictionary);

	cachedData = {
		words,
		dictionary,
		bigramEffort,
		effortGrid: DEFAULT_EFFORT_GRID,
		/** Corpus words that appear in the dictionary — only these affect total-word-effort. */
		effortWords: Object.keys(words).filter((word) => dictionarySet.has(word))
	};
	return cachedData;
}

/**
 * @param {Record<string, { row: number, col: number }>} keys
 * @param {import('../src/lib/layout.js').BoardType} board
 * @param {'l' | 'r'} [thumb]
 * @returns {CharPositionMap}
 */
export function buildCharPositionMap(keys, board = 'ortho', thumb = 'l') {
	return buildCyanophageCharPositionMap(keys, board, thumb);
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
 * Cyanophage key-center coordinates in key-width units.
 * `ortho`/`mini` use the playground's split ergo geometry; `stagger`/`angle`
 * use its ANSI/ISO row stagger.
 * @param {number} row
 * @param {number} col
 * @param {string} board
 */
function getPhysicalPosition(row, col, board) {
	if (board === 'stagger' || board === 'angle') {
		const rowOffset = row === 0 ? 0.5 : row === 1 ? 0.75 : 1.25;
		return { x: col + rowOffset, y: row };
	}

	// Cyanophage's ergo view inserts a 40 px gap after column 5 (38 px = 1u).
	return { x: col + (col > 5 ? 40 / 38 : 0), y: row };
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
function physicalDistance(a, b) {
	return Math.hypot(a.x - b.x, a.y - b.y);
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
 * @param {BigramEffortMap} bigramEffort
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
 * @param {BigramEffortMap} bigramEffort
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
 * @param {BigramEffortMap} bigramEffort
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
 * @param {BigramEffortMap} bigramEffort
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
 * Classify a trigram the way cyanophage `measureWords` does (keyboard_svg.js).
 * @param {number} ppFinger
 * @param {number} prevFinger
 * @param {number} finger
 * @param {string} ppChar
 * @param {string} char
 * @returns {string}
 */
function classifyTrigram(ppFinger, prevFinger, finger, ppChar, char) {
	let cat = 'other';

	if (ppFinger <= 5 && prevFinger <= 5 && finger <= 5) {
		if (ppFinger < prevFinger && prevFinger < finger) {
			cat = 'roll in';
		} else if (ppFinger > prevFinger && prevFinger > finger) {
			cat = 'roll out';
		} else if (
			(ppFinger < prevFinger && finger < prevFinger && finger !== ppFinger) ||
			(ppFinger > prevFinger && finger > prevFinger && finger !== ppFinger)
		) {
			cat = 'redirect';
			if (ppFinger !== 4 && prevFinger !== 4 && finger !== 4) {
				cat = 'weak redirect';
			}
		}
	}

	if (ppFinger >= 6 && prevFinger >= 6 && finger >= 6) {
		if (ppFinger > prevFinger && prevFinger > finger) {
			cat = 'roll in';
		} else if (ppFinger < prevFinger && prevFinger < finger) {
			cat = 'roll out';
		} else if (
			(ppFinger > prevFinger && finger > prevFinger && finger !== ppFinger) ||
			(ppFinger < prevFinger && finger < prevFinger && finger !== ppFinger)
		) {
			cat = 'redirect';
			if (ppFinger !== 7 && prevFinger !== 7 && finger !== 7) {
				cat = 'weak redirect';
			}
		}
	}

	if (
		(ppFinger <= 5 && prevFinger >= 6 && finger <= 5) ||
		(ppFinger >= 6 && prevFinger <= 5 && finger >= 6)
	) {
		cat = 'alt';
		if (ppFinger === finger && ppChar !== char) {
			cat = 'alt sfs';
		}
	} else if (ppFinger <= 5 && prevFinger <= 5 && finger >= 6 && ppFinger < prevFinger) {
		cat = 'bigram roll in';
	} else if (ppFinger >= 6 && prevFinger <= 5 && finger <= 5 && prevFinger < finger) {
		cat = 'bigram roll in';
	} else if (ppFinger <= 5 && prevFinger <= 5 && finger >= 6 && ppFinger > prevFinger) {
		cat = 'bigram roll out';
	} else if (ppFinger >= 6 && prevFinger <= 5 && finger <= 5 && prevFinger > finger) {
		cat = 'bigram roll out';
	} else if (ppFinger >= 6 && prevFinger >= 6 && finger <= 5 && ppFinger > prevFinger) {
		cat = 'bigram roll in';
	} else if (ppFinger <= 5 && prevFinger >= 6 && finger >= 6 && prevFinger > finger) {
		cat = 'bigram roll in';
	} else if (ppFinger >= 6 && prevFinger >= 6 && finger <= 5 && ppFinger < prevFinger) {
		cat = 'bigram roll out';
	} else if (ppFinger <= 5 && prevFinger >= 6 && finger >= 6 && prevFinger < finger) {
		cat = 'bigram roll out';
	}

	return cat;
}

/**
 * @param {CharPositionMap} charMap
 * @param {WordFrequencyMap} words
 * @param {Record<string, number>} wordEffort
 * @param {number[][]} effortGrid
 * @param {import('../src/lib/layout.js').BoardType} [board]
 * @param {(word: string) => string} [rewriteWord] Cyanophage `modWord` rewrite
 * @returns {CyanophageStats | null}
 */
export function measureLayoutStats(
	charMap,
	words,
	wordEffort,
	effortGrid,
	board = 'ortho',
	rewriteWord
) {
	let inputLength = 0;
	let totalWordEffort = 0;
	let effortSum = 0;
	let distanceSum = 0;
	let sfb = 0;
	let sfs = 0;
	let scissors = 0;
	let lsb = 0;
	let alternate = 0;
	let altSfs = 0;
	let roll = 0;
	let rollIn = 0;
	let rollOut = 0;
	let rollIn2 = 0;
	let rollOut2 = 0;
	let rollIn3 = 0;
	let rollOut3 = 0;
	let redirect = 0;
	let redirectWeak = 0;
	let lh = 0;
	let rh = 0;
	/** @type {Record<string, number>} */
	const fingerUsage = Object.fromEntries(CYANOPHAGE_FINGER_STAT_KEYS.map((key) => [key, 0]));
	/** @type {Record<string, number>} */
	const fingerDistance = Object.fromEntries(
		CYANOPHAGE_FINGER_STAT_KEYS.map((key) => [`distance-${key}`, 0])
	);
	let wordCount = 0;

	for (const word in words) {
		if (wordCount >= MAX_WORDS) break;
		wordCount += 1;

		const count = words[word];
		// Cyanophage accumulates input length from the original word, then scores
		// the Magic/Repeat-rewritten form (`keyboard_svg_magic.js` measureWords).
		inputLength += count * (word.length + 1);
		const typedWord = rewriteWord ? rewriteWord(word) : word;
		const wordLen = typedWord.length;

		if (wordEffort[typedWord]) {
			totalWordEffort += wordEffort[typedWord] * count;
		}

		const fingerPositions = FINGER_HOME_POSITIONS.map(([row, col]) => ({ row, col }));
		let prevChar = '';
		let prevCol = -1;
		let prevRow = -1;
		let prevFinger = -1;
		let ppFinger = -1;
		let ppChar = '';

		for (let i = 0; i < wordLen; i++) {
			const char = typedWord.charAt(i);
			if (i > 0) prevChar = typedWord.charAt(i - 1);

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
			const fingerKey = CYANOPHAGE_FINGER_ID_TO_KEY[finger];
			if (fingerKey) {
				fingerUsage[fingerKey] += count;

				const previousPosition = fingerPositions[finger];
				if (previousPosition) {
					const distance =
						physicalDistance(
							getPhysicalPosition(row, col, board),
							getPhysicalPosition(previousPosition.row, previousPosition.col, board)
						) * count;
					distanceSum += distance;
					fingerDistance[`distance-${fingerKey}`] += distance;
					fingerPositions[finger] = { row, col };
				}
			}

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

			if (i > 1 && prevCol >= 0) {
				if (finger === ppFinger && ppChar !== char) {
					sfs += count;
				}

				const cat = classifyTrigram(ppFinger, prevFinger, finger, ppChar, char);
				if (cat === 'alt') {
					alternate += count;
				} else if (cat === 'alt sfs') {
					altSfs += count;
				} else if (cat === 'redirect') {
					redirect += count;
				} else if (cat === 'weak redirect') {
					redirect += count;
					redirectWeak += count;
				} else if (cat === 'roll in') {
					roll += count;
					rollIn += count;
					rollIn3 += count;
				} else if (cat === 'roll out') {
					roll += count;
					rollOut += count;
					rollOut3 += count;
				} else if (cat === 'bigram roll in') {
					roll += count;
					rollIn += count;
					rollIn2 += count;
				} else if (cat === 'bigram roll out') {
					roll += count;
					rollOut += count;
					rollOut2 += count;
				}
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
	const distanceScale = DISTANCE_DISPLAY_MULTIPLIER * invInputLength;
	for (const key of CYANOPHAGE_FINGER_DISTANCE_STAT_KEYS) {
		fingerDistance[key] *= distanceScale;
	}

	let fingerTotal = 0;
	for (const key of CYANOPHAGE_FINGER_STAT_KEYS) {
		fingerTotal += fingerUsage[key];
	}
	const invFingerTotal = fingerTotal > 0 ? 1 / fingerTotal : 0;
	for (const key of CYANOPHAGE_FINGER_STAT_KEYS) {
		fingerUsage[key] *= invFingerTotal;
	}

	return /** @type {CyanophageStats} */ ({
		totalWordEffort: totalWordEffort / TOTAL_WORD_EFFORT_DISPLAY_DIVISOR,
		effort: EFFORT_DISPLAY_MULTIPLIER * effortSum * invInputLength,
		distance: distanceSum * distanceScale,
		sfb: sfb * invInputLength,
		sfs: sfs * invInputLength,
		scissors: scissors * invInputLength,
		lsb: lsb * invInputLength,
		alternate: alternate * invInputLength,
		'alt-sfs': altSfs * invInputLength,
		roll: roll * invInputLength,
		'roll-in': rollIn * invInputLength,
		'roll-out': rollOut * invInputLength,
		'roll-in-2': rollIn2 * invInputLength,
		'roll-out-2': rollOut2 * invInputLength,
		'roll-in-3': rollIn3 * invInputLength,
		'roll-out-3': rollOut3 * invInputLength,
		redirect: redirect * invInputLength,
		'redirect-weak': redirectWeak * invInputLength,
		lh: handTotal > 0 ? lh / handTotal : 0.5,
		rh: handTotal > 0 ? rh / handTotal : 0.5,
		...fingerUsage,
		...fingerDistance
	});
}

/**
 * @deprecated Use measureLayoutStats.
 * @param {CharPositionMap} charMap
 * @param {WordFrequencyMap} words
 * @param {Record<string, number>} wordEffort
 * @param {number[][]} effortGrid
 */
export function measureCorpusEffort(charMap, words, wordEffort, effortGrid) {
	return measureLayoutStats(charMap, words, wordEffort, effortGrid);
}

/**
 * @param {CyanophageStats} stats
 * @returns {CompactCyanophageStats}
 */
export function encodeCyanophageStats(stats) {
	return CYANOPHAGE_STAT_KEYS.map((key) => {
		const value =
			key === 'total-word-effort'
				? stats.totalWordEffort
				: stats[/** @type {keyof CyanophageStats} */ (key)];
		return Math.round(value * CYANOPHAGE_STAT_VALUE_SCALE);
	});
}

/**
 * @param {{
 *   keys?: Record<string, { row: number, col: number, finger?: string }>,
 *   board?: import('../src/lib/layout.js').BoardType,
 *   cyanophageThumb?: 'l' | 'r'
 * }} rawLayout
 * @param {CyanophageData | null} data
 * @param {{ magicMappings?: unknown }} [options]
 * @returns {CompactCyanophageStats | null}
 */
export function buildCyanophageStats(rawLayout, data, options = {}) {
	if (!data?.words || !rawLayout?.keys) return null;
	if (!isCyanophageMeasurable(rawLayout.keys)) return null;

	const contextual = prepareCyanophageContextualRewrite(options.magicMappings, rawLayout.keys);
	// Never publish base or partially contextual stats for a Magic layout whose
	// default profile Cyanophage cannot model faithfully.
	if (hasMagicKey(rawLayout.keys, options.magicMappings) && !contextual?.magicKey) return null;

	const board = rawLayout.board ?? 'ortho';
	const thumb = rawLayout.cyanophageThumb ?? resolveCyanophageThumb(rawLayout.keys) ?? 'l';
	const charMap = buildCyanophageCharPositionMap(rawLayout.keys, board, thumb);
	if (charMap.size === 0) return null;

	const wordEffort = measureDictionaryWordEffort(charMap, data.effortWords, data.bigramEffort);
	const stats = measureLayoutStats(
		charMap,
		data.words,
		wordEffort,
		data.effortGrid,
		board,
		contextual?.rewrite
	);
	if (!stats) return null;

	return encodeCyanophageStats(stats);
}
