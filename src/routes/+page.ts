import type { LayoutData, LayoutStatsMap } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import { isSortOption, isStatSortOption } from '$lib/layoutStats';
import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const sortParam = url.searchParams.get('sort');
	const needsStatsForSort = sortParam !== null && isSortOption(sortParam) && isStatSortOption(sortParam);
	const loadStats = url.searchParams.get('stats') !== '0' || needsStatsForSort;

	const [layoutsResponse, authorsResponse, statsResponse] = await Promise.all([
		fetch('/all-layouts.json'),
		fetch('/authors.json'),
		loadStats ? fetch('/layout-stats.json') : Promise.resolve(null)
	]);

	const compactLayouts: CompactLayoutFile = await layoutsResponse.json();
	const layouts: LayoutData[] = decodeLayouts(compactLayouts);
	const authorsData: Record<string, number> = await authorsResponse.json();

	let layoutStats: LayoutStatsMap = {};

	if (loadStats && statsResponse) {
		layoutStats = statsResponse.ok ? await statsResponse.json() : {};
		layoutStatsStore.hydrate(layoutStats);
	} else {
		layoutStatsStore.reset();
	}

	return {
		layouts,
		authorsData,
		layoutStats
	};
};
