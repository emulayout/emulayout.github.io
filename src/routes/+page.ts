import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import {
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	getStatSortAnalyzer,
	isSortBy,
	isStatSortBy,
	isStatsAnalyzer,
	parseLegacySortParam,
	type SortBy,
	type StatsAnalyzer
} from '$lib/layoutStats';
import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
import type { PageLoad } from './$types';

function getInitialStatsAnalyzer(url: URL): StatsAnalyzer {
	const analyzer = url.searchParams.get('analyzer');
	return analyzer && isStatsAnalyzer(analyzer) ? analyzer : DEFAULT_STATS_ANALYZER;
}

function getAnalyzersToPreload(
	loadStats: boolean,
	statsAnalyzer: StatsAnalyzer,
	sortBy: SortBy
): StatsAnalyzer[] {
	const analyzers = new Set<StatsAnalyzer>();

	if (loadStats) {
		analyzers.add(statsAnalyzer);
	}

	if (isStatSortBy(sortBy)) {
		const sortAnalyzer = getStatSortAnalyzer(sortBy, statsAnalyzer);
		if (sortAnalyzer) analyzers.add(sortAnalyzer);
	}

	return [...analyzers];
}

export const load: PageLoad = async ({ fetch, url }) => {
	const loadLikes = url.searchParams.get('likes') !== '0';
	const sortParam = url.searchParams.get('sort');
	const legacySort = sortParam ? parseLegacySortParam(sortParam) : undefined;
	const parsedSortBy: SortBy =
		legacySort?.sortBy ?? (sortParam && isSortBy(sortParam) ? sortParam : 'date');
	const sortBy: SortBy = !loadLikes && parsedSortBy === 'likes' ? 'date' : parsedSortBy;
	const statsAnalyzer = getInitialStatsAnalyzer(url);
	const needsStatsForSort = isStatSortBy(sortBy);
	const loadStats = url.searchParams.get('stats') !== '0' || needsStatsForSort;
	const analyzersToPreload = getAnalyzersToPreload(loadStats, statsAnalyzer, sortBy);

	const [layoutsResponse, authorsResponse, likesResponse, ...statsResponses] = await Promise.all([
		fetch('/all-layouts.json'),
		fetch('/authors.json'),
		loadLikes ? fetch('/layout-likes.json') : Promise.resolve(null),
		...analyzersToPreload.map((analyzer) =>
			fetch(analyzer === CYANOPHAGE_ANALYZER ? '/layout-stats-cyanophage.json' : '/layout-stats.json')
		)
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
		const response = statsResponses[i];
		const map = response.ok ? await response.json() : {};
		statsMaps[analyzer] = map;
		layoutStatsStore.hydrate(analyzer, map);
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
