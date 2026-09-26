/**
 * Shared on-disk / published URL paths for analyzer×corpus stats artifacts.
 * Keep in sync with `src/lib/statsAnalyzers.ts` dataset URLs.
 */

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function cminiCompactStatsRelPath(corpus, board, space) {
	return `static/layout-stats-cmini-${corpus}-${board}-${space}.json`;
}

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function mana2StatsRelPath(corpus, board, space) {
	return `static/layout-stats-mana2-${corpus}-${board}-${space}.json`;
}

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function cminiCompactStatsUrl(corpus, board, space) {
	return `/layout-stats-cmini-${corpus}-${board}-${space}.json`;
}

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function mana2StatsUrl(corpus, board, space) {
	return `/layout-stats-mana2-${corpus}-${board}-${space}.json`;
}
