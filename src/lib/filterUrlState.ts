import {
	DEFAULT_STATS_ANALYZER,
	parseStatsAnalyzerMode,
	type StatsAnalyzerMode
} from './layoutStats';

/**
 * Filter/sort params that mean a saved view's live state differs from its
 * localStorage snapshot. Global display and compare params intentionally do
 * not appear here.
 */
const SAVED_VIEW_FILTER_URL_PARAMS = [
	'include',
	'exclude',
	'includeOr',
	'showUnfinished',
	'thumbKeys',
	'magicKey',
	'characterSet',
	'boardType',
	'name',
	'authors',
	'includeLeftThumbs',
	'includeRightThumbs',
	'excludeLeftThumbs',
	'excludeRightThumbs',
	'includeThumbs',
	'excludeThumbs',
	'includeOrLeftThumbs',
	'includeOrRightThumbs',
	'sort',
	'order',
	'similar',
	'similarFilter',
	'similarHome',
	'similarAnglemod',
	'similarMirror',
	'statLimits',
	'layouts',
	'showSelected'
] as const;

export function hasSavedViewFilterUrlOverrides(searchParams: URLSearchParams): boolean {
	return SAVED_VIEW_FILTER_URL_PARAMS.some((key) => searchParams.has(key));
}

export function writeSavedViewUrlState(
	searchParams: URLSearchParams,
	viewId: string,
	sourceOverride: string[] | null | undefined
): void {
	searchParams.set('view', viewId);
	searchParams.delete('layouts');
	if (sourceOverride !== undefined) {
		searchParams.set('layouts', sourceOverride === null ? '' : sourceOverride.join(','));
	}
}

export type GlobalFilterUrlState = {
	statsAnalyzer: StatsAnalyzerMode;
	hideLayoutStats: boolean;
	hideLayoutTestArea: boolean;
	hideLayoutLikes: boolean;
	hideNewLayoutIndicator: boolean;
	stickySimilarityCard: boolean;
	compareSelectedNames: Iterable<string>;
};

export function readGlobalFilterUrlState(searchParams: URLSearchParams): GlobalFilterUrlState {
	const compareSelectedNames = (searchParams.get('compare') ?? '')
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);

	return {
		statsAnalyzer: parseStatsAnalyzerMode(searchParams.get('analyzer')),
		hideLayoutStats: searchParams.get('stats') === '0',
		hideLayoutTestArea: searchParams.get('testArea') === '0',
		hideLayoutLikes: searchParams.get('likes') === '0',
		hideNewLayoutIndicator: searchParams.get('newIndicator') === '0',
		stickySimilarityCard: searchParams.get('stickySimilar') !== '0',
		compareSelectedNames
	};
}

export function writeGlobalFilterUrlState(
	searchParams: URLSearchParams,
	state: GlobalFilterUrlState
): void {
	for (const key of [
		'compare',
		'analyzer',
		'stats',
		'testArea',
		'likes',
		'newIndicator',
		'stickySimilar'
	]) {
		searchParams.delete(key);
	}

	const compareSelectedNames = Array.from(state.compareSelectedNames)
		.map((name) => name.trim())
		.filter(Boolean);
	if (compareSelectedNames.length > 0) {
		searchParams.set('compare', compareSelectedNames.join(','));
	}
	if (state.statsAnalyzer !== DEFAULT_STATS_ANALYZER) {
		searchParams.set('analyzer', state.statsAnalyzer);
	}
	if (state.hideLayoutStats) {
		searchParams.set('stats', '0');
	}
	if (state.hideLayoutTestArea) {
		searchParams.set('testArea', '0');
	}
	if (state.hideLayoutLikes) {
		searchParams.set('likes', '0');
	}
	if (state.hideNewLayoutIndicator) {
		searchParams.set('newIndicator', '0');
	}
	if (!state.stickySimilarityCard) {
		searchParams.set('stickySimilar', '0');
	}
}
