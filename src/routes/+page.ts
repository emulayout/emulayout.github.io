import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import { parseStatLimitsParam } from '$lib/filterUrlCodec';
import { parseStatsAnalyzerMode, type StatsAnalyzerMode } from '$lib/statsAnalyzers';
import { analyzersNeededForLoad } from '$lib/statsUsage';
import { isStatSortBy, normalizeSortBy, type SortBy } from '$lib/statsSorting';
import { loadAnalyzerStats } from '$lib/layoutStatsLoader';
import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
import type { MagicKeyMappingsByLayout } from '$lib/magicKeys';
import type { PageLoad } from './$types';

function getInitialStatsAnalyzerMode(url: URL): StatsAnalyzerMode {
	return parseStatsAnalyzerMode(url.searchParams.get('analyzer'));
}

export const load: PageLoad = async ({ fetch, url }) => {
	const loadLikes = url.searchParams.get('likes') !== '0';
	const sortParam = url.searchParams.get('sort');
	const statsAnalyzerMode = getInitialStatsAnalyzerMode(url);
	const parsedSortBy: SortBy = (sortParam ? normalizeSortBy(sortParam) : undefined) ?? 'date';
	const sortBy: SortBy = !loadLikes && parsedSortBy === 'likes' ? 'date' : parsedSortBy;
	const needsStatsForSort = isStatSortBy(sortBy);
	const loadStats = url.searchParams.get('stats') !== '0' || needsStatsForSort;
	const analyzersToPreload = analyzersNeededForLoad({
		showStats: loadStats,
		displayMode: statsAnalyzerMode,
		limits: parseStatLimitsParam(url.searchParams.get('statLimits')),
		sortBy
	});

	const [layoutsResponse, authorsResponse, magicKeyMappingsResponse, likesResponse, statsResults] =
		await Promise.all([
			fetch('/all-layouts.json'),
			fetch('/authors.json'),
			fetch('/magic-key-mappings.json'),
			loadLikes ? fetch('/layout-likes.json') : Promise.resolve(null),
			Promise.all(analyzersToPreload.map((analyzer) => loadAnalyzerStats(analyzer, { fetch })))
		]);

	const compactLayouts: CompactLayoutFile = await layoutsResponse.json();
	const layouts: LayoutData[] = decodeLayouts(compactLayouts);
	const authorsData: Record<string, number> = await authorsResponse.json();
	const magicKeyMappings: MagicKeyMappingsByLayout = magicKeyMappingsResponse.ok
		? await magicKeyMappingsResponse.json()
		: {};
	const likesData: LayoutLikesMap =
		likesResponse && likesResponse.ok ? await likesResponse.json() : {};

	layoutStatsStore.reset();

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
		magicKeyMappings,
		likesData,
		/** True when the load function attempted to fetch likes (even if empty/404). */
		likesAttempted: loadLikes,
		statsMaps
	};
};
