import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	FINGERS,
	buildFingerIndex,
	computeTrigramStats,
	fingerUsage,
	handUse,
	sfbBigram
} from './cmini-analyzer.js';
import {
	fingerprintCorpusBuffers,
	getCachedLayoutStats,
	hashLayoutContent,
	setCachedLayoutStats
} from './layout-stats-cache.js';

/**
 * Layout stats for the site (monkeyracer analyzer).
 *
 * Trigram stats (Alt, Rol, Red, SFS, …), SFB, LH/RH, and per-finger usage are
 * always computed at sync time from the monkeyracer corpus. cmini cache files
 * are only used by verify-monkeyracer-stats as a drift canary — when a few
 * layouts disagree, our computation wins (bad upstream caches are more likely
 * than a layout-specific analyzer bug).
 */

/** Analyzer id exported to the site (matches cmini Discord bot default). */
export const DEFAULT_STATS_ANALYZER = 'monkeyracer';

/** @type {readonly ['alternate', 'roll-in', 'roll-out', 'oneh-in', 'oneh-out', 'redirect', 'bad-redirect', 'dsfb-red', 'dsfb-alt', 'sfb', 'lh', 'rh', ...typeof FINGERS]} */
export const BOT_STAT_KEYS = [
	'alternate',
	'roll-in',
	'roll-out',
	'oneh-in',
	'oneh-out',
	'redirect',
	'bad-redirect',
	'dsfb-red',
	'dsfb-alt',
	'sfb',
	'lh',
	'rh',
	...FINGERS
];

const COMPUTED_STAT_KEYS = new Set(['sfb', 'lh', 'rh', ...FINGERS]);

/** Trigram stats from cache (excludes sync-computed fields). */
export const TRIGRAM_STAT_KEYS = BOT_STAT_KEYS.filter((key) => !COMPUTED_STAT_KEYS.has(key));

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const STAT_VALUE_SCALE = 10_000;

const CORPUS_FILES = ['bigrams.json', 'monograms.json', 'trigrams.json'];

/** Cache is usable when cmini produced a real trigram distribution. */
export function isValidTrigramStats(stats) {
	return (stats.alternate ?? 0) > 0;
}

/** @typedef {Record<(typeof BOT_STAT_KEYS)[number], number>} MonkeyracerStats */

/** @typedef {number[]} CompactLayoutStats */

/**
 * @typedef {{
 *   bigrams: Record<string, number>,
 *   monograms: Record<string, number>,
 *   trigrams: Record<string, number>,
 *   fingerprint: string
 * }} CorpusData
 */

/**
 * Load monkeyracer corpus once; fingerprint uses the same file bytes.
 * @param {string} cacheDir
 * @param {string} corpus
 * @returns {Promise<CorpusData>}
 */
export async function loadCorpusData(cacheDir, corpus = DEFAULT_STATS_ANALYZER) {
	const base = join(cacheDir, 'corpora', corpus);
	const buffers = await Promise.all(CORPUS_FILES.map((filename) => readFile(join(base, filename))));
	const fingerprint = fingerprintCorpusBuffers(buffers);
	const [bigrams, monograms, trigrams] = buffers.map((buffer) => JSON.parse(buffer.toString('utf-8')));
	return { bigrams, monograms, trigrams, fingerprint };
}

/**
 * @param {Record<string, number> | null | undefined} stats
 * @returns {MonkeyracerStats | null}
 */
function extractTrigramStats(stats) {
	if (!stats) return null;

	/** @type {MonkeyracerStats} */
	const result = {};
	for (const key of TRIGRAM_STAT_KEYS) {
		if (key in stats) result[key] = stats[key];
	}
	if (!isValidTrigramStats(result)) return null;
	return result;
}

/**
 * @param {object} rawLayout
 * @param {CorpusData | null} corpusData
 * @param {import('./cmini-analyzer.js').FingerIndex} [index]
 * @returns {Promise<MonkeyracerStats | null>}
 */
async function computeLayoutTrigramStats(rawLayout, corpusData, index) {
	if (!corpusData?.trigrams || !rawLayout?.keys) return null;
	const stats = await computeTrigramStats(rawLayout.keys, corpusData.trigrams, index);
	return extractTrigramStats(stats);
}

/**
 * @param {object} rawLayout
 * @param {MonkeyracerStats} cacheStats
 * @param {CorpusData | null} corpusData
 * @param {import('./cmini-analyzer.js').FingerIndex} [index]
 * @returns {MonkeyracerStats}
 */
export function mergeLayoutStats(rawLayout, cacheStats, corpusData, index) {
	/** @type {MonkeyracerStats} */
	const stats = {
		...cacheStats,
		sfb: 0,
		lh: 0,
		rh: 0,
		...Object.fromEntries(FINGERS.map((finger) => [finger, 0]))
	};

	if (!corpusData?.bigrams || !corpusData?.monograms || !corpusData?.trigrams || !rawLayout?.keys) {
		return stats;
	}

	const fingerIndex = index ?? buildFingerIndex(rawLayout.keys);

	const sfb = sfbBigram(rawLayout.keys, corpusData.bigrams, fingerIndex);
	if (sfb !== null) stats.sfb = sfb;

	const use = handUse(rawLayout.keys, corpusData.monograms, fingerIndex);
	if (use) {
		stats.lh = use.lh;
		stats.rh = use.rh;
	}

	const fingers = fingerUsage(rawLayout.keys, corpusData.trigrams, fingerIndex);
	if (fingers) {
		for (const finger of FINGERS) {
			stats[finger] = fingers[finger];
		}
	}

	return stats;
}

/**
 * @param {MonkeyracerStats} stats
 * @returns {CompactLayoutStats}
 */
export function encodeMonkeyracerStats(stats) {
	return BOT_STAT_KEYS.map((key) => Math.round((stats[key] ?? 0) * STAT_VALUE_SCALE));
}

/**
 * @param {string} cacheDir
 * @param {string} layoutFilename
 * @param {object} rawLayout
 * @param {CorpusData | null} corpusData
 * @param {{ statsCache?: import('./layout-stats-cache.js').StatsCacheContext, layoutContent?: string }} [options]
 * @returns {Promise<CompactLayoutStats | null>}
 */
export async function buildLayoutStats(_cacheDir, layoutFilename, rawLayout, corpusData, options = {}) {
	const layoutContent = options.layoutContent ?? JSON.stringify(rawLayout);
	const layoutHash = hashLayoutContent(layoutContent);
	const statsCache = options.statsCache;
	const trigramSourceHash = 'computed';

	if (statsCache) {
		const cached = getCachedLayoutStats(
			statsCache,
			layoutFilename,
			layoutHash,
			trigramSourceHash
		);
		if (cached) return cached;
	}

	const index = rawLayout?.keys ? buildFingerIndex(rawLayout.keys) : undefined;
	const trigramStats = await computeLayoutTrigramStats(rawLayout, corpusData, index);
	if (!trigramStats) return null;

	const stats = encodeMonkeyracerStats(
		mergeLayoutStats(rawLayout, trigramStats, corpusData, index)
	);

	if (statsCache) {
		setCachedLayoutStats(
			statsCache,
			layoutFilename,
			layoutHash,
			trigramSourceHash,
			stats
		);
	}

	return stats;
}
