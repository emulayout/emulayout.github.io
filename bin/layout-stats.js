import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Subset of cmini cache stats that match the Discord bot display.
 *
 * Bot lines and their source fields:
 * - Alt  → alternate
 * - Rol  → roll-in, roll-out
 * - One  → oneh-in, oneh-out
 * - Rtl  → all four roll/oneh fields (derived at read time)
 * - Red  → redirect, bad-redirect
 * - SFS  → dsfb-red, dsfb-alt
 *
 * Excluded (not in cache or not a bot match without extra work):
 * - sfb, lh/rh
 */

/** Corpus exported to the site (matches cmini Discord bot default). */
export const DEFAULT_STATS_CORPUS = 'monkeyracer';

/** @type {readonly ['alternate', 'roll-in', 'roll-out', 'oneh-in', 'oneh-out', 'redirect', 'bad-redirect', 'dsfb-red', 'dsfb-alt']} */
export const BOT_STAT_KEYS = [
	'alternate',
	'roll-in',
	'roll-out',
	'oneh-in',
	'oneh-out',
	'redirect',
	'bad-redirect',
	'dsfb-red',
	'dsfb-alt'
];

/** @typedef {Record<(typeof BOT_STAT_KEYS)[number], number>} CorpusStats */

/**
 * @param {Record<string, Record<string, number>>} cacheData
 * @returns {CorpusStats | null}
 */
function extractCorpusStats(cacheData) {
	const stats = cacheData[DEFAULT_STATS_CORPUS];
	if (!stats) return null;
	return transformCorpusStats(stats);
}
/**
 * @param {Record<string, number>} stats
 * @returns {CorpusStats}
 */
function transformCorpusStats(stats) {
	/** @type {CorpusStats} */
	const result = {};

	for (const key of BOT_STAT_KEYS) {
		if (key in stats) {
			result[key] = stats[key];
		}
	}

	return result;
}

/**
 * @param {string} cacheDir
 * @param {string} layoutFilename
 * @returns {Promise<CorpusStats | null>}
 */
export async function readLayoutCacheStats(cacheDir, layoutFilename) {
	const cacheName = layoutFilename.replace(/\.json$/i, '');
	const cachePath = join(cacheDir, 'cache', `${cacheName}.json`);

	try {
		const content = await readFile(cachePath, 'utf-8');
		return extractCorpusStats(JSON.parse(content));
	} catch {
		return null;
	}
}
