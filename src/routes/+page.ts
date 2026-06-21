import type { LayoutData, LayoutStatsMap } from '$lib/layout';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [layoutsResponse, authorsResponse, statsResponse] = await Promise.all([
		fetch('/all-layouts.json'),
		fetch('/authors.json'),
		fetch('/layout-stats.json')
	]);

	const layouts: LayoutData[] = await layoutsResponse.json();
	const authorsData: Record<string, number> = await authorsResponse.json();
	const layoutStats: LayoutStatsMap = statsResponse.ok ? await statsResponse.json() : {};

	return {
		layouts,
		authorsData,
		layoutStats
	};
};
