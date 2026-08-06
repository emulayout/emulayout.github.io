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

/** @param {string} corpus */
export function mana2StatsRelPath(corpus) {
	return `static/layout-stats-mana2-${corpus}.json`;
}

/** @param {string} corpus */
export function cminiCompactStatsUrl(corpus) {
	return `/layout-stats-cmini-${corpus}.json`;
}

/** @param {string} corpus */
export function cminiExtendedStatsUrl(corpus) {
	return `/layout-stats-cmini-extended-${corpus}.json`;
}

/** @param {string} corpus */
export function mana2StatsUrl(corpus) {
	return `/layout-stats-mana2-${corpus}.json`;
}
