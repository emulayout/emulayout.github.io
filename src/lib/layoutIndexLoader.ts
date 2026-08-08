import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import { deserializeFingerWorkload, parseStatLimitsParam } from '$lib/filterUrlCodec';
import {
	parseStatsAnalyzerMode,
	parseStatsCorpus,
	STATS_CORPUS_STORAGE_KEY,
	type StatsCorpus
} from '$lib/statsAnalyzers';
import { analyzersNeededForLoad } from '$lib/statsUsage';
import { isStatSortBy, normalizeSortBy, type SortBy } from '$lib/statsSorting';
import { loadAnalyzerStats } from '$lib/layoutStatsLoader';
import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
import type { LayoutSupplementalByLayout } from '$lib/layoutSupplemental';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Read the dump-backed corpus preference before uiPrefs hydrates. */
function readPreferredStatsCorpus(): StatsCorpus {
	try {
		if (typeof localStorage === 'undefined') return parseStatsCorpus(undefined);
		return parseStatsCorpus(localStorage.getItem(STATS_CORPUS_STORAGE_KEY));
	} catch {
		return parseStatsCorpus(undefined);
	}
}

export async function loadLayoutIndexData(fetcher: Fetcher, url: URL) {
	const loadLikes = url.searchParams.get('likes') !== '0';
	const sortParam = url.searchParams.get('sort');
	const statsAnalyzerMode = parseStatsAnalyzerMode(url.searchParams.get('analyzer'));
	const statsCorpus = readPreferredStatsCorpus();
	const parsedSortBy: SortBy = (sortParam ? normalizeSortBy(sortParam) : undefined) ?? 'date';
	const sortBy: SortBy = !loadLikes && parsedSortBy === 'likes' ? 'date' : parsedSortBy;
	const needsStatsForSort = isStatSortBy(sortBy);
	const loadStats = url.searchParams.get('stats') !== '0' || needsStatsForSort;
	const analyzersToPreload = analyzersNeededForLoad({
		showStats: loadStats,
		displayMode: statsAnalyzerMode,
		limits: parseStatLimitsParam(url.searchParams.get('statLimits')),
		fingerWorkload: deserializeFingerWorkload(url.searchParams.get('fingerWorkload')),
		sortBy
	});

	const [layoutsResponse, authorsResponse, supplementalResponse, likesResponse, statsResults] =
		await Promise.all([
			fetcher('/all-layouts.json'),
			fetcher('/authors.json'),
			fetcher('/layout-supplemental.json'),
			loadLikes ? fetcher('/layout-likes.json') : Promise.resolve(null),
			Promise.all(
				analyzersToPreload.map((analyzer) =>
					loadAnalyzerStats(analyzer, { fetch: fetcher, corpus: statsCorpus })
				)
			)
		]);

	const compactLayouts: CompactLayoutFile = await layoutsResponse.json();
	const layouts: LayoutData[] = decodeLayouts(compactLayouts);
	const authorsData: Record<string, number> = await authorsResponse.json();
	const supplemental: LayoutSupplementalByLayout = supplementalResponse.ok
		? await supplementalResponse.json()
		: {};
	const likesData: LayoutLikesMap =
		likesResponse && likesResponse.ok ? await likesResponse.json() : {};

	layoutStatsStore.reset(statsCorpus);

	const statsMaps: StatsMaps = {};
	for (let i = 0; i < analyzersToPreload.length; i++) {
		const analyzer = analyzersToPreload[i];
		const result = statsResults[i];
		if (result.status === 'loaded') {
			Object.assign(statsMaps, { [analyzer]: result.map });
			layoutStatsStore.hydrate(analyzer, result.map);
		} else if (result.status === 'error') {
			layoutStatsStore.setLoadError(analyzer, result.error);
		}
	}

	return {
		layouts,
		authorsData,
		supplemental,
		likesData,
		/** True when the load function attempted to fetch likes (even if empty/404). */
		likesAttempted: loadLikes,
		statsMaps
	};
}
