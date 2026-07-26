import { SvelteSet, SvelteURL } from 'svelte/reactivity';
import { pushState, replaceState } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { PathnameWithSearchOrHash } from '$app/types';
import { getDefaultSortOrder, type SortBy, type SortOrder } from './statsSorting';
import {
	getGeneralStatFilterRowsForAnalyzer,
	getHandStatFilterFieldsForAnalyzer,
	type StatLimitKey
} from './statsFiltering';
import {
	DEFAULT_STATS_ANALYZER,
	parseStatsAnalyzerMode,
	type StatsAnalyzer,
	type StatsAnalyzerMode
} from './statsAnalyzers';
import { isAnalyzerStatsReady } from './layoutStatsAccess';
import { analyzersNeededForLimits } from './statsUsage';
import type { LayoutData, LayoutLikesMap, StatsMaps } from './layout';
import type { SimilarityMirrorMode } from './layoutSimilarity';
import type { FilterFocusRequest } from './filterFocus';
import {
	loadSavedFilters,
	persistSavedFilters,
	sortLayoutSourceNames,
	type SavedFilter
} from './savedFiltersStorage';
import {
	buildShareViewUrl,
	readShareViewFromUrl,
	stripShareViewParamsFromUrl
} from './viewFilterShare';
import {
	hasSavedViewFilterUrlOverrides,
	readGlobalFilterUrlState,
	writeGlobalFilterUrlState,
	writeSavedViewUrlState
} from './filterUrlState';
import {
	decodeViewFilterSnapshot,
	encodeViewFilterSnapshot,
	readViewFilterUrlState,
	writeViewFilterUrlState
} from './filterUrlCodec';
import {
	filterLayouts as filterLayoutCatalog,
	sortLayouts as sortLayoutCatalog
} from './layoutFiltering';
import {
	createHistoryTarget,
	isRouterNotReadyError,
	shouldWriteHistory,
	type FilterHistoryMode
} from './filterNavigation';
import {
	ViewFilterSnapshotCache,
	createLayoutNameSet,
	findSavedView,
	isSavedViewDirty,
	removeSavedView,
	renameSavedView,
	resolveActiveSourceLayoutNames,
	updateSavedView,
	upsertSavedView,
	type LayoutSource
} from './savedViews';
import {
	cloneFilterGrid,
	cloneStatLimits,
	cloneThumbKeyFilters,
	cloneViewFilterSnapshot,
	createDefaultViewSnapshot,
	createEmptyFilterGrid,
	createEmptyStatLimits,
	createEmptyThumbKeyFilters,
	normalizeViewSortBy,
	type BoardTypeFilter,
	type CharacterSetFilter,
	type MagicKeyFilter,
	type SortSnapshot,
	type StatLimit,
	type StatLimitOperator,
	type ThumbKeyFilter,
	type ViewFilterSnapshot
} from './filterSnapshot';

export type {
	BoardTypeFilter,
	CharacterSetFilter,
	MagicKeyFilter,
	StatLimit,
	StatLimitOperator,
	ThumbKeyFilter,
	ViewFilterSnapshot
} from './filterSnapshot';
export {
	decodeViewFilterSnapshot,
	encodeViewFilterSnapshot,
	parseStatLimitsParam
} from './filterUrlCodec';
export type { DecodedViewFilters } from './filterUrlCodec';
/** Pool of layouts that other filters operate on. */
export type { LayoutSource } from './savedViews';
export type { SortBy, SortOrder };
export type { SimilarityMirrorMode };
export type { SavedFilter };

const DEBOUNCE_MS = 300;

export class FilterStore {
	includeGrid: string[][] = $state(createEmptyFilterGrid());
	excludeGrid: string[][] = $state(createEmptyFilterGrid());
	includeOrGrid: string[][] = $state(createEmptyFilterGrid());
	includeOrLeftThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	includeOrRightThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	includeLeftThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	includeRightThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	excludeLeftThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	excludeRightThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	showUnfinished: boolean = $state(false);
	thumbKeyFilter: ThumbKeyFilter = $state('optional');
	magicKeyFilter: MagicKeyFilter = $state('optional');
	characterSetFilter: CharacterSetFilter = $state('english');
	boardTypeFilter: BoardTypeFilter = $state('all');
	nameFilterInput: string = $state(''); // Immediate input value
	nameFilter: string = $state(''); // Debounced filter value
	selectedAuthors: SvelteSet<number> = new SvelteSet(); // Set of author user IDs
	/** Layouts checked for selected-source filtering, comparison, and view creation. */
	selectedLayoutNames: SvelteSet<string> = new SvelteSet();
	/** When `selected`, other filters run only over selected layouts. */
	layoutSource: LayoutSource = $state('all');
	/** Named filter presets persisted in localStorage (not URL). */
	savedFilters: SavedFilter[] = $state([]);
	/** When set, a saved-filter tab is active (pool stays `all`). */
	activeSavedFilterId: string | null = $state(null);
	/** Shared-view offer from URL params (does not mutate live filters until Apply/Save). */
	pendingSharedView: {
		name: string;
		snapshot: ViewFilterSnapshot;
		sourceLayoutNames?: string[];
	} | null = $state(null);
	/**
	 * Session-only layout membership (e.g. Apply shared view without saving).
	 * Cleared when activating a saved view or leaving All.
	 */
	ephemeralSourceLayoutNames: string[] | null = $state(null);
	/**
	 * Session override of layout source membership.
	 * `undefined` = follow saved/ephemeral; `null` = no source; `string[]` = applied source.
	 * Persists to localStorage only when the active saved view is updated.
	 */
	draftSourceLayoutNames: string[] | null | undefined = $state(undefined);
	/** Open the source-selection details modal from the filter chip. */
	showSourceSelectionModal = $state(false);
	/**
	 * When true (and source is `all`), inject selected layouts into the result
	 * list even if they fail other filters.
	 */
	includeSelectedInResults: boolean = $state(false);
	focusLayoutName: string | null = $state(null);
	scrollToSelectedLayout = $state(false);
	/** Latest request to open/focus a filter control (chips, deep links). */
	filterFocusRequest: FilterFocusRequest | null = $state(null);
	/** Monotonic token so identical consecutive requests still trigger. */
	filterFocusRequestSeq = $state(0);
	similarReferenceName: string | null = $state(null);
	/** Anglemod toggle on the similarity reference card (affects match scoring/diffs). */
	similarReferenceAnglemod = $state(false);
	similarityFilterOperator: StatLimitOperator = $state('gt');
	similarityFilterValue: string = $state('50');
	/** Debounced match % used by the filter pipeline (input stays on similarityFilterValue). */
	appliedSimilarityFilterValue: string = $state('50');
	/** When true, home-row keys count double in similarity scoring. */
	similarityWeightHomeKeys: boolean = $state(false);
	/** Mirror matching: excluded (default), optional, or required (mirror-only). */
	similarityMirrorMode: SimilarityMirrorMode = $state('excluded');
	sortBy: SortBy = $state('date');
	sortOrder: SortOrder = $state('desc');
	/** True after the user explicitly changes Order; then order persists across sort fields. */
	#sortOrderManual = false;
	/**
	 * Sort state from just before entering similarity mode (restored if user stays on
	 * "similarity" sort until exit).
	 */
	#sortBeforeSimilar: SortSnapshot | null = null;
	/** Sort to restore when leaving similarity mode (may diverge if user picks another sort). */
	#exitSortRestore: SortSnapshot | null = null;
	/**
	 * Isolated filter snapshots per layout-source view. Switching restores that view's
	 * snapshot only — never copies or syncs filters between All and Selected.
	 */
	#viewFilterSnapshots = new ViewFilterSnapshotCache();
	statsAnalyzer: StatsAnalyzerMode = $state(DEFAULT_STATS_ANALYZER);
	hideLayoutStats: boolean = $state(false);
	hideLayoutTestArea: boolean = $state(false);
	hideLayoutLikes: boolean = $state(false);
	hideNewLayoutIndicator: boolean = $state(false);
	/** lg+: pin similarity reference in its own column while scrolling matches. */
	stickySimilarityCard: boolean = $state(true);
	likesDataAvailable: boolean = $state(false);
	statLimits: Record<StatLimitKey, StatLimit> = $state(createEmptyStatLimits());

