import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { handUse, sfbBigram } from './cmini-analyzer.js';

/**
 * Layout stats for the site (monkeyracer corpus).
 *
 * Trigram stats (Alt, Rol, Red, SFS, …) come from cmini cache.
 * SFB and LH/RH are computed at sync time — the cache `sfb` field is
 * trigram-derived and does not match the Discord bot (which uses bigrams).
 */

/** Corpus exported to the site (matches cmini Discord bot default). */
export const DEFAULT_STATS_CORPUS = 'monkeyracer';

/** @type {readonly ['alternate', 'roll-in', 'roll-out', 'oneh-in', 'oneh-out', 'redirect', 'bad-redirect', 'dsfb-red', 'dsfb-alt', 'sfb', 'lh', 'rh']} */
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
	'rh'
];

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const STAT_VALUE_SCALE = 10_000;

/** Trigram stats from cache (excludes computed sfb/lh/rh). */
export const TRIGRAM_STAT_KEYS = BOT_STAT_KEYS.filter((key) => key !== 'sfb' && key !== 'lh' && key !== 'rh');

/** Cache is usable when cmini produced a real trigram distribution. */
export function isValidTrigramStats(stats) {
	return (stats.alternate ?? 0) > 0;
}

/** @typedef {number[]} CompactLayoutStats */

/**
 * @param {string} cacheDir
 * @param {string} corpus
 */
export async function loadCorpusData(cacheDir, corpus = DEFAULT_STATS_CORPUS) {
	const base = join(cacheDir, 'corpora', corpus);
	const [bigrams, monograms] = await Promise.all([
		readFile(join(base, 'bigrams.json'), 'utf-8').then(JSON.parse),
		readFile(join(base, 'monograms.json'), 'utf-8').then(JSON.parse)
	]);
	return { bigrams, monograms };
}

/**
 * @param {Record<string, Record<string, number>>} cacheData
 * @returns {CorpusStats | null}
 */
function extractCacheTrigramStats(cacheData) {
	const stats = cacheData[DEFAULT_STATS_CORPUS];
	if (!stats) return null;

	/** @type {CorpusStats} */
	const result = {};
	for (const key of TRIGRAM_STAT_KEYS) {
		if (key in stats) result[key] = stats[key];
	}
	if (!isValidTrigramStats(result)) return null;
	return result;
}

/**
 * @param {object} rawLayout
 * @param {CorpusStats} cacheStats
 * @param {{ bigrams: Record<string, number>, monograms: Record<string, number> } | null} corpusData
 * @returns {CorpusStats}
 */
export function mergeLayoutStats(rawLayout, cacheStats, corpusData) {
	/** @type {CorpusStats} */
	const stats = { ...cacheStats, sfb: 0, lh: 0, rh: 0 };

	if (!corpusData?.bigrams || !corpusData?.monograms || !rawLayout?.keys) {
		return stats;
	}

	const sfb = sfbBigram(rawLayout.keys, corpusData.bigrams);
	if (sfb !== null) stats.sfb = sfb;

	const use = handUse(rawLayout.keys, corpusData.monograms);
	if (use) {
		stats.lh = use.lh;
		stats.rh = use.rh;
	}

	return stats;
}

/**
 * @param {CorpusStats} stats
 * @returns {CompactLayoutStats}
 */
export function encodeCorpusStats(stats) {
	return BOT_STAT_KEYS.map((key) => Math.round((stats[key] ?? 0) * STAT_VALUE_SCALE));
}

/**
 * @param {string} cacheDir
 * @param {string} layoutFilename
 * @param {object} rawLayout
 * @param {{ bigrams: Record<string, number>, monograms: Record<string, number> } | null} corpusData
 * @returns {Promise<CompactLayoutStats | null>}
 */
export async function buildLayoutStats(cacheDir, layoutFilename, rawLayout, corpusData) {
	const cacheName = layoutFilename.replace(/\.json$/i, '');
	const cachePath = join(cacheDir, 'cache', `${cacheName}.json`);

	try {
		const content = await readFile(cachePath, 'utf-8');
		const cacheStats = extractCacheTrigramStats(JSON.parse(content));
		if (!cacheStats) return null;
		return encodeCorpusStats(mergeLayoutStats(rawLayout, cacheStats, corpusData));
	} catch {
		return null;
	}
}
