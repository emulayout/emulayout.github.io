import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	FINGERS,
	computeTrigramStats,
	fingerUsage,
	handUse,
	sfbBigram
} from './cmini-analyzer.js';
import {
	getCachedLayoutStats,
	hashLayoutContent,
	hashTrigramSource,
	setCachedLayoutStats
} from './layout-stats-cache.js';

/**
 * Layout stats for the site (monkeyracer analyzer).
 *
 * Trigram stats (Alt, Rol, Red, SFS, …) come from cmini cache when present,
 * otherwise computed from the monkeyracer corpus at sync time.
 * SFB, LH/RH, and per-finger usage are always computed at sync time.
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

/** Cache is usable when cmini produced a real trigram distribution. */
export function isValidTrigramStats(stats) {
	return (stats.alternate ?? 0) > 0;
}

/** @typedef {Record<(typeof BOT_STAT_KEYS)[number], number>} MonkeyracerStats */

/** @typedef {number[]} CompactLayoutStats */

/**
 * @param {string} cacheDir
 * @param {string} corpus
 */
export async function loadCorpusData(cacheDir, corpus = DEFAULT_STATS_ANALYZER) {
	const base = join(cacheDir, 'corpora', corpus);
	const [bigrams, monograms, trigrams] = await Promise.all([
		readFile(join(base, 'bigrams.json'), 'utf-8').then(JSON.parse),
		readFile(join(base, 'monograms.json'), 'utf-8').then(JSON.parse),
		readFile(join(base, 'trigrams.json'), 'utf-8').then(JSON.parse)
	]);
	return { bigrams, monograms, trigrams };
}

/**
 * @param {Record<string, Record<string, number>>} cacheData
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
 * @param {Record<string, Record<string, number>>} cacheData
 * @returns {MonkeyracerStats | null}
 */
function extractCacheTrigramStats(cacheData) {
	return extractTrigramStats(cacheData[DEFAULT_STATS_ANALYZER]);
}

/**
 * @param {object} rawLayout
 * @param {{ trigrams: Record<string, number> } | null} corpusData
 * @returns {Promise<MonkeyracerStats | null>}
 */
async function computeLayoutTrigramStats(rawLayout, corpusData) {
	if (!corpusData?.trigrams || !rawLayout?.keys) return null;
	const stats = await computeTrigramStats(rawLayout.keys, corpusData.trigrams);
	return extractTrigramStats(stats);
}

/**
 * @param {object} rawLayout
 * @param {MonkeyracerStats} cacheStats
 * @param {{ bigrams: Record<string, number>, monograms: Record<string, number>, trigrams: Record<string, number> } | null} corpusData
 * @returns {MonkeyracerStats}
 */
export function mergeLayoutStats(rawLayout, cacheStats, corpusData) {
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

	const sfb = sfbBigram(rawLayout.keys, corpusData.bigrams);
	if (sfb !== null) stats.sfb = sfb;

	const use = handUse(rawLayout.keys, corpusData.monograms);
	if (use) {
		stats.lh = use.lh;
		stats.rh = use.rh;
	}

	const fingers = fingerUsage(rawLayout.keys, corpusData.trigrams);
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
 * @param {{ bigrams: Record<string, number>, monograms: Record<string, number>, trigrams: Record<string, number> } | null} corpusData
 * @param {{ statsCache?: import('./layout-stats-cache.js').StatsCacheContext, layoutContent?: string }} [options]
 * @returns {Promise<CompactLayoutStats | null>}
 */
export async function buildLayoutStats(cacheDir, layoutFilename, rawLayout, corpusData, options = {}) {
	const cacheName = layoutFilename.replace(/\.json$/i, '');
	const cachePath = join(cacheDir, 'cache', `${cacheName}.json`);
	const layoutContent = options.layoutContent ?? JSON.stringify(rawLayout);
	const layoutHash = hashLayoutContent(layoutContent);
	const statsCache = options.statsCache;

	let trigramStats = null;
	let trigramSourceHash = null;

	try {
		const cminiCacheContent = await readFile(cachePath, 'utf-8');
		trigramSourceHash = hashTrigramSource(cminiCacheContent);
		if (statsCache) {
			const cached = getCachedLayoutStats(
				statsCache,
				layoutFilename,
				layoutHash,
				trigramSourceHash
			);
			if (cached) return cached;
		}
		trigramStats = extractCacheTrigramStats(JSON.parse(cminiCacheContent));
	} catch {
		// Cache file missing — fall back to sync-time computation below.
	}

	if (!trigramStats) {
		if (statsCache) {
			const cached = getCachedLayoutStats(
				statsCache,
				layoutFilename,
				layoutHash,
				'computed'
			);
			if (cached) return cached;
		}
		trigramStats = await computeLayoutTrigramStats(rawLayout, corpusData);
		trigramSourceHash = 'computed';
	}
	if (!trigramStats || !trigramSourceHash) return null;

	const stats = encodeMonkeyracerStats(mergeLayoutStats(rawLayout, trigramStats, corpusData));

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
