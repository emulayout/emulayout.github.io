/**
 * Shared on-disk / published URL paths for analyzer×corpus stats artifacts.
 * Keep in sync with `src/lib/statsAnalyzers.ts` dataset URLs.
 */

/** @param {string} corpus */
export function cminiCompactStatsRelPath(corpus) {
	return `static/layout-stats-cmini-${corpus}.json`;
}

/** @param {string} corpus */
export function cminiExtendedStatsRelPath(corpus) {
	return `static/layout-stats-cmini-extended-${corpus}.json`;
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
export function mana2ExtendedStatsRelPath(corpus, board, space) {
	return `static/layout-stats-mana2-extended-${corpus}-${board}-${space}.json`;
}

/** @param {string} corpus */
export function cminiCompactStatsUrl(corpus) {
	return `/layout-stats-cmini-${corpus}.json`;
}

/** @param {string} corpus */
export function cminiExtendedStatsUrl(corpus) {
	return `/layout-stats-cmini-extended-${corpus}.json`;
}

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function mana2StatsUrl(corpus, board, space) {
	return `/layout-stats-mana2-${corpus}-${board}-${space}.json`;
}

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function mana2ExtendedStatsUrl(corpus, board, space) {
	return `/layout-stats-mana2-extended-${corpus}-${board}-${space}.json`;
}
