import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';
import { decodeLayouts, type CompactLayoutFile } from '$lib/layoutCodec';
import { buildCatalogLayoutDetail, resolveAuthorName, type LayoutDetail } from '$lib/layoutDetails';
import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
import { getLatestLayoutDayKey } from '$lib/recentLayouts';
import { DEFAULT_STATS_CORPUS, type StatsCorpus } from '$lib/statsAnalyzers';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Shared catalog for shell UI (e.g. quick-find modal) that lives outside +page.
 * Hydrated once from the page load data.
 */
class LayoutsCatalog {
	layouts: LayoutData[] = $state([]);
	authorsData: Record<string, number> = $state({});
	likesData: LayoutLikesMap = $state({});
	inputProfiles: ReadonlyMap<string, LayoutInputProfile> = $state(new Map());
	layoutNames: string[] = $state([]);
	fullCatalogLoaded = $state(false);
	namesLoaded = $state(false);
	loading = $state(false);
	loadError: Error | null = $state(null);
	latestLayoutDayKey = $derived(getLatestLayoutDayKey(this.layouts));

	#catalogRequest: Promise<void> | null = null;
	#namesRequest: Promise<void> | null = null;

	hydrate(
		layouts: LayoutData[],
		authorsData: Record<string, number>,
		likesData: LayoutLikesMap,
		inputProfiles: ReadonlyMap<string, LayoutInputProfile> = new Map()
	) {
		this.layouts = layouts;
		this.authorsData = authorsData;
		this.likesData = likesData;
		this.inputProfiles = inputProfiles;
		this.layoutNames = layouts.map((layout) => layout.name);
		this.fullCatalogLoaded = true;
		this.namesLoaded = true;
		this.loadError = null;
	}

	getAuthorName(userId: number): string {
		return resolveAuthorName(this.authorsData, userId);
	}

	/** Preview payload when the aggregate catalog is already in memory. */
	getLayoutDetail(
		name: string,
		statsMaps: StatsMaps = {},
		statsCorpus: StatsCorpus = DEFAULT_STATS_CORPUS
	): LayoutDetail | null {
		if (!this.fullCatalogLoaded) return null;
		return buildCatalogLayoutDetail(
			name,
			{
				layouts: this.layouts,
				authorsData: this.authorsData,
				likesData: this.likesData,
				inputProfiles: this.inputProfiles
			},
			statsMaps,
			statsCorpus
		);
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
