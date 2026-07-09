import type { LayoutData } from '$lib/layout';

/**
 * Shared catalog for shell UI (e.g. recent-layouts modal) that lives outside +page.
 * Hydrated once from the page load data.
 */
class LayoutsCatalog {
	layouts: LayoutData[] = $state([]);
	authorsData: Record<string, number> = $state({});

	hydrate(layouts: LayoutData[], authorsData: Record<string, number>) {
		this.layouts = layouts;
		this.authorsData = authorsData;
	}
}

export const layoutsCatalog = new LayoutsCatalog();
