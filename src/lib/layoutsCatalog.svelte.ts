import type { LayoutData } from '$lib/layout';
import { getLatestLayoutDayKey } from '$lib/recentLayouts';

/**
 * Shared catalog for shell UI (e.g. selected-layouts / quick-find modals) that lives outside +page.
 * Hydrated once from the page load data.
 */
class LayoutsCatalog {
	layouts: LayoutData[] = $state([]);
	authorsData: Record<string, number> = $state({});
	latestLayoutDayKey = $derived(getLatestLayoutDayKey(this.layouts));

	hydrate(layouts: LayoutData[], authorsData: Record<string, number>) {
		this.layouts = layouts;
		this.authorsData = authorsData;
	}
}

export const layoutsCatalog = new LayoutsCatalog();
