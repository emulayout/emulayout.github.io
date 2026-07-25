import type { LayoutData, LayoutLikesMap } from '$lib/layout';
import { getLatestLayoutDayKey } from '$lib/recentLayouts';

/**
 * Shared catalog for shell UI (e.g. quick-find modal) that lives outside +page.
 * Hydrated once from the page load data.
 */
class LayoutsCatalog {
	layouts: LayoutData[] = $state([]);
	authorsData: Record<string, number> = $state({});
	likesData: LayoutLikesMap = $state({});
	latestLayoutDayKey = $derived(getLatestLayoutDayKey(this.layouts));

	hydrate(layouts: LayoutData[], authorsData: Record<string, number>, likesData: LayoutLikesMap) {
		this.layouts = layouts;
		this.authorsData = authorsData;
		this.likesData = likesData;
	}
}

export const layoutsCatalog = new LayoutsCatalog();