	/** Debounced copies used by filterLayouts (UI grids/limits update immediately). */
	appliedIncludeGrid: string[][] = $state(createEmptyFilterGrid());
	appliedExcludeGrid: string[][] = $state(createEmptyFilterGrid());
	appliedIncludeOrGrid: string[][] = $state(createEmptyFilterGrid());
	appliedIncludeOrLeftThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	appliedIncludeOrRightThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	appliedIncludeLeftThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	appliedIncludeRightThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	appliedExcludeLeftThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	appliedExcludeRightThumbKeys: string[] = $state(createEmptyThumbKeyFilters());
	appliedStatLimits: Record<StatLimitKey, StatLimit> = $state(createEmptyStatLimits());
	/** Bumped when debounced applied filters commit — stable dependency for chips/results UI. */
	appliedFiltersRevision: number = $state(0);

	get showLayoutStats(): boolean {
		return !this.hideLayoutStats;
	}

	get showLayoutTestArea(): boolean {
		return !this.hideLayoutTestArea;
	}

	get showLayoutLikes(): boolean {
		return !this.hideLayoutLikes;
	}

	get showNewLayoutIndicator(): boolean {
		return !this.hideNewLayoutIndicator;
	}

	get canUseLikes(): boolean {
		return this.showLayoutLikes && this.likesDataAvailable;
	}

	#persistTimeout: ReturnType<typeof setTimeout> | null = null;
	#persistShouldCommit = false;
	/** Coalesce retries when `$effect` URL writes race SvelteKit router startup. */
	#pendingHistoryRetry = false;

	constructor() {
		if (typeof window !== 'undefined') {
			this.savedFilters = loadSavedFilters();
		}
		this.#loadFromUrl();
		this.#applyFiltersFromInputs();
		if (typeof window !== 'undefined') {
			this.consumeSharedViewFromUrl();
			window.addEventListener('popstate', () => {
				this.#hydrateFromUrl();
			});
		}
	}

