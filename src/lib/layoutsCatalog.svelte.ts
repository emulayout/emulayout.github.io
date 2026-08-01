import type { LayoutData, LayoutLikesMap } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import { getLatestLayoutDayKey } from '$lib/recentLayouts';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Shared catalog for shell UI (e.g. quick-find modal) that lives outside +page.
 * Hydrated once from the page load data.
 */
class LayoutsCatalog {
	layouts: LayoutData[] = $state([]);
	authorsData: Record<string, number> = $state({});
	likesData: LayoutLikesMap = $state({});
	layoutNames: string[] = $state([]);
	fullCatalogLoaded = $state(false);
	namesLoaded = $state(false);
	loading = $state(false);
	loadError: Error | null = $state(null);
	latestLayoutDayKey = $derived(getLatestLayoutDayKey(this.layouts));

	#catalogRequest: Promise<void> | null = null;
	#namesRequest: Promise<void> | null = null;

	hydrate(layouts: LayoutData[], authorsData: Record<string, number>, likesData: LayoutLikesMap) {
		this.layouts = layouts;
		this.authorsData = authorsData;
		this.likesData = likesData;
		this.layoutNames = layouts.map((layout) => layout.name);
		this.fullCatalogLoaded = true;
		this.namesLoaded = true;
		this.loadError = null;
	}

	async ensureNamesLoaded(fetcher: Fetcher = fetch): Promise<void> {
		if (this.namesLoaded) return;
		if (this.#namesRequest) return this.#namesRequest;
		this.#namesRequest = fetcher('/layout-names.json')
			.then(async (response) => {
				if (!response.ok) throw new Error(`Layout-name request failed (${response.status}).`);
				const names = (await response.json()) as unknown;
				if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
					throw new Error('Layout-name response was invalid.');
				}
				this.layoutNames = names;
				this.namesLoaded = true;
				this.loadError = null;
			})
			.catch((error) => {
				this.loadError = error instanceof Error ? error : new Error('Could not load layout names.');
			})
			.finally(() => {
				this.#namesRequest = null;
			});
		return this.#namesRequest;
	}

	async ensureLoaded(fetcher: Fetcher = fetch): Promise<void> {
		if (this.fullCatalogLoaded) return;
		if (this.#catalogRequest) return this.#catalogRequest;

		this.loading = true;
		this.#catalogRequest = Promise.all([
			fetcher('/all-layouts.json'),
			fetcher('/authors.json'),
			fetcher('/layout-likes.json')
		])
			.then(async ([layoutsResponse, authorsResponse, likesResponse]) => {
				if (!layoutsResponse.ok || !authorsResponse.ok) {
					throw new Error('Could not load the layout catalog.');
				}
				const compactLayouts: CompactLayoutFile = await layoutsResponse.json();
				const authorsData: Record<string, number> = await authorsResponse.json();
				const likesData: LayoutLikesMap = likesResponse.ok ? await likesResponse.json() : {};
				this.hydrate(decodeLayouts(compactLayouts), authorsData, likesData);
			})
			.catch((error) => {
				this.loadError = error instanceof Error ? error : new Error('Could not load layouts.');
			})
			.finally(() => {
				this.loading = false;
				this.#catalogRequest = null;
			});
		return this.#catalogRequest;
	}
}

export const layoutsCatalog = new LayoutsCatalog();
