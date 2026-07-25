import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import { parseStatLimitsParam } from '$lib/filterStore.svelte';
import {
	analyzersNeededForLoad,
	isStatSortBy,
	normalizeSortBy,
	parseLegacySortParam,
	parseStatsAnalyzerMode,
	type SortBy,
	type StatsAnalyzerMode
} from '$lib/layoutStats';
import { loadAnalyzerStats } from '$lib/layoutStatsLoader';
import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
import type { PageLoad } from './$types';

function getInitialStatsAnalyzerMode(url: URL): StatsAnalyzerMode {
	return parseStatsAnalyzerMode(url.searchParams.get('analyzer'));
}

export const load: PageLoad = async ({ fetch, url }) => {
	const loadLikes = url.searchParams.get('likes') !== '0';
	const sortParam = url.searchParams.get('sort');
	const statsAnalyzerMode = getInitialStatsAnalyzerMode(url);
	const legacySort = sortParam ? parseLegacySortParam(sortParam) : undefined;
	const parsedSortBy: SortBy =
		legacySort?.sortBy ??
		(sortParam ? normalizeSortBy(sortParam, statsAnalyzerMode) : undefined) ??
		'date';
	const sortBy: SortBy = !loadLikes && parsedSortBy === 'likes' ? 'date' : parsedSortBy;
	const needsStatsForSort = isStatSortBy(sortBy);
	const loadStats = url.searchParams.get('stats') !== '0' || needsStatsForSort;
	const analyzersToPreload = analyzersNeededForLoad({
		showStats: loadStats,
		displayMode: statsAnalyzerMode,
		limits: parseStatLimitsParam(url.searchParams.get('statLimits')),
		sortBy
	});

	const [layoutsResponse, authorsResponse, likesResponse, statsResults] = await Promise.all([
		fetch('/all-layouts.json'),
		fetch('/authors.json'),
		loadLikes ? fetch('/layout-likes.json') : Promise.resolve(null),
		Promise.all(analyzersToPreload.map((analyzer) => loadAnalyzerStats(analyzer, { fetch })))
	]);

	const compactLayouts: CompactLayoutFile = await layoutsResponse.json();
	const layouts: LayoutData[] = decodeLayouts(compactLayouts);
	const authorsData: Record<string, number> = await authorsResponse.json();
	const likesData: LayoutLikesMap =
		likesResponse && likesResponse.ok ? await likesResponse.json() : {};

	layoutStatsStore.reset();

	const statsMaps: StatsMaps = {};
	for (let i = 0; i < analyzersToPreload.length; i++) {
		const analyzer = analyzersToPreload[i];
		const result = statsResults[i];
		if (result.status === 'loaded') {
			statsMaps[analyzer] = result.map;
			layoutStatsStore.hydrate(analyzer, result.map);
		} else if (result.status === 'error') {
			layoutStatsStore.setLoadError(analyzer, result.error);
		}
	}

	return {
		layouts,
		authorsData,
		likesData,
		/** True when the load function attempted to fetch likes (even if empty/404). */
		likesAttempted: loadLikes,
		statsMaps
	};
};