	#applyFiltersFromInputs() {
		this.appliedIncludeGrid = cloneFilterGrid(this.includeGrid);
		this.appliedExcludeGrid = cloneFilterGrid(this.excludeGrid);
		this.appliedIncludeOrGrid = cloneFilterGrid(this.includeOrGrid);
		this.appliedIncludeOrLeftThumbKeys = cloneThumbKeyFilters(this.includeOrLeftThumbKeys);
		this.appliedIncludeOrRightThumbKeys = cloneThumbKeyFilters(this.includeOrRightThumbKeys);
		this.appliedIncludeLeftThumbKeys = cloneThumbKeyFilters(this.includeLeftThumbKeys);
		this.appliedIncludeRightThumbKeys = cloneThumbKeyFilters(this.includeRightThumbKeys);
		this.appliedExcludeLeftThumbKeys = cloneThumbKeyFilters(this.excludeLeftThumbKeys);
		this.appliedExcludeRightThumbKeys = cloneThumbKeyFilters(this.excludeRightThumbKeys);
		this.appliedStatLimits = cloneStatLimits(this.statLimits);
		this.appliedSimilarityFilterValue = this.similarityFilterValue;
		this.nameFilter = this.nameFilterInput;
		this.appliedFiltersRevision += 1;
	}

	/** Reset URL-backed filter state to empty-URL defaults, then apply current location. */
	#hydrateFromUrl() {
		this.#cancelFilterApply();
		this.#viewFilterSnapshots.clear();
		this.#resetUrlControlledState();
		this.#loadFromUrl();
		this.#applyFiltersNow();
		this.consumeSharedViewFromUrl();
	}

	#persistSavedFilters() {
		persistSavedFilters(this.savedFilters);
	}

	#resetUrlControlledState() {
		this.includeGrid = createEmptyFilterGrid();
		this.excludeGrid = createEmptyFilterGrid();
		this.includeOrGrid = createEmptyFilterGrid();
		this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
		this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeRightThumbKeys = createEmptyThumbKeyFilters();
		this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
		this.showUnfinished = false;
		this.thumbKeyFilter = 'optional';
		this.magicKeyFilter = 'optional';
		this.characterSetFilter = 'english';
		this.boardTypeFilter = 'all';
		this.nameFilterInput = '';
		this.nameFilter = '';
		this.selectedAuthors.clear();
		this.selectedLayoutNames.clear();
		this.layoutSource = 'all';
		this.activeSavedFilterId = null;
		this.pendingSharedView = null;
		this.includeSelectedInResults = false;
		this.similarReferenceName = null;
		this.#sortBeforeSimilar = null;
		this.#exitSortRestore = null;
		this.#resetSimilarityFilter();
		this.sortBy = 'date';
		this.sortOrder = 'desc';
		this.#sortOrderManual = false;
		this.statsAnalyzer = DEFAULT_STATS_ANALYZER;
		this.hideLayoutStats = false;
		this.hideLayoutTestArea = false;
		this.hideLayoutLikes = false;
		this.hideNewLayoutIndicator = false;
		this.stickySimilarityCard = true;
		this.statLimits = createEmptyStatLimits();
	}

	#loadFromUrl() {
		const url = new SvelteURL(window.location.href);
		let shouldReadViewUrlState = true;

		const viewId = url.searchParams.get('view')?.trim();
		if (viewId) {
			const saved = findSavedView(this.savedFilters, viewId);
			if (saved) {
				this.layoutSource = 'all';
				this.activeSavedFilterId = saved.id;
				this.includeSelectedInResults = false;
				this.ephemeralSourceLayoutNames = null;
				this.draftSourceLayoutNames = undefined;

				// With no view-owned overrides, filters come from localStorage.
				// Global URL state is hydrated below in either case.
				if (!hasSavedViewFilterUrlOverrides(url.searchParams)) {
					this.#restoreViewFilters(saved.snapshot);
					shouldReadViewUrlState = false;
				}
			}
		}

		const globalUrlState = readGlobalFilterUrlState(url.searchParams);
		this.statsAnalyzer = globalUrlState.statsAnalyzer;
		this.hideLayoutStats = globalUrlState.hideLayoutStats;
		this.hideLayoutTestArea = globalUrlState.hideLayoutTestArea;
		this.hideLayoutLikes = globalUrlState.hideLayoutLikes;
		this.hideNewLayoutIndicator = globalUrlState.hideNewLayoutIndicator;
		this.stickySimilarityCard = globalUrlState.stickySimilarityCard;
		for (const name of globalUrlState.selectedLayoutNames) {
			this.selectedLayoutNames.add(name);
		}

		const decoded = shouldReadViewUrlState ? readViewFilterUrlState(url.searchParams) : undefined;
		if (decoded) {
			if (this.hideLayoutLikes) {
				decoded.snapshot.statLimits.likes = { operator: 'lt', value: '' };
				decoded.snapshot.appliedStatLimits.likes = { operator: 'lt', value: '' };
			}
			this.#restoreViewFilters(decoded.snapshot);
		}

		if (!this.activeSavedFilterId && url.searchParams.get('source') === 'selected') {
			this.layoutSource = 'selected';
		} else if (
			!this.activeSavedFilterId &&
			url.searchParams.get('showSelected') === '1' &&
			this.selectedLayoutNames.size > 0
		) {
			this.includeSelectedInResults = true;
		}

		if (this.activeSavedFilterId && decoded?.sourceLayoutNames !== undefined) {
			this.draftSourceLayoutNames = decoded.sourceLayoutNames;
		}
	}

	/**
	 * Write filter URL via SvelteKit history helpers. First-paint `$effect`s can run
	 * before the client router sets `started`; retry once on the next macrotask and
	 * rebuild from current store state so a coalesced retry can't stale-overwrite.
	 */
	#writeHistory(url: SvelteURL, historyMode: FilterHistoryMode) {
		const next = createHistoryTarget(url);
		const current = createHistoryTarget(window.location);

		try {
			if (!shouldWriteHistory(historyMode, next, current)) return;
			const resolved = resolve(next as PathnameWithSearchOrHash);
			if (historyMode === 'push') {
				pushState(resolved, page.state);
			} else {
				replaceState(resolved, page.state);
			}
		} catch (error) {
			if (!isRouterNotReadyError(error)) throw error;
			if (this.#pendingHistoryRetry) return;
			this.#pendingHistoryRetry = true;
			setTimeout(() => {
				this.#pendingHistoryRetry = false;
				this.#saveToUrl({ history: historyMode });
			}, 0);
		}
	}

	#writeGlobalUrlState(searchParams: URLSearchParams) {
		writeGlobalFilterUrlState(searchParams, {
			statsAnalyzer: this.statsAnalyzer,
			hideLayoutStats: this.hideLayoutStats,
			hideLayoutTestArea: this.hideLayoutTestArea,
			hideLayoutLikes: this.hideLayoutLikes,
			hideNewLayoutIndicator: this.hideNewLayoutIndicator,
			stickySimilarityCard: this.stickySimilarityCard,
			selectedLayoutNames: this.selectedLayoutNames
		});
	}

	#saveToUrl(options: { history?: 'replace' | 'push' } = {}) {
		const historyMode = options.history ?? 'replace';
		const url = new SvelteURL(window.location.href);
		url.search = '';

		// Clean saved view: filters live in localStorage, while global settings and
		// Layout selections remain URL-backed.
		if (this.activeSavedFilterId && !this.isActiveSavedViewDirty) {
			writeSavedViewUrlState(url.searchParams, this.activeSavedFilterId, undefined);
			this.#writeGlobalUrlState(url.searchParams);
			this.#writeHistory(url, historyMode);
			return;
		}

		// Filter params use applied (committed) state so the URL matches results/chips.
		writeViewFilterUrlState(url.searchParams, this.#captureViewFilters());

		if (this.activeSavedFilterId) {
			// Persist session source overrides (not in the filter snapshot).
			writeSavedViewUrlState(
				url.searchParams,
				this.activeSavedFilterId,
				this.draftSourceLayoutNames
			);
		} else if (this.layoutSource === 'selected') {
			url.searchParams.set('source', 'selected');
		} else if (this.includeSelectedInResults && this.selectedLayoutNames.size > 0) {
			url.searchParams.set('showSelected', '1');
		}

		this.#writeGlobalUrlState(url.searchParams);
		this.#writeHistory(url, historyMode);
	}

	/**
	 * Single debounce for URL persist. When `commit` is set, also copy draft filters
	 * into applied state before saving (so URL matches results).
	 */
	#schedulePersist(options: { commit?: boolean } = {}) {
		if (options.commit) this.#persistShouldCommit = true;
		if (this.#persistTimeout) {
			clearTimeout(this.#persistTimeout);
		}
		this.#persistTimeout = setTimeout(() => {
			if (this.#persistShouldCommit) {
				this.#applyFiltersFromInputs();
				this.#persistShouldCommit = false;
			}
			this.#saveToUrl();
			this.#persistTimeout = null;
		}, DEBOUNCE_MS);
	}

	#scheduleFilterApply() {
		this.#schedulePersist({ commit: true });
	}

	#cancelFilterApply() {
		if (this.#persistTimeout) {
			clearTimeout(this.#persistTimeout);
			this.#persistTimeout = null;
		}
		this.#persistShouldCommit = false;
	}

	#applyFiltersNow() {
		this.#cancelFilterApply();
		this.#applyFiltersFromInputs();
	}

	#debouncedSave() {
		this.#schedulePersist();
	}

	#captureViewFilters(): ViewFilterSnapshot {
		return cloneViewFilterSnapshot({
			includeGrid: this.includeGrid,
			excludeGrid: this.excludeGrid,
			includeOrGrid: this.includeOrGrid,
			includeOrLeftThumbKeys: this.includeOrLeftThumbKeys,
			includeOrRightThumbKeys: this.includeOrRightThumbKeys,
			includeLeftThumbKeys: this.includeLeftThumbKeys,
			includeRightThumbKeys: this.includeRightThumbKeys,
			excludeLeftThumbKeys: this.excludeLeftThumbKeys,
			excludeRightThumbKeys: this.excludeRightThumbKeys,
			showUnfinished: this.showUnfinished,
			thumbKeyFilter: this.thumbKeyFilter,
			magicKeyFilter: this.magicKeyFilter,
			characterSetFilter: this.characterSetFilter,
			boardTypeFilter: this.boardTypeFilter,
			nameFilterInput: this.nameFilterInput,
			nameFilter: this.nameFilter,
			selectedAuthors: Array.from(this.selectedAuthors),
			includeSelectedInResults: this.includeSelectedInResults,
			similarReferenceName: this.similarReferenceName,
			similarReferenceAnglemod: this.similarReferenceAnglemod,
			similarityFilterOperator: this.similarityFilterOperator,
			similarityFilterValue: this.similarityFilterValue,
			appliedSimilarityFilterValue: this.appliedSimilarityFilterValue,
			similarityWeightHomeKeys: this.similarityWeightHomeKeys,
			similarityMirrorMode: this.similarityMirrorMode,
			sortBy: this.sortBy,
			sortOrder: this.sortOrder,
			sortOrderManual: this.#sortOrderManual,
			sortBeforeSimilar: this.#sortBeforeSimilar,
			exitSortRestore: this.#exitSortRestore,
			statLimits: this.statLimits,
			appliedIncludeGrid: this.appliedIncludeGrid,
			appliedExcludeGrid: this.appliedExcludeGrid,
			appliedIncludeOrGrid: this.appliedIncludeOrGrid,
			appliedIncludeOrLeftThumbKeys: this.appliedIncludeOrLeftThumbKeys,
			appliedIncludeOrRightThumbKeys: this.appliedIncludeOrRightThumbKeys,
			appliedIncludeLeftThumbKeys: this.appliedIncludeLeftThumbKeys,
			appliedIncludeRightThumbKeys: this.appliedIncludeRightThumbKeys,
			appliedExcludeLeftThumbKeys: this.appliedExcludeLeftThumbKeys,
			appliedExcludeRightThumbKeys: this.appliedExcludeRightThumbKeys,
			appliedStatLimits: this.appliedStatLimits
		});
	}

	#restoreViewFilters(snapshot: ViewFilterSnapshot) {
		const restored = cloneViewFilterSnapshot(snapshot);
		this.includeGrid = restored.includeGrid;
		this.excludeGrid = restored.excludeGrid;
		this.includeOrGrid = restored.includeOrGrid;
		this.includeOrLeftThumbKeys = restored.includeOrLeftThumbKeys;
		this.includeOrRightThumbKeys = restored.includeOrRightThumbKeys;
		this.includeLeftThumbKeys = restored.includeLeftThumbKeys;
		this.includeRightThumbKeys = restored.includeRightThumbKeys;
		this.excludeLeftThumbKeys = restored.excludeLeftThumbKeys;
		this.excludeRightThumbKeys = restored.excludeRightThumbKeys;
		this.showUnfinished = restored.showUnfinished;
		this.thumbKeyFilter = restored.thumbKeyFilter;
		this.magicKeyFilter = restored.magicKeyFilter;
		this.characterSetFilter = restored.characterSetFilter;
		this.boardTypeFilter = restored.boardTypeFilter;
		this.nameFilterInput = restored.nameFilterInput;
		this.nameFilter = restored.nameFilter;
		this.selectedAuthors.clear();
		for (const id of restored.selectedAuthors) {
			this.selectedAuthors.add(id);
		}
		this.includeSelectedInResults = restored.includeSelectedInResults;
		this.similarReferenceName = restored.similarReferenceName;
		this.similarReferenceAnglemod = restored.similarReferenceAnglemod;
		this.similarityFilterOperator = restored.similarityFilterOperator;
		this.similarityFilterValue = restored.similarityFilterValue;
		this.appliedSimilarityFilterValue = restored.appliedSimilarityFilterValue;
		this.similarityWeightHomeKeys = restored.similarityWeightHomeKeys;
		this.similarityMirrorMode = restored.similarityMirrorMode;
		this.sortBy = normalizeViewSortBy(restored.sortBy, restored.similarReferenceName);
		this.sortOrder = restored.sortOrder;
		this.#sortOrderManual = restored.sortOrderManual;
		this.#sortBeforeSimilar = restored.sortBeforeSimilar;
		this.#exitSortRestore = restored.exitSortRestore;
		this.statLimits = restored.statLimits;
		this.appliedIncludeGrid = restored.appliedIncludeGrid;
		this.appliedExcludeGrid = restored.appliedExcludeGrid;
		this.appliedIncludeOrGrid = restored.appliedIncludeOrGrid;
		this.appliedIncludeOrLeftThumbKeys = restored.appliedIncludeOrLeftThumbKeys;
		this.appliedIncludeOrRightThumbKeys = restored.appliedIncludeOrRightThumbKeys;
		this.appliedIncludeLeftThumbKeys = restored.appliedIncludeLeftThumbKeys;
		this.appliedIncludeRightThumbKeys = restored.appliedIncludeRightThumbKeys;
		this.appliedExcludeLeftThumbKeys = restored.appliedExcludeLeftThumbKeys;
		this.appliedExcludeRightThumbKeys = restored.appliedExcludeRightThumbKeys;
		this.appliedStatLimits = restored.appliedStatLimits;
		this.appliedFiltersRevision += 1;
	}

	/** Defaults for a view that has never been visited (no snapshot yet). */
	#resetViewFiltersToDefaults() {
		this.#restoreViewFilters(createDefaultViewSnapshot());
	}

	#setGridCell(grid: string[][], row: number, col: number, value: string): string[][] {
		return grid.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r));
	}

	#setThumbKey(keys: string[], index: number, value: string): string[] {
		return keys.map((key, i) => (i === index ? value : key));
	}

	setIncludeCell(row: number, col: number, value: string) {
		this.includeGrid = this.#setGridCell(this.includeGrid, row, col, value);
		this.#scheduleFilterApply();
	}

	setExcludeCell(row: number, col: number, value: string) {
		this.excludeGrid = this.#setGridCell(this.excludeGrid, row, col, value);
		this.#scheduleFilterApply();
	}

	setIncludeLeftThumbKey(index: number, value: string) {
		this.includeLeftThumbKeys = this.#setThumbKey(this.includeLeftThumbKeys, index, value);
		this.#scheduleFilterApply();
	}

	setIncludeRightThumbKey(index: number, value: string) {
		this.includeRightThumbKeys = this.#setThumbKey(this.includeRightThumbKeys, index, value);
		this.#scheduleFilterApply();
	}

	setExcludeLeftThumbKey(index: number, value: string) {
		this.excludeLeftThumbKeys = this.#setThumbKey(this.excludeLeftThumbKeys, index, value);
		this.#scheduleFilterApply();
	}

	setExcludeRightThumbKey(index: number, value: string) {
		this.excludeRightThumbKeys = this.#setThumbKey(this.excludeRightThumbKeys, index, value);
		this.#scheduleFilterApply();
	}

	setIncludeOrLeftThumbKey(index: number, value: string) {
		this.includeOrLeftThumbKeys = this.#setThumbKey(this.includeOrLeftThumbKeys, index, value);
		this.#scheduleFilterApply();
	}

	setIncludeOrRightThumbKey(index: number, value: string) {
		this.includeOrRightThumbKeys = this.#setThumbKey(this.includeOrRightThumbKeys, index, value);
		this.#scheduleFilterApply();
	}

	setIncludeOrCell(row: number, col: number, value: string) {
		this.includeOrGrid = this.#setGridCell(this.includeOrGrid, row, col, value);
		this.#scheduleFilterApply();
	}

	setShowUnfinished(value: boolean) {
		this.showUnfinished = value;
		this.#debouncedSave();
	}

	setThumbKeyFilter(value: ThumbKeyFilter) {
		this.thumbKeyFilter = value;
		// Clear thumb key filters when set to excluded
		if (value === 'excluded') {
			this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
			this.includeRightThumbKeys = createEmptyThumbKeyFilters();
			this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
			this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
			this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
			this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
			this.#applyFiltersNow();
		}
		this.#debouncedSave();
	}

	setMagicKeyFilter(value: MagicKeyFilter) {
		this.magicKeyFilter = value;
		this.#debouncedSave();
	}

	setCharacterSetFilter(value: CharacterSetFilter) {
		this.characterSetFilter = value;
		this.#debouncedSave();
	}

	setBoardTypeFilter(value: BoardTypeFilter) {
		this.boardTypeFilter = value;
		this.#debouncedSave();
	}

	clearKeyboardFilters() {
		this.showUnfinished = false;
		this.thumbKeyFilter = 'optional';
		this.magicKeyFilter = 'optional';
		this.characterSetFilter = 'english';
		this.boardTypeFilter = 'all';
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	setSortBy(value: SortBy) {
		const nextSortBy = normalizeViewSortBy(value, this.similarReferenceName);
		const previousDefault = getDefaultSortOrder(this.sortBy);
		const wasOnDefaultOrder = !this.#sortOrderManual || this.sortOrder === previousDefault;
		this.sortBy = nextSortBy;
		if (wasOnDefaultOrder) {
			// Adopt this field's default (Asc for lower-is-better Cyanophage stats, etc.).
			this.sortOrder = getDefaultSortOrder(nextSortBy);
			this.#sortOrderManual = false;
		}
		this.#syncSimilarExitSortRestore(nextSortBy);
		this.#saveToUrl();
	}

	setSortOrder(value: SortOrder) {
		this.sortOrder = value;
		this.#sortOrderManual = true;
		if (this.similarReferenceName !== null && this.sortBy !== 'similarity') {
			this.#exitSortRestore = this.#snapshotSort();
		}
		this.#saveToUrl();
	}

	#snapshotSort(): SortSnapshot {
		return {
			sortBy: this.sortBy === 'similarity' ? 'date' : this.sortBy,
			sortOrder: this.sortOrder,
			sortOrderManual: this.#sortOrderManual
		};
	}

	#syncSimilarExitSortRestore(sortBy: SortBy) {
		if (this.similarReferenceName === null) return;
		if (sortBy === 'similarity') {
			// Back on similarity sort → restore the pre-entry snapshot on exit.
			this.#exitSortRestore = this.#sortBeforeSimilar;
		} else {
			this.#exitSortRestore = this.#snapshotSort();
		}
	}

	#restoreSortAfterSimilar() {
		const restore = this.#exitSortRestore ?? this.#sortBeforeSimilar;
		this.#sortBeforeSimilar = null;
		this.#exitSortRestore = null;
		if (restore) {
			this.sortBy = restore.sortBy === 'similarity' ? 'date' : restore.sortBy;
			this.sortOrder = restore.sortOrder;
			this.#sortOrderManual = restore.sortOrderManual;
			return;
		}
		if (this.sortBy === 'similarity') {
			this.#resetSortToDateDefault();
		}
	}

	#resetSortToDateDefault() {
		this.sortBy = 'date';
		if (!this.#sortOrderManual) {
			this.sortOrder = getDefaultSortOrder('date');
		}
	}

	setStatsAnalyzer(value: StatsAnalyzerMode) {
		this.statsAnalyzer = parseStatsAnalyzerMode(value);
		this.#saveToUrl();
	}

	setHideLayoutStats(value: boolean) {
		this.hideLayoutStats = value;
		this.#saveToUrl();
	}

	setHideLayoutTestArea(value: boolean) {
		this.hideLayoutTestArea = value;
		this.#saveToUrl();
	}

	setHideLayoutLikes(value: boolean) {
		this.hideLayoutLikes = value;
		if (value && this.sortBy === 'likes') {
			this.#resetSortToDateDefault();
		}
		if (value) {
			this.statLimits.likes = { operator: 'lt', value: '' };
			this.#applyFiltersNow();
		}
		this.#saveToUrl();
	}

	setHideNewLayoutIndicator(value: boolean) {
		this.hideNewLayoutIndicator = value;
		this.#saveToUrl();
	}

	setStickySimilarityCard(value: boolean) {
		this.stickySimilarityCard = value;
		this.#saveToUrl();
	}

	setLikesDataAvailable(value: boolean) {
		this.likesDataAvailable = value;
		if (!this.canUseLikes) {
			if (this.sortBy === 'likes') {
				this.#resetSortToDateDefault();
			}
			if (this.statLimits.likes.value.trim() !== '') {
				this.statLimits.likes = { operator: 'lt', value: '' };
				this.#applyFiltersNow();
				this.#saveToUrl();
			}
		}
	}

	setStatLimitOperator(key: StatLimitKey, operator: StatLimitOperator) {
		this.statLimits[key].operator = operator;
		this.#scheduleFilterApply();
	}

	setStatLimitValue(key: StatLimitKey, value: string) {
		this.statLimits[key].value = value;
		this.#scheduleFilterApply();
	}

	/** Step a stat limit by delta (e.g. ±0.1); uses the same debounce as typing. */
	nudgeStatLimitValue(key: StatLimitKey, delta: number) {
		const parsed = Number.parseFloat(this.statLimits[key].value.trim());
		const current = Number.isFinite(parsed) ? parsed : 0;
		const next = Math.round((current + delta) * 10) / 10;
		this.setStatLimitValue(key, String(next));
	}

	setSimilarityFilterOperator(operator: StatLimitOperator) {
		this.similarityFilterOperator = operator;
		this.#saveToUrl();
	}

	setSimilarityFilterValue(value: string) {
		this.similarityFilterValue = value;
		this.#scheduleFilterApply();
	}

	/** Step the match % up/down (clamped 0–100); uses the same debounce as typing. */
	nudgeSimilarityFilterValue(delta: number) {
		const parsed = Number.parseFloat(this.similarityFilterValue.trim());
		const current = Number.isFinite(parsed) ? parsed : 50;
		const next = Math.min(100, Math.max(0, Math.round(current + delta)));
		this.setSimilarityFilterValue(String(next));
	}

	setSimilarityWeightHomeKeys(value: boolean) {
		this.similarityWeightHomeKeys = value;
		this.#saveToUrl();
	}

	setSimilarityMirrorMode(value: SimilarityMirrorMode) {
		this.similarityMirrorMode = value;
		this.#saveToUrl();
	}

	#resetSimilarityFilter() {
		this.similarityFilterOperator = 'gt';
		this.similarityFilterValue = '50';
		this.appliedSimilarityFilterValue = '50';
		this.similarityWeightHomeKeys = false;
		this.similarityMirrorMode = 'excluded';
		this.similarReferenceAnglemod = false;
	}

	/** Reset match % / scoring / mirror options (and reference anglemod) to defaults. */
	resetSimilarityFilter() {
		this.#resetSimilarityFilter();
		this.#applyFiltersNow();
		this.#saveToUrl();
	}

	/** True when sidebar similarity options differ from defaults. */
	get hasModifiedSimilarityFilter(): boolean {
		return (
			this.similarityFilterOperator !== 'gt' ||
			this.similarityFilterValue.trim() !== '50' ||
			this.similarityWeightHomeKeys ||
			this.similarityMirrorMode !== 'excluded'
		);
	}

	setSimilarReferenceAnglemod(value: boolean) {
		this.similarReferenceAnglemod = value;
		this.#saveToUrl();
	}

	setNameFilter(value: string) {
		this.nameFilterInput = value;
		this.#scheduleFilterApply();
	}

	clearInclude() {
		this.includeGrid = createEmptyFilterGrid();
		this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearIncludeOr() {
		this.includeOrGrid = createEmptyFilterGrid();
		this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearExclude() {
		this.excludeGrid = createEmptyFilterGrid();
		this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearKeyFilters() {
		this.includeGrid = createEmptyFilterGrid();
		this.excludeGrid = createEmptyFilterGrid();
		this.includeOrGrid = createEmptyFilterGrid();
		this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
		this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeRightThumbKeys = createEmptyThumbKeyFilters();
		this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearStatLimits() {
		this.statLimits = createEmptyStatLimits();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearStatLimit(key: StatLimitKey) {
		const next = { ...this.statLimits };
		next[key] = { operator: key === 'likes' ? 'gt' : 'lt', value: '' };
		this.statLimits = next;
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearGeneralStatLimits(analyzer: StatsAnalyzer = DEFAULT_STATS_ANALYZER) {
		const next = { ...this.statLimits };
		for (const field of getGeneralStatFilterRowsForAnalyzer(analyzer).flat()) {
			next[field.key] = { operator: 'lt', value: '' };
		}
		next.likes = { operator: 'gt', value: '' };
		this.statLimits = next;
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearHandStatLimits(analyzer: StatsAnalyzer = DEFAULT_STATS_ANALYZER) {
		const next = { ...this.statLimits };
		for (const field of getHandStatFilterFieldsForAnalyzer(analyzer)) {
			next[field.key] = { operator: 'lt', value: '' };
		}
		this.statLimits = next;
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	toggleAuthor(authorId: number) {
		if (this.selectedAuthors.has(authorId)) {
			this.selectedAuthors.delete(authorId);
		} else {
			this.selectedAuthors.add(authorId);
		}
		this.#debouncedSave();
	}

	clearAuthors() {
		this.selectedAuthors.clear();
		this.#debouncedSave();
	}

	toggleSelectedLayout(name: string) {
		if (this.selectedLayoutNames.has(name)) {
			this.selectedLayoutNames.delete(name);
			if (this.selectedLayoutNames.size === 0) {
				this.includeSelectedInResults = false;
			}
		} else {
			this.selectedLayoutNames.add(name);
		}
		this.#saveToUrl();
	}

	clearSelectedLayouts() {
		this.selectedLayoutNames.clear();
		this.includeSelectedInResults = false;
		// Push so Back can restore the previous selection.
		this.#saveToUrl({ history: 'push' });
	}

	setLayoutSource(source: LayoutSource) {
		// Leaving a saved-filter tab: restore All/Selected without writing edits into snapshots.
		if (this.activeSavedFilterId) {
			this.#applyFiltersNow();
			this.activeSavedFilterId = null;
			this.ephemeralSourceLayoutNames = null;
			this.draftSourceLayoutNames = undefined;
			this.layoutSource = source;

			const incoming = this.#viewFilterSnapshots.get(source);
			if (incoming) {
				this.#restoreViewFilters(incoming);
			} else {
				this.#resetViewFiltersToDefaults();
			}

			if (source === 'selected') {
				this.includeSelectedInResults = false;
			}

			this.#saveToUrl();
			return;
		}

		if (source === this.layoutSource) return;

		// Flush drafts into applied state before snapshotting the outgoing view.
		this.#applyFiltersNow();
		this.#viewFilterSnapshots.set(this.layoutSource, this.#captureViewFilters());
		this.ephemeralSourceLayoutNames = null;
		this.draftSourceLayoutNames = undefined;

		this.layoutSource = source;

		const incoming = this.#viewFilterSnapshots.get(source);
		if (incoming) {
			this.#restoreViewFilters(incoming);
		} else {
			this.#resetViewFiltersToDefaults();
		}

		// Inject-non-matching only applies on the All page.
		if (source === 'selected') {
			this.includeSelectedInResults = false;
		}

		this.#saveToUrl();
	}

	/**
	 * Persist the current filter configuration under `name` (case-insensitive upsert).
	 * Activates the saved view tab against the All layouts pool.
	 */
	saveCurrentFilters(name: string): string | null {
		if (!name.trim()) return null;

		this.#applyFiltersNow();
		const snapshot = this.#captureViewFilters();
		const sourceLayoutNames = this.activeSourceLayoutNames;
		const result = upsertSavedView(this.savedFilters, {
			name,
			snapshot,
			sourceLayoutNames
		});
		if (!result) return null;

		this.savedFilters = result.filters;
		this.#persistSavedFilters();

		if (!this.activeSavedFilterId) {
			this.#viewFilterSnapshots.set(this.layoutSource, snapshot);
		}

		this.layoutSource = 'all';
		this.activeSavedFilterId = result.id;
		this.ephemeralSourceLayoutNames = null;
		this.draftSourceLayoutNames = undefined;
		this.includeSelectedInResults = false;
		this.#saveToUrl();
		return result.id;
	}

	/**
	 * Sorted layout names that define membership for the active view, or null when
	 * the catalog is not membership-gated.
	 */
	get activeSourceLayoutNames(): string[] | null {
		return resolveActiveSourceLayoutNames({
			filters: this.savedFilters,
			activeSavedViewId: this.activeSavedFilterId,
			draftSourceLayoutNames: this.draftSourceLayoutNames,
			ephemeralSourceLayoutNames: this.ephemeralSourceLayoutNames
		});
	}

	get activeSourceLayoutNameSet(): Set<string> | null {
		return createLayoutNameSet(this.activeSourceLayoutNames);
	}

	/** True when results are gated by a custom layout source selection. */
	get hasCustomSourceSelection(): boolean {
		return this.activeSourceLayoutNames !== null;
	}

	get sourceLayoutCount(): number {
		return this.activeSourceLayoutNames?.length ?? 0;
	}

	/** Drop custom source membership for this session (persist via Update on a saved view). */
	clearSourceSelection() {
		this.draftSourceLayoutNames = null;
		if (!this.activeSavedFilterId) {
			this.ephemeralSourceLayoutNames = null;
		}
		this.showSourceSelectionModal = false;
		this.#saveToUrl();
	}

	/**
	 * Apply a source list to the live filter session.
	 * Saved views stay dirty until Update; localStorage is not written here.
	 */
	applySourceSelection(names: Iterable<string>) {
		const next = sortLayoutSourceNames(names);
		if (this.activeSavedFilterId) {
			this.draftSourceLayoutNames = next.length > 0 ? next : null;
		} else {
			this.ephemeralSourceLayoutNames = next.length > 0 ? next : null;
			this.draftSourceLayoutNames = undefined;
		}
		this.showSourceSelectionModal = false;
		this.#saveToUrl();
	}

	openSourceSelectionModal() {
		if (!this.hasCustomSourceSelection) return;
		this.showSourceSelectionModal = true;
	}

	closeSourceSelectionModal() {
		this.showSourceSelectionModal = false;
	}

	/** True when the active saved view's filters differ from what was last stored. */
	get isActiveSavedViewDirty(): boolean {
		const id = this.activeSavedFilterId;
		if (!id) return false;
		const saved = findSavedView(this.savedFilters, id);
		if (!saved) return false;
		return isSavedViewDirty(saved, this.#captureViewFilters(), this.activeSourceLayoutNames);
	}

	/**
	 * Reset control: on a dirty saved view, restore that view's saved snapshot;
	 * otherwise clear all filters.
	 */
	resetFilters() {
		if (this.activeSavedFilterId && this.isActiveSavedViewDirty) {
			this.revertActiveSavedView();
			return;
		}
		this.clearAll();
	}

	/** Re-apply the active saved view's stored snapshot (discard unsaved edits). */
	revertActiveSavedView() {
		const id = this.activeSavedFilterId;
		if (!id) return;
		const saved = findSavedView(this.savedFilters, id);
		if (!saved) return;

		this.#cancelFilterApply();
		this.draftSourceLayoutNames = undefined;
		this.#restoreViewFilters(saved.snapshot);
		this.#saveToUrl();
	}

	/** Overwrite the active saved view with the current filter configuration. */
	updateActiveSavedView() {
		const id = this.activeSavedFilterId;
		if (!id) return;

		this.#applyFiltersNow();
		const snapshot = this.#captureViewFilters();
		const sourceNames = this.activeSourceLayoutNames;
		const next = updateSavedView(this.savedFilters, id, snapshot, sourceNames);
		if (!next) return;

		this.savedFilters = next;
		this.draftSourceLayoutNames = undefined;
		this.#persistSavedFilters();
		this.#saveToUrl();
	}

	/** Rename the active saved view. Returns false if the name is empty or taken. */
	renameActiveSavedView(name: string): boolean {
		const id = this.activeSavedFilterId;
		if (!id) return false;

		const result = renameSavedView(this.savedFilters, id, name);
		if (!result.success) return false;
		if (!result.changed) return true;

		this.savedFilters = result.filters;
		this.#persistSavedFilters();
		return true;
	}

	/** Activate a saved view (All layouts pool). */
	applySavedFilter(id: string) {
		const saved = findSavedView(this.savedFilters, id);
		if (!saved) return;
		if (this.activeSavedFilterId === id) return;

		this.#applyFiltersNow();

		if (!this.activeSavedFilterId) {
			this.#viewFilterSnapshots.set(this.layoutSource, this.#captureViewFilters());
		}

		this.layoutSource = 'all';
		this.activeSavedFilterId = id;
		this.ephemeralSourceLayoutNames = null;
		this.draftSourceLayoutNames = undefined;
		this.includeSelectedInResults = false;
		this.#restoreViewFilters(saved.snapshot);
		this.#saveToUrl();
	}

	deleteSavedFilter(id: string) {
		const result = removeSavedView(this.savedFilters, id);
		if (!result.removed) return;

		this.savedFilters = result.filters;
		this.#persistSavedFilters();

		if (this.activeSavedFilterId !== id) return;

		this.activeSavedFilterId = null;
		this.ephemeralSourceLayoutNames = null;
		this.draftSourceLayoutNames = undefined;
		this.layoutSource = 'all';
		const incoming = this.#viewFilterSnapshots.get('all');
		if (incoming) {
			this.#restoreViewFilters(incoming);
		} else {
			this.#resetViewFiltersToDefaults();
		}
		this.#saveToUrl();
	}

	/**
	 * Read shareable-view params into `pendingSharedView` and strip them from the URL.
	 * Does not change live filters.
	 */
	consumeSharedViewFromUrl() {
		if (typeof window === 'undefined') return;
		const offer = readShareViewFromUrl();
		if (!offer) return;

		const decoded = decodeViewFilterSnapshot(offer.filtersEncoded);
		this.pendingSharedView = {
			name: offer.name,
			snapshot: decoded.snapshot,
			...(decoded.sourceLayoutNames ? { sourceLayoutNames: decoded.sourceLayoutNames } : {})
		};
		stripShareViewParamsFromUrl();
	}

	clearPendingSharedView() {
		this.pendingSharedView = null;
	}

	/** Clipboard URL for the active saved view (name + current filters). */
	buildActiveShareViewUrl(): string | null {
		const id = this.activeSavedFilterId;
		if (!id) return null;
		const saved = findSavedView(this.savedFilters, id);
		if (!saved) return null;

		this.#applyFiltersNow();
		const sourceLayoutNames = this.activeSourceLayoutNames ?? undefined;
		const encoded = encodeViewFilterSnapshot(this.#captureViewFilters(), {
			sourceLayoutNames
		});
		return buildShareViewUrl(saved.name, encoded);
	}

	/** Apply a shared snapshot to the All layouts view (replaces current All filters). */
	applySharedViewToAll(snapshot: ViewFilterSnapshot, sourceLayoutNames?: string[]) {
		this.#applyFiltersNow();

		if (this.activeSavedFilterId) {
			this.activeSavedFilterId = null;
		} else if (this.layoutSource !== 'all') {
			this.#viewFilterSnapshots.set(this.layoutSource, this.#captureViewFilters());
		} else {
			// Leaving whatever was on All — shared filters replace it.
		}

		this.layoutSource = 'all';
		this.includeSelectedInResults = false;
		this.draftSourceLayoutNames = undefined;
		this.ephemeralSourceLayoutNames =
			sourceLayoutNames && sourceLayoutNames.length > 0
				? sortLayoutSourceNames(sourceLayoutNames)
				: null;
		this.#restoreViewFilters(snapshot);
		this.#viewFilterSnapshots.set('all', this.#captureViewFilters());
		this.pendingSharedView = null;
		this.#saveToUrl();
	}

	/** Persist a shared snapshot as a new/updated named view and activate it. */
	saveSharedViewAsView(
		name: string,
		snapshot: ViewFilterSnapshot,
		sourceLayoutNames?: string[]
	): string | null {
		const result = upsertSavedView(this.savedFilters, {
			name,
			snapshot,
			sourceLayoutNames
		});
		if (!result) return null;

		this.savedFilters = result.filters;
		this.#persistSavedFilters();

		this.#applyFiltersNow();
		if (!this.activeSavedFilterId) {
			this.#viewFilterSnapshots.set(this.layoutSource, this.#captureViewFilters());
		}

		this.layoutSource = 'all';
		this.activeSavedFilterId = result.id;
		this.ephemeralSourceLayoutNames = null;
		this.draftSourceLayoutNames = undefined;
		this.includeSelectedInResults = false;
		this.#restoreViewFilters(snapshot);
		this.pendingSharedView = null;
		this.#saveToUrl();
		return result.id;
	}

	/**
	 * Save the selected layouts as a named view whose source is those names.
	 * Activates the new view against the All layouts pool.
	 */
	saveSelectedLayoutsAsView(name: string): string | null {
		const selected = [...this.selectedLayoutNames];
		if (selected.length === 0) return null;

		const snapshot = createDefaultViewSnapshot();
		return this.saveSharedViewAsView(name, snapshot, selected);
	}

	/** Remove a layout name from the active view's source (session; persist via Update). */
	removeLayoutFromActiveSavedView(name: string) {
		const active = this.activeSourceLayoutNames;
		if (active === null) return;
		this.applySourceSelection(active.filter((entry) => entry !== name));
	}

	toggleIncludeSelectedInResults() {
		if (this.selectedLayoutNames.size === 0 || this.layoutSource === 'selected') {
			this.includeSelectedInResults = false;
			this.#saveToUrl();
			return;
		}
		this.includeSelectedInResults = !this.includeSelectedInResults;
		this.#saveToUrl();
	}

	/** Swap the first two selected layouts (new ↔ old). */
	swapSelectedLayouts() {
		const names = [...this.selectedLayoutNames];
		if (names.length < 2) return;
		const [first, second, ...rest] = names;
		this.selectedLayoutNames.clear();
		for (const name of [second, first, ...rest]) {
			this.selectedLayoutNames.add(name);
		}
		this.#saveToUrl();
	}

	/** Drop selected layouts that are no longer in the catalog. */
	pruneSelectedLayouts(existingNames: ReadonlySet<string>) {
		if (this.selectedLayoutNames.size === 0) return;
		let removed = false;
		for (const name of [...this.selectedLayoutNames]) {
			if (!existingNames.has(name)) {
				this.selectedLayoutNames.delete(name);
				removed = true;
			}
		}
		if (this.selectedLayoutNames.size === 0 && this.includeSelectedInResults) {
			this.includeSelectedInResults = false;
			removed = true;
		}
		if (removed) this.#saveToUrl();
	}

	clearAll() {
		this.includeGrid = createEmptyFilterGrid();
		this.excludeGrid = createEmptyFilterGrid();
		this.includeOrGrid = createEmptyFilterGrid();
		this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
		this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeRightThumbKeys = createEmptyThumbKeyFilters();
		this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
		this.showUnfinished = false;
		this.thumbKeyFilter = 'optional';
		this.magicKeyFilter = 'optional';
		this.characterSetFilter = 'english';
		this.boardTypeFilter = 'all';
		this.nameFilterInput = '';
		this.nameFilter = '';
		this.selectedAuthors.clear();
		this.includeSelectedInResults = false;
		this.similarReferenceName = null;
		// Reset on a non-saved All view also drops ephemeral shared membership.
		if (!this.activeSavedFilterId) {
			this.ephemeralSourceLayoutNames = null;
			this.draftSourceLayoutNames = undefined;
		}
		this.#restoreSortAfterSimilar();
		this.#resetSimilarityFilter();
		this.statLimits = createEmptyStatLimits();
		this.#cancelFilterApply();
		this.#applyFiltersNow();
		// Push so Back can restore the previous filter URL.
		this.#saveToUrl({ history: 'push' });
	}

	requestFilterFocus(request: FilterFocusRequest) {
		this.filterFocusRequest = request;
		this.filterFocusRequestSeq += 1;
	}

	focusLayout(name: string) {
		this.includeGrid = createEmptyFilterGrid();
		this.excludeGrid = createEmptyFilterGrid();
		this.includeOrGrid = createEmptyFilterGrid();
		this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
		this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeRightThumbKeys = createEmptyThumbKeyFilters();
		this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
		this.selectedAuthors.clear();
		this.thumbKeyFilter = 'optional';
		this.magicKeyFilter = 'optional';
		this.characterSetFilter = 'all';
		this.boardTypeFilter = 'all';
		this.showUnfinished = true;
		this.nameFilterInput = name;
		this.#applyFiltersNow();
		this.focusLayoutName = name;
		this.#saveToUrl();
	}

	clearFocusLayout() {
		this.focusLayoutName = null;
	}

	toggleSimilarReference(name: string, anglemod = false) {
		if (this.similarReferenceName === name) {
			this.similarReferenceName = null;
			this.#restoreSortAfterSimilar();
		} else {
			const switchingReference = this.similarReferenceName !== null;
			if (!switchingReference) {
				this.#sortBeforeSimilar = this.#snapshotSort();
				this.#exitSortRestore = this.#sortBeforeSimilar;
			}
			this.similarReferenceName = name;
			this.similarReferenceAnglemod = anglemod;
			this.sortBy = 'similarity';
			if (!this.#sortOrderManual) {
				this.sortOrder = getDefaultSortOrder('similarity');
			}
			this.scrollToSelectedLayout = true;
		}
		this.#saveToUrl();
	}

	clearScrollToSelectedLayout() {
		this.scrollToSelectedLayout = false;
	}

	clearSimilarReference() {
		this.similarReferenceName = null;
		this.#restoreSortAfterSimilar();
		this.#saveToUrl();
	}

	get hasSimilarReference(): boolean {
		return this.similarReferenceName !== null;
	}

	/**
	 * Analyzers whose stats must be loaded/checked for the given limits.
	 * Each analyzer’s limits are fully independent (no shared keys).
	 */
	#analyzersNeededForLimits(limits: Record<StatLimitKey, StatLimit>): StatsAnalyzer[] {
		return analyzersNeededForLimits(limits);
	}

	get analyzersNeededForStatLimits(): StatsAnalyzer[] {
		return this.#analyzersNeededForLimits(this.appliedStatLimits);
	}

	get hasActiveStatLimits(): boolean {
		if (this.#analyzersNeededForLimits(this.statLimits).length > 0) return true;
		return this.canUseLikes && this.statLimits.likes.value.trim() !== '';
	}

	#gridOrThumbsActive(grid: string[][], leftThumbs: string[], rightThumbs: string[]): boolean {
		return (
			grid.some((row) => row.some((cell) => cell !== '')) ||
			leftThumbs.some((k) => k !== '') ||
			rightThumbs.some((k) => k !== '')
		);
	}

	/** Whether a specific key-filter kind (AND / OR / Exclude) has any filled cells. */
	hasActiveKeyFilterKind(kind: 'and' | 'or' | 'exclude'): boolean {
		switch (kind) {
			case 'and':
				return this.#gridOrThumbsActive(
					this.includeGrid,
					this.includeLeftThumbKeys,
					this.includeRightThumbKeys
				);
			case 'or':
				return this.#gridOrThumbsActive(
					this.includeOrGrid,
					this.includeOrLeftThumbKeys,
					this.includeOrRightThumbKeys
				);
			case 'exclude':
				return this.#gridOrThumbsActive(
					this.excludeGrid,
					this.excludeLeftThumbKeys,
					this.excludeRightThumbKeys
				);
		}
	}

	get hasActiveKeyFilters(): boolean {
		return (
			this.hasActiveKeyFilterKind('and') ||
			this.hasActiveKeyFilterKind('or') ||
			this.hasActiveKeyFilterKind('exclude')
		);
	}

	/** Applied (debounced) stat limits — used by page load / filter pipeline. */
	get hasAppliedStatLimits(): boolean {
		if (this.analyzersNeededForStatLimits.length > 0) return true;
		return this.canUseLikes && this.appliedStatLimits.likes.value.trim() !== '';
	}

	get hasActiveKeyboardFilters(): boolean {
		return (
			this.showUnfinished ||
			this.thumbKeyFilter !== 'optional' ||
			this.magicKeyFilter !== 'optional' ||
			this.characterSetFilter !== 'english' ||
			this.boardTypeFilter !== 'all'
		);
	}

	get hasActiveFilters(): boolean {
		return (
			this.hasActiveKeyFilters ||
			this.hasActiveKeyboardFilters ||
			this.nameFilterInput !== '' ||
			this.selectedAuthors.size > 0 ||
			this.similarReferenceName !== null ||
			this.hasActiveStatLimits
		);
	}

	/** True when applied stat limits need analyzer maps that are not ready yet. */
	statFiltersAwaitingStats(statsMaps: StatsMaps, statsReady: boolean): boolean {
		const needed = this.analyzersNeededForStatLimits;
		if (needed.length === 0) return false;
		return !statsReady || !needed.every((analyzer) => isAnalyzerStatsReady(statsMaps, analyzer));
	}

	filterLayouts(
		layouts: LayoutData[],
		statsMaps: StatsMaps = {},
		statsReady = false,
		likesData: LayoutLikesMap = {}
	): LayoutData[] {
		return filterLayoutCatalog(
			layouts,
			{
				layoutSource: this.layoutSource,
				selectedLayoutNames: this.selectedLayoutNames,
				sourceLayoutNames: this.activeSourceLayoutNameSet,
				showUnfinished: this.showUnfinished,
				thumbKeyFilter: this.thumbKeyFilter,
				magicKeyFilter: this.magicKeyFilter,
				characterSetFilter: this.characterSetFilter,
				boardTypeFilter: this.boardTypeFilter,
				nameFilter: this.nameFilter,
				selectedAuthors: this.selectedAuthors,
				includeGrid: this.appliedIncludeGrid,
				excludeGrid: this.appliedExcludeGrid,
				includeOrGrid: this.appliedIncludeOrGrid,
				includeOrLeftThumbKeys: this.appliedIncludeOrLeftThumbKeys,
				includeOrRightThumbKeys: this.appliedIncludeOrRightThumbKeys,
				includeLeftThumbKeys: this.appliedIncludeLeftThumbKeys,
				includeRightThumbKeys: this.appliedIncludeRightThumbKeys,
				excludeLeftThumbKeys: this.appliedExcludeLeftThumbKeys,
				excludeRightThumbKeys: this.appliedExcludeRightThumbKeys,
				statLimits: this.appliedStatLimits,
				canUseLikes: this.canUseLikes
			},
			statsMaps,
			statsReady,
			likesData
		);
	}

	sortLayouts(
		layouts: LayoutData[],
		statsMaps: StatsMaps = {},
		likesData: LayoutLikesMap = {}
	): LayoutData[] {
		return sortLayoutCatalog(
			layouts,
			{
				sortBy: this.sortBy,
				sortOrder: this.sortOrder,
				nameFilter: this.nameFilter
			},
			statsMaps,
			likesData
		);
	}
}

export const filterStore = new FilterStore();
