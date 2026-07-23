import { SvelteSet, SvelteURL } from 'svelte/reactivity';
import { pushState, replaceState } from '$app/navigation';
import { page } from '$app/state';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		MANA2_ANALYZER,
		analyzersNeededForLimits,
		deriveBotStats,
		deriveCyanophageStats,
		deriveMana2Stats,
		getLayoutAnalyzerStats,
		getStatFilterFieldsForAnalyzer,
		getStatFilterStatKey,
		getStatSortField,
		getStatSortValue,
		isSortOrder,
		isStatSortBy,
		getDefaultSortOrder,
		isStatsAnalyzerMode,
		isAnalyzerStatsReady,
		parseLegacySortParam,
		normalizeSortBy,
		parseStatFilterThreshold,
		ALL_STAT_FILTER_FIELDS,
		getGeneralStatFilterRowsForAnalyzer,
		getHandStatFilterFieldsForAnalyzer,
		STAT_ANALYZERS,
		type SortBy,
		type SortOrder,
		type StatLimitKey,
		type StatsAnalyzer,
		type StatsAnalyzerMode
	} from './layoutStats';
import type {
	CyanophageStats,
	Mana2Stats,
	MonkeyracerStats,
	LayoutData,
	LayoutLikesMap,
	StatsMaps,
	ThumbKeyEntry
} from './layout';
import { positionSlotKey } from './layoutCodec';
import {
	isSimilarityMirrorMode,
	type SimilarityMirrorMode
} from './layoutSimilarity';
import type { FilterFocusRequest } from './filterSummaries';
import {
	createSavedFilterId,
	loadSavedFilters,
	persistSavedFilters,
	type SavedFilter
} from './savedFiltersStorage';

export type ThumbKeyFilter = 'optional' | 'excluded' | 'required';
export type MagicKeyFilter = 'optional' | 'excluded' | 'required';
export type CharacterSetFilter = 'all' | 'english' | 'international';
export type BoardTypeFilter = 'all' | 'angle' | 'stagger' | 'angle-stagger' | 'ortho' | 'mini';
export type StatLimitOperator = 'lt' | 'gt';
/** Pool of layouts that other filters operate on. */
export type LayoutSource = 'all' | 'selected';
export type { SortBy, SortOrder };
export type { SimilarityMirrorMode };
export type { SavedFilter };

export interface StatLimit {
	operator: StatLimitOperator;
	value: string;
}

/** Precomputed active stat limits for one filterLayouts pass. */
type ActiveAnalyzerStatFilters = {
	analyzer: StatsAnalyzer;
	checks: Array<{
		operator: StatLimitOperator;
		threshold: number;
		statKey: ReturnType<typeof getStatFilterStatKey>;
	}>;
};

type LikesLimitCheck = { operator: StatLimitOperator; threshold: number };

function createEmptyStatLimits(): Record<StatLimitKey, StatLimit> {
	const limits = {} as Record<StatLimitKey, StatLimit>;
	for (const field of ALL_STAT_FILTER_FIELDS) {
		limits[field.key] = { operator: 'lt', value: '' };
	}
	limits.likes = { operator: 'gt', value: '' };
	return limits;
}

function serializeStatLimits(limits: Record<StatLimitKey, StatLimit>): string {
	const parts: string[] = [];
	for (const field of ALL_STAT_FILTER_FIELDS) {
		const limit = limits[field.key];
		const value = limit.value.trim();
		if (!value) continue;
		parts.push(`${field.key}:${limit.operator}:${value}`);
	}
	return parts.join(',');
}

function deserializeStatLimits(str: string): Record<StatLimitKey, StatLimit> {
	const limits = createEmptyStatLimits();
	if (!str) return limits;

	for (const part of str.split(',')) {
		const [key, operator, ...valueParts] = part.split(':');
		if (!key || !operator || valueParts.length === 0) continue;
		if (!(key in limits)) continue;
		if (operator !== 'lt' && operator !== 'gt') continue;
		limits[key as StatLimitKey] = {
			operator,
			value: valueParts.join(':')
		};
	}
	return limits;
}

/** Parse a `statLimits` URL param into a limits record (empty values when absent). */
export function parseStatLimitsParam(str: string | null | undefined): Record<StatLimitKey, StatLimit> {
	return deserializeStatLimits(str?.trim() ?? '');
}

const ROWS = 3;
const COLS = 10;
const THUMB_KEYS_PER_HAND = 4;
const DEBOUNCE_MS = 300;

function createEmptyThumbKeyFilters(): string[] {
	return Array.from({ length: THUMB_KEYS_PER_HAND }, () => '');
}

function createEmptyGrid(): string[][] {
	return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
}

// Serialize grid to compact string: "r0c0,r0c1,r1c2" for non-empty cells
function serializeGrid(grid: string[][]): string {
	const parts: string[] = [];
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const char = grid[row][col];
			if (char) {
				parts.push(`${row}${col}${char}`);
			}
		}
	}
	return parts.join(',');
}

// Deserialize compact string back to grid
function deserializeGrid(str: string): string[][] {
	const grid = createEmptyGrid();
	if (!str) return grid;

	const parts = str.split(',');
	for (const part of parts) {
		if (part.length >= 3) {
			const row = parseInt(part[0], 10);
			const col = parseInt(part[1], 10);
			const char = part.slice(2);
			if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
				grid[row][col] = char;
			}
		}
	}
	return grid;
}

type SortSnapshot = {
	sortBy: SortBy;
	sortOrder: SortOrder;
	sortOrderManual: boolean;
};

/** Per-view filter fields — All and Selected keep isolated snapshots (never synced). */
export type ViewFilterSnapshot = {
	includeGrid: string[][];
	excludeGrid: string[][];
	includeOrGrid: string[][];
	includeOrLeftThumbKeys: string[];
	includeOrRightThumbKeys: string[];
	includeLeftThumbKeys: string[];
	includeRightThumbKeys: string[];
	excludeLeftThumbKeys: string[];
	excludeRightThumbKeys: string[];
	showUnfinished: boolean;
	thumbKeyFilter: ThumbKeyFilter;
	magicKeyFilter: MagicKeyFilter;
	characterSetFilter: CharacterSetFilter;
	boardTypeFilter: BoardTypeFilter;
	nameFilterInput: string;
	nameFilter: string;
	selectedAuthors: number[];
	includeSelectedInResults: boolean;
	similarReferenceName: string | null;
	similarReferenceAnglemod: boolean;
	similarityFilterOperator: StatLimitOperator;
	similarityFilterValue: string;
	appliedSimilarityFilterValue: string;
	similarityWeightHomeKeys: boolean;
	similarityMirrorMode: SimilarityMirrorMode;
	sortBy: SortBy;
	sortOrder: SortOrder;
	sortOrderManual: boolean;
	sortBeforeSimilar: SortSnapshot | null;
	exitSortRestore: SortSnapshot | null;
	statLimits: Record<StatLimitKey, StatLimit>;
	appliedIncludeGrid: string[][];
	appliedExcludeGrid: string[][];
	appliedIncludeOrGrid: string[][];
	appliedIncludeOrLeftThumbKeys: string[];
	appliedIncludeOrRightThumbKeys: string[];
	appliedIncludeLeftThumbKeys: string[];
	appliedIncludeRightThumbKeys: string[];
	appliedExcludeLeftThumbKeys: string[];
	appliedExcludeRightThumbKeys: string[];
	appliedStatLimits: Record<StatLimitKey, StatLimit>;
};

export class FilterStore {
	includeGrid: string[][] = $state(createEmptyGrid());
	excludeGrid: string[][] = $state(createEmptyGrid());
	includeOrGrid: string[][] = $state(createEmptyGrid());
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
	/** Layouts checked for compare / "selected" source filtering. */
	compareSelectedNames: SvelteSet<string> = new SvelteSet();
	/** When `selected`, other filters run only over compare-checked layouts. */
	layoutSource: LayoutSource = $state('all');
	/** Named filter presets persisted in localStorage (not URL). */
	savedFilters: SavedFilter[] = $state([]);
	/** When set, a saved-filter tab is active (pool stays `all`). */
	activeSavedFilterId: string | null = $state(null);
	/**
	 * When true (and source is `all`), inject compare-selected layouts into the result
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
	#viewFilterSnapshots = new Map<LayoutSource, ViewFilterSnapshot>();
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
	appliedIncludeGrid: string[][] = $state(createEmptyGrid());
	appliedExcludeGrid: string[][] = $state(createEmptyGrid());
	appliedIncludeOrGrid: string[][] = $state(createEmptyGrid());
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

	constructor() {
		this.#loadFromUrl();
		this.#applyFiltersFromInputs();
		if (typeof window !== 'undefined') {
			this.savedFilters = loadSavedFilters();
			window.addEventListener('popstate', () => {
				this.#hydrateFromUrl();
			});
		}
	}

	#cloneGrid(grid: string[][]): string[][] {
		return grid.map((row) => [...row]);
	}

	#cloneThumbKeys(keys: string[]): string[] {
		return [...keys];
	}

	#cloneStatLimits(limits: Record<StatLimitKey, StatLimit>): Record<StatLimitKey, StatLimit> {
		const next = createEmptyStatLimits();
		for (const key of Object.keys(limits) as StatLimitKey[]) {
			next[key] = { operator: limits[key].operator, value: limits[key].value };
		}
		return next;
	}

	#applyFiltersFromInputs() {
		this.appliedIncludeGrid = this.#cloneGrid(this.includeGrid);
		this.appliedExcludeGrid = this.#cloneGrid(this.excludeGrid);
		this.appliedIncludeOrGrid = this.#cloneGrid(this.includeOrGrid);
		this.appliedIncludeOrLeftThumbKeys = this.#cloneThumbKeys(this.includeOrLeftThumbKeys);
		this.appliedIncludeOrRightThumbKeys = this.#cloneThumbKeys(this.includeOrRightThumbKeys);
		this.appliedIncludeLeftThumbKeys = this.#cloneThumbKeys(this.includeLeftThumbKeys);
		this.appliedIncludeRightThumbKeys = this.#cloneThumbKeys(this.includeRightThumbKeys);
		this.appliedExcludeLeftThumbKeys = this.#cloneThumbKeys(this.excludeLeftThumbKeys);
		this.appliedExcludeRightThumbKeys = this.#cloneThumbKeys(this.excludeRightThumbKeys);
		this.appliedStatLimits = this.#cloneStatLimits(this.statLimits);
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
	}

	#persistSavedFilters() {
		persistSavedFilters(this.savedFilters);
	}

	#resetUrlControlledState() {
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.includeOrGrid = createEmptyGrid();
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
		this.compareSelectedNames.clear();
		this.layoutSource = 'all';
		this.activeSavedFilterId = null;
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

		const include = url.searchParams.get('include');
		if (include) {
			this.includeGrid = deserializeGrid(include);
		}

		const exclude = url.searchParams.get('exclude');
		if (exclude) {
			this.excludeGrid = deserializeGrid(exclude);
		}

		const showUnfinished = url.searchParams.get('showUnfinished');
		if (showUnfinished !== null) {
			this.showUnfinished = showUnfinished !== '0';
		}

		const thumbKeys = url.searchParams.get('thumbKeys');
		if (thumbKeys === 'excluded' || thumbKeys === 'required') {
			this.thumbKeyFilter = thumbKeys;
			// Clear thumb key filters when set to excluded
			if (thumbKeys === 'excluded') {
				this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
				this.includeRightThumbKeys = createEmptyThumbKeyFilters();
				this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
				this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
				this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
				this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
			}
		}

		const magicKey = url.searchParams.get('magicKey');
		if (magicKey === 'excluded' || magicKey === 'required') {
			this.magicKeyFilter = magicKey;
		}

		const characterSet = url.searchParams.get('characterSet');
		if (characterSet === 'all' || characterSet === 'english' || characterSet === 'international') {
			this.characterSetFilter = characterSet;
		}

		const boardType = url.searchParams.get('boardType');
		if (
			boardType === 'all' ||
			boardType === 'angle' ||
			boardType === 'stagger' ||
			boardType === 'angle-stagger' ||
			boardType === 'ortho' ||
			boardType === 'mini'
		) {
			this.boardTypeFilter = boardType;
		}

		const name = url.searchParams.get('name');
		if (name) {
			this.nameFilterInput = name;
			this.nameFilter = name;
		}

		const authors = url.searchParams.get('authors');
		if (authors) {
			for (const id of authors.split(',').map(Number)) {
				if (Number.isFinite(id)) this.selectedAuthors.add(id);
			}
		}

		const compare = url.searchParams.get('compare');
		if (compare) {
			for (const name of compare
				.split(',')
				.map((n) => n.trim())
				.filter(Boolean)) {
				this.compareSelectedNames.add(name);
			}
		}

		if (url.searchParams.get('source') === 'selected') {
			this.layoutSource = 'selected';
		} else if (
			url.searchParams.get('showSelected') === '1' &&
			this.compareSelectedNames.size > 0
		) {
			this.includeSelectedInResults = true;
		}

		const parseThumbFilters = (value: string | null): string[] =>
			value ? [...value.split('|'), ...createEmptyThumbKeyFilters()].slice(0, THUMB_KEYS_PER_HAND) : createEmptyThumbKeyFilters();

		const includeLeftThumbs = url.searchParams.get('includeLeftThumbs');
		if (includeLeftThumbs) {
			this.includeLeftThumbKeys = parseThumbFilters(includeLeftThumbs);
		}

		const includeRightThumbs = url.searchParams.get('includeRightThumbs');
		if (includeRightThumbs) {
			this.includeRightThumbKeys = parseThumbFilters(includeRightThumbs);
		}

		const excludeLeftThumbs = url.searchParams.get('excludeLeftThumbs');
		if (excludeLeftThumbs) {
			this.excludeLeftThumbKeys = parseThumbFilters(excludeLeftThumbs);
		}

		const excludeRightThumbs = url.searchParams.get('excludeRightThumbs');
		if (excludeRightThumbs) {
			this.excludeRightThumbKeys = parseThumbFilters(excludeRightThumbs);
		}

		// Legacy: single combined thumb filter → left hand only
		const includeThumbs = url.searchParams.get('includeThumbs');
		if (includeThumbs && !includeLeftThumbs && !includeRightThumbs) {
			this.includeLeftThumbKeys = parseThumbFilters(includeThumbs);
		}

		const excludeThumbs = url.searchParams.get('excludeThumbs');
		if (excludeThumbs && !excludeLeftThumbs && !excludeRightThumbs) {
			this.excludeLeftThumbKeys = parseThumbFilters(excludeThumbs);
		}

		const includeOr = url.searchParams.get('includeOr');
		if (includeOr) {
			this.includeOrGrid = deserializeGrid(includeOr);
		}

		const includeOrLeftThumbs = url.searchParams.get('includeOrLeftThumbs');
		if (includeOrLeftThumbs) {
			this.includeOrLeftThumbKeys = parseThumbFilters(includeOrLeftThumbs);
		}

		const includeOrRightThumbs = url.searchParams.get('includeOrRightThumbs');
		if (includeOrRightThumbs) {
			this.includeOrRightThumbKeys = parseThumbFilters(includeOrRightThumbs);
		}

		if (url.searchParams.get('likes') === '0') {
			this.hideLayoutLikes = true;
		}

		if (url.searchParams.get('newIndicator') === '0') {
			this.hideNewLayoutIndicator = true;
		}

		const sort = url.searchParams.get('sort');
		const order = url.searchParams.get('order');

		// Analyzer before sort so ambiguous legacy values (e.g. `sfb`) disambiguate correctly.
		const analyzer = url.searchParams.get('analyzer');
		if (analyzer && isStatsAnalyzerMode(analyzer)) {
			this.statsAnalyzer = analyzer;
		}

		if (sort) {
			const legacy = parseLegacySortParam(sort);
			if (legacy) {
				this.sortBy = legacy.sortBy;
				if (!order) {
					this.sortOrder = legacy.sortOrder;
				}
			} else {
				const normalized = normalizeSortBy(sort, this.statsAnalyzer);
				if (normalized) {
					this.sortBy = normalized;
					if (!order) {
						this.sortOrder = getDefaultSortOrder(normalized);
					}
				}
			}
		}

		if (order && isSortOrder(order)) {
			this.sortOrder = order;
			// Only treat as a manual override when it differs from the field default.
			// Otherwise sticky Desc from e.g. date/rolls would stick on lower-is-better
			// Cyanophage fields (SFB, scissors, effort, …) after reload.
			this.#sortOrderManual = order !== getDefaultSortOrder(this.sortBy);
		}

		if (url.searchParams.get('stats') === '0') {
			this.hideLayoutStats = true;
		}

		if (url.searchParams.get('testArea') === '0') {
			this.hideLayoutTestArea = true;
		}

		if (url.searchParams.get('stickySimilar') === '0') {
			this.stickySimilarityCard = false;
		}

		const similar = url.searchParams.get('similar');
		if (similar) {
			this.similarReferenceName = similar;
			// Match click behavior: default to Similarity when no explicit sort is in the URL
			if (!sort) {
				this.sortBy = 'similarity';
				if (!order) this.sortOrder = getDefaultSortOrder('similarity');
			}
		}

		const similarFilter = url.searchParams.get('similarFilter');
		if (similarFilter) {
			const [operator, ...valueParts] = similarFilter.split(':');
			if (operator === 'lt' || operator === 'gt') {
				this.similarityFilterOperator = operator;
				this.similarityFilterValue = valueParts.join(':');
			}
		}

		if (url.searchParams.get('similarHome') === '1') {
			this.similarityWeightHomeKeys = true;
		}

		if (url.searchParams.get('similarAnglemod') === '1') {
			this.similarReferenceAnglemod = true;
		}

		const similarMirror = url.searchParams.get('similarMirror');
		if (similarMirror === '1' || similarMirror === 'include') {
			// Legacy checkbox / Include label
			this.similarityMirrorMode = 'optional';
		} else if (similarMirror === 'exclude') {
			this.similarityMirrorMode = 'excluded';
		} else if (similarMirror && isSimilarityMirrorMode(similarMirror)) {
			this.similarityMirrorMode = similarMirror;
		}

		const statLimits = url.searchParams.get('statLimits');
		if (statLimits) {
			this.statLimits = deserializeStatLimits(statLimits);
			if (this.hideLayoutLikes) {
				this.statLimits.likes = { operator: 'lt', value: '' };
			}
		}
	}

	#saveToUrl(options: { history?: 'replace' | 'push' } = {}) {
		const historyMode = options.history ?? 'replace';
		const url = new SvelteURL(window.location.href);
		url.search = '';

		// Filter params use applied (committed) state so the URL matches results/chips.
		const includeSerialized = serializeGrid(this.appliedIncludeGrid);
		if (includeSerialized) {
			url.searchParams.set('include', includeSerialized);
		}

		const excludeSerialized = serializeGrid(this.appliedExcludeGrid);
		if (excludeSerialized) {
			url.searchParams.set('exclude', excludeSerialized);
		}

		if (this.showUnfinished) {
			url.searchParams.set('showUnfinished', '1');
		}

		if (this.thumbKeyFilter !== 'optional') {
			url.searchParams.set('thumbKeys', this.thumbKeyFilter);
		}

		if (this.magicKeyFilter !== 'optional') {
			url.searchParams.set('magicKey', this.magicKeyFilter);
		}

		if (this.characterSetFilter !== 'english') {
			url.searchParams.set('characterSet', this.characterSetFilter);
		}

		if (this.boardTypeFilter !== 'all') {
			url.searchParams.set('boardType', this.boardTypeFilter);
		}

		if (this.nameFilter) {
			url.searchParams.set('name', this.nameFilter);
		}

		if (this.selectedAuthors.size > 0) {
			url.searchParams.set('authors', Array.from(this.selectedAuthors).join(','));
		}

		if (this.compareSelectedNames.size > 0) {
			url.searchParams.set(
				'compare',
				Array.from(this.compareSelectedNames).join(',')
			);
		}

		if (this.layoutSource === 'selected') {
			url.searchParams.set('source', 'selected');
		} else if (this.includeSelectedInResults && this.compareSelectedNames.size > 0) {
			url.searchParams.set('showSelected', '1');
		}

		const serializeThumbFilters = (filters: string[]) => filters.filter((k) => k !== '').join('|');

		const includeLeftThumbsSerialized = serializeThumbFilters(this.appliedIncludeLeftThumbKeys);
		if (includeLeftThumbsSerialized) {
			url.searchParams.set('includeLeftThumbs', includeLeftThumbsSerialized);
		}

		const includeRightThumbsSerialized = serializeThumbFilters(this.appliedIncludeRightThumbKeys);
		if (includeRightThumbsSerialized) {
			url.searchParams.set('includeRightThumbs', includeRightThumbsSerialized);
		}

		const excludeLeftThumbsSerialized = serializeThumbFilters(this.appliedExcludeLeftThumbKeys);
		if (excludeLeftThumbsSerialized) {
			url.searchParams.set('excludeLeftThumbs', excludeLeftThumbsSerialized);
		}

		const excludeRightThumbsSerialized = serializeThumbFilters(this.appliedExcludeRightThumbKeys);
		if (excludeRightThumbsSerialized) {
			url.searchParams.set('excludeRightThumbs', excludeRightThumbsSerialized);
		}

		const includeOrSerialized = serializeGrid(this.appliedIncludeOrGrid);
		if (includeOrSerialized) {
			url.searchParams.set('includeOr', includeOrSerialized);
		}

		const includeOrLeftThumbsSerialized = serializeThumbFilters(
			this.appliedIncludeOrLeftThumbKeys
		);
		if (includeOrLeftThumbsSerialized) {
			url.searchParams.set('includeOrLeftThumbs', includeOrLeftThumbsSerialized);
		}

		const includeOrRightThumbsSerialized = serializeThumbFilters(
			this.appliedIncludeOrRightThumbKeys
		);
		if (includeOrRightThumbsSerialized) {
			url.searchParams.set('includeOrRightThumbs', includeOrRightThumbsSerialized);
		}

		if (this.sortBy !== 'date' || this.sortOrder !== 'desc') {
			url.searchParams.set('sort', this.sortBy);
			url.searchParams.set('order', this.sortOrder);
		}

		if (this.statsAnalyzer !== DEFAULT_STATS_ANALYZER) {
			url.searchParams.set('analyzer', this.statsAnalyzer);
		}

		if (this.hideLayoutStats) {
			url.searchParams.set('stats', '0');
		}

		if (this.hideLayoutTestArea) {
			url.searchParams.set('testArea', '0');
		}

		if (this.hideLayoutLikes) {
			url.searchParams.set('likes', '0');
		}

		if (this.hideNewLayoutIndicator) {
			url.searchParams.set('newIndicator', '0');
		}

		if (!this.stickySimilarityCard) {
			url.searchParams.set('stickySimilar', '0');
		}

		if (this.similarReferenceName) {
			url.searchParams.set('similar', this.similarReferenceName);
			url.searchParams.set(
				'similarFilter',
				`${this.similarityFilterOperator}:${this.appliedSimilarityFilterValue.trim()}`
			);
			if (this.similarityWeightHomeKeys) {
				url.searchParams.set('similarHome', '1');
			}
			if (this.similarReferenceAnglemod) {
				url.searchParams.set('similarAnglemod', '1');
			}
			if (this.similarityMirrorMode !== 'excluded') {
				url.searchParams.set('similarMirror', this.similarityMirrorMode);
			}
		}

		const statLimitsSerialized = serializeStatLimits(this.appliedStatLimits);
		if (statLimitsSerialized) {
			url.searchParams.set('statLimits', statLimitsSerialized);
		}

		const next = `${url.pathname}${url.search}${url.hash}`;
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (historyMode === 'push') {
			if (next !== current) {
				pushState(url, page.state);
			}
		} else {
			replaceState(url, page.state);
		}
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

	#cloneSortSnapshot(snapshot: SortSnapshot | null): SortSnapshot | null {
		if (!snapshot) return null;
		return {
			sortBy: snapshot.sortBy,
			sortOrder: snapshot.sortOrder,
			sortOrderManual: snapshot.sortOrderManual
		};
	}

	#captureViewFilters(): ViewFilterSnapshot {
		return {
			includeGrid: this.#cloneGrid(this.includeGrid),
			excludeGrid: this.#cloneGrid(this.excludeGrid),
			includeOrGrid: this.#cloneGrid(this.includeOrGrid),
			includeOrLeftThumbKeys: this.#cloneThumbKeys(this.includeOrLeftThumbKeys),
			includeOrRightThumbKeys: this.#cloneThumbKeys(this.includeOrRightThumbKeys),
			includeLeftThumbKeys: this.#cloneThumbKeys(this.includeLeftThumbKeys),
			includeRightThumbKeys: this.#cloneThumbKeys(this.includeRightThumbKeys),
			excludeLeftThumbKeys: this.#cloneThumbKeys(this.excludeLeftThumbKeys),
			excludeRightThumbKeys: this.#cloneThumbKeys(this.excludeRightThumbKeys),
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
			sortBeforeSimilar: this.#cloneSortSnapshot(this.#sortBeforeSimilar),
			exitSortRestore: this.#cloneSortSnapshot(this.#exitSortRestore),
			statLimits: this.#cloneStatLimits(this.statLimits),
			appliedIncludeGrid: this.#cloneGrid(this.appliedIncludeGrid),
			appliedExcludeGrid: this.#cloneGrid(this.appliedExcludeGrid),
			appliedIncludeOrGrid: this.#cloneGrid(this.appliedIncludeOrGrid),
			appliedIncludeOrLeftThumbKeys: this.#cloneThumbKeys(this.appliedIncludeOrLeftThumbKeys),
			appliedIncludeOrRightThumbKeys: this.#cloneThumbKeys(this.appliedIncludeOrRightThumbKeys),
			appliedIncludeLeftThumbKeys: this.#cloneThumbKeys(this.appliedIncludeLeftThumbKeys),
			appliedIncludeRightThumbKeys: this.#cloneThumbKeys(this.appliedIncludeRightThumbKeys),
			appliedExcludeLeftThumbKeys: this.#cloneThumbKeys(this.appliedExcludeLeftThumbKeys),
			appliedExcludeRightThumbKeys: this.#cloneThumbKeys(this.appliedExcludeRightThumbKeys),
			appliedStatLimits: this.#cloneStatLimits(this.appliedStatLimits)
		};
	}

	#restoreViewFilters(snapshot: ViewFilterSnapshot) {
		this.includeGrid = this.#cloneGrid(snapshot.includeGrid);
		this.excludeGrid = this.#cloneGrid(snapshot.excludeGrid);
		this.includeOrGrid = this.#cloneGrid(snapshot.includeOrGrid);
		this.includeOrLeftThumbKeys = this.#cloneThumbKeys(snapshot.includeOrLeftThumbKeys);
		this.includeOrRightThumbKeys = this.#cloneThumbKeys(snapshot.includeOrRightThumbKeys);
		this.includeLeftThumbKeys = this.#cloneThumbKeys(snapshot.includeLeftThumbKeys);
		this.includeRightThumbKeys = this.#cloneThumbKeys(snapshot.includeRightThumbKeys);
		this.excludeLeftThumbKeys = this.#cloneThumbKeys(snapshot.excludeLeftThumbKeys);
		this.excludeRightThumbKeys = this.#cloneThumbKeys(snapshot.excludeRightThumbKeys);
		this.showUnfinished = snapshot.showUnfinished;
		this.thumbKeyFilter = snapshot.thumbKeyFilter;
		this.magicKeyFilter = snapshot.magicKeyFilter;
		this.characterSetFilter = snapshot.characterSetFilter;
		this.boardTypeFilter = snapshot.boardTypeFilter;
		this.nameFilterInput = snapshot.nameFilterInput;
		this.nameFilter = snapshot.nameFilter;
		this.selectedAuthors.clear();
		for (const id of snapshot.selectedAuthors) {
			this.selectedAuthors.add(id);
		}
		this.includeSelectedInResults = snapshot.includeSelectedInResults;
		this.similarReferenceName = snapshot.similarReferenceName;
		this.similarReferenceAnglemod = snapshot.similarReferenceAnglemod;
		this.similarityFilterOperator = snapshot.similarityFilterOperator;
		this.similarityFilterValue = snapshot.similarityFilterValue;
		this.appliedSimilarityFilterValue = snapshot.appliedSimilarityFilterValue;
		this.similarityWeightHomeKeys = snapshot.similarityWeightHomeKeys;
		this.similarityMirrorMode = snapshot.similarityMirrorMode;
		this.sortBy = snapshot.sortBy;
		this.sortOrder = snapshot.sortOrder;
		this.#sortOrderManual = snapshot.sortOrderManual;
		this.#sortBeforeSimilar = this.#cloneSortSnapshot(snapshot.sortBeforeSimilar);
		this.#exitSortRestore = this.#cloneSortSnapshot(snapshot.exitSortRestore);
		this.statLimits = this.#cloneStatLimits(snapshot.statLimits);
		this.appliedIncludeGrid = this.#cloneGrid(snapshot.appliedIncludeGrid);
		this.appliedExcludeGrid = this.#cloneGrid(snapshot.appliedExcludeGrid);
		this.appliedIncludeOrGrid = this.#cloneGrid(snapshot.appliedIncludeOrGrid);
		this.appliedIncludeOrLeftThumbKeys = this.#cloneThumbKeys(snapshot.appliedIncludeOrLeftThumbKeys);
		this.appliedIncludeOrRightThumbKeys = this.#cloneThumbKeys(
			snapshot.appliedIncludeOrRightThumbKeys
		);
		this.appliedIncludeLeftThumbKeys = this.#cloneThumbKeys(snapshot.appliedIncludeLeftThumbKeys);
		this.appliedIncludeRightThumbKeys = this.#cloneThumbKeys(snapshot.appliedIncludeRightThumbKeys);
		this.appliedExcludeLeftThumbKeys = this.#cloneThumbKeys(snapshot.appliedExcludeLeftThumbKeys);
		this.appliedExcludeRightThumbKeys = this.#cloneThumbKeys(snapshot.appliedExcludeRightThumbKeys);
		this.appliedStatLimits = this.#cloneStatLimits(snapshot.appliedStatLimits);
		this.appliedFiltersRevision += 1;
	}

	/** Defaults for a view that has never been visited (no snapshot yet). */
	#resetViewFiltersToDefaults() {
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.includeOrGrid = createEmptyGrid();
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
		this.#sortBeforeSimilar = null;
		this.#exitSortRestore = null;
		this.#resetSimilarityFilter();
		this.sortBy = 'date';
		this.sortOrder = 'desc';
		this.#sortOrderManual = false;
		this.statLimits = createEmptyStatLimits();
		this.#applyFiltersFromInputs();
	}

	#setGridCell(grid: string[][], row: number, col: number, value: string): string[][] {
		return grid.map((r, ri) =>
			ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
		);
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
		this.includeOrLeftThumbKeys = this.#setThumbKey(
			this.includeOrLeftThumbKeys,
			index,
			value
		);
		this.#scheduleFilterApply();
	}

	setIncludeOrRightThumbKey(index: number, value: string) {
		this.includeOrRightThumbKeys = this.#setThumbKey(
			this.includeOrRightThumbKeys,
			index,
			value
		);
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
		const previousDefault = getDefaultSortOrder(this.sortBy);
		const wasOnDefaultOrder = !this.#sortOrderManual || this.sortOrder === previousDefault;
		this.sortBy = value;
		if (wasOnDefaultOrder) {
			// Adopt this field's default (Asc for lower-is-better Cyanophage stats, etc.).
			this.sortOrder = getDefaultSortOrder(value);
			this.#sortOrderManual = false;
		}
		this.#syncSimilarExitSortRestore(value);
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
		this.statsAnalyzer = value;
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

	setSimilarReferenceAnglemod(value: boolean) {
		this.similarReferenceAnglemod = value;
		this.#saveToUrl();
	}

	setNameFilter(value: string) {
		this.nameFilterInput = value;
		this.#scheduleFilterApply();
	}

	clearInclude() {
		this.includeGrid = createEmptyGrid();
		this.includeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearIncludeOr() {
		this.includeOrGrid = createEmptyGrid();
		this.includeOrLeftThumbKeys = createEmptyThumbKeyFilters();
		this.includeOrRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearExclude() {
		this.excludeGrid = createEmptyGrid();
		this.excludeLeftThumbKeys = createEmptyThumbKeyFilters();
		this.excludeRightThumbKeys = createEmptyThumbKeyFilters();
		this.#applyFiltersNow();
		this.#debouncedSave();
	}

	clearKeyFilters() {
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.includeOrGrid = createEmptyGrid();
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

	toggleCompareLayout(name: string) {
		if (this.compareSelectedNames.has(name)) {
			this.compareSelectedNames.delete(name);
			if (this.compareSelectedNames.size === 0) {
				this.includeSelectedInResults = false;
			}
		} else {
			this.compareSelectedNames.add(name);
		}
		this.#saveToUrl();
	}

	clearCompareLayouts() {
		this.compareSelectedNames.clear();
		this.includeSelectedInResults = false;
		// Push so Back can restore the previous selection.
		this.#saveToUrl({ history: 'push' });
	}

	setLayoutSource(source: LayoutSource) {
		// Leaving a saved-filter tab: restore All/Selected without writing edits into snapshots.
		if (this.activeSavedFilterId) {
			this.#applyFiltersNow();
			this.activeSavedFilterId = null;
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
		const trimmed = name.trim();
		if (!trimmed) return null;

		this.#applyFiltersNow();
		const snapshot = this.#captureViewFilters();

		const existingIndex = this.savedFilters.findIndex(
			(entry) => entry.name.toLowerCase() === trimmed.toLowerCase()
		);

		let id: string;
		if (existingIndex >= 0) {
			const existing = this.savedFilters[existingIndex];
			id = existing.id;
			const next = [...this.savedFilters];
			next[existingIndex] = { ...existing, name: trimmed, snapshot };
			this.savedFilters = next;
		} else {
			id = createSavedFilterId();
			this.savedFilters = [
				...this.savedFilters,
				{ id, name: trimmed, snapshot, createdAt: Date.now() }
			];
		}

		this.#persistSavedFilters();

		if (!this.activeSavedFilterId) {
			this.#viewFilterSnapshots.set(this.layoutSource, snapshot);
		}

		this.layoutSource = 'all';
		this.activeSavedFilterId = id;
		this.includeSelectedInResults = false;
		this.#saveToUrl();
		return id;
	}

	/** True when the active saved view's filters differ from what was last stored. */
	get isActiveSavedViewDirty(): boolean {
		const id = this.activeSavedFilterId;
		if (!id) return false;
		const saved = this.savedFilters.find((entry) => entry.id === id);
		if (!saved) return false;
		return JSON.stringify(this.#captureViewFilters()) !== JSON.stringify(saved.snapshot);
	}

	/** Overwrite the active saved view with the current filter configuration. */
	updateActiveSavedView() {
		const id = this.activeSavedFilterId;
		if (!id) return;

		this.#applyFiltersNow();
		const snapshot = this.#captureViewFilters();
		const index = this.savedFilters.findIndex((entry) => entry.id === id);
		if (index < 0) return;

		const existing = this.savedFilters[index];
		const next = [...this.savedFilters];
		next[index] = { ...existing, snapshot };
		this.savedFilters = next;
		this.#persistSavedFilters();
	}

	/** Activate a saved view (All layouts pool). */
	applySavedFilter(id: string) {
		const saved = this.savedFilters.find((entry) => entry.id === id);
		if (!saved) return;
		if (this.activeSavedFilterId === id) return;

		this.#applyFiltersNow();

		if (!this.activeSavedFilterId) {
			this.#viewFilterSnapshots.set(this.layoutSource, this.#captureViewFilters());
		}

		this.layoutSource = 'all';
		this.activeSavedFilterId = id;
		this.includeSelectedInResults = false;
		this.#restoreViewFilters(saved.snapshot);
		this.#saveToUrl();
	}

	deleteSavedFilter(id: string) {
		const next = this.savedFilters.filter((entry) => entry.id !== id);
		if (next.length === this.savedFilters.length) return;

		this.savedFilters = next;
		this.#persistSavedFilters();

		if (this.activeSavedFilterId !== id) return;

		this.activeSavedFilterId = null;
		this.layoutSource = 'all';
		const incoming = this.#viewFilterSnapshots.get('all');
		if (incoming) {
			this.#restoreViewFilters(incoming);
		} else {
			this.#resetViewFiltersToDefaults();
		}
		this.#saveToUrl();
	}

	toggleIncludeSelectedInResults() {
		if (this.compareSelectedNames.size === 0 || this.layoutSource === 'selected') {
			this.includeSelectedInResults = false;
			this.#saveToUrl();
			return;
		}
		this.includeSelectedInResults = !this.includeSelectedInResults;
		this.#saveToUrl();
	}

	/** Swap the first two compare selections (new ↔ old). */
	swapCompareLayouts() {
		const names = [...this.compareSelectedNames];
		if (names.length < 2) return;
		const [first, second, ...rest] = names;
		this.compareSelectedNames.clear();
		for (const name of [second, first, ...rest]) {
			this.compareSelectedNames.add(name);
		}
		this.#saveToUrl();
	}

	/** Drop compare selections whose layouts are no longer in the catalog. */
	pruneCompareLayouts(existingNames: ReadonlySet<string>) {
		if (this.compareSelectedNames.size === 0) return;
		let removed = false;
		for (const name of [...this.compareSelectedNames]) {
			if (!existingNames.has(name)) {
				this.compareSelectedNames.delete(name);
				removed = true;
			}
		}
		if (this.compareSelectedNames.size === 0 && this.includeSelectedInResults) {
			this.includeSelectedInResults = false;
			removed = true;
		}
		if (removed) this.#saveToUrl();
	}

	clearAll() {
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.includeOrGrid = createEmptyGrid();
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
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.includeOrGrid = createEmptyGrid();
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
			this.#resetSimilarityFilter();
		} else {
			const switchingReference = this.similarReferenceName !== null;
			if (!switchingReference) {
				this.#sortBeforeSimilar = this.#snapshotSort();
				this.#exitSortRestore = this.#sortBeforeSimilar;
				this.#resetSimilarityFilter();
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
		this.#resetSimilarityFilter();
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

	#gridOrThumbsActive(
		grid: string[][],
		leftThumbs: string[],
		rightThumbs: string[]
	): boolean {
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

	#getKeyAt(layout: LayoutData, row: number, col: number): string | undefined {
		return layout.positionBySlot.get(positionSlotKey(row, col));
	}

	#getThumbKeysForHand(layout: LayoutData, hand: 'l' | 'r'): ThumbKeyEntry[] {
		return layout.thumbKeysByHand[hand];
	}

	// Check if thumb keys match positional filter (keys must exist in order)
	#matchesThumbKeyPosition(
		thumbKeys: Array<{ key: string; col: number }>,
		filter: string[]
	): boolean {
		const nonEmptyFilters = filter
			.map((f, idx) => ({ chars: f.toLowerCase(), position: idx }))
			.filter((f) => f.chars !== '');

		if (nonEmptyFilters.length === 0) return true;

		// For each filter position, find matching keys
		const matches: Array<{ key: string; col: number; filterPos: number }> = [];
		for (const filter of nonEmptyFilters) {
			for (const thumbKey of thumbKeys) {
				if (filter.chars.includes(thumbKey.key)) {
					matches.push({ ...thumbKey, filterPos: filter.position });
				}
			}
		}

		// Check if we have all required keys
		if (matches.length < nonEmptyFilters.length) return false;

		// Check if keys are in the correct order (col values must increase with filter position)
		// Group matches by filter position and get the leftmost (min col) for each
		const byFilterPos: Record<number, number[]> = {};
		for (const match of matches) {
			if (!byFilterPos[match.filterPos]) byFilterPos[match.filterPos] = [];
			byFilterPos[match.filterPos].push(match.col);
		}

		// For each filter position, we need at least one key
		for (const filter of nonEmptyFilters) {
			if (!byFilterPos[filter.position] || byFilterPos[filter.position].length === 0) {
				return false;
			}
		}

		// Check ordering: for each pair of consecutive filters, need at least one key from earlier position
		// with col < at least one key from later position
		for (let i = 0; i < nonEmptyFilters.length - 1; i++) {
			const currPos = nonEmptyFilters[i].position;
			const nextPos = nonEmptyFilters[i + 1].position;
			const currCols = byFilterPos[currPos];
			const nextCols = byFilterPos[nextPos];
			// Need at least one curr col < at least one next col
			const currMinCol = Math.min(...currCols);
			const nextMaxCol = Math.max(...nextCols);
			if (currMinCol >= nextMaxCol) return false;
		}

		return true;
	}

	// Check if layout matches include filter (key must be one of the specified chars)
	#matchesInclude(layout: LayoutData): boolean {
		// Check rows 0-2 (position-specific)
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChars = this.appliedIncludeGrid[row][col].toLowerCase();
				if (filterChars) {
					const keyAtPos = this.#getKeyAt(layout, row, col)?.toLowerCase();
					// Key must match one of the filter characters
					if (!keyAtPos || !filterChars.includes(keyAtPos)) return false;
				}
			}
		}
		// Check thumb keys per hand (row 3) — order within each hand, not column
		if (this.appliedIncludeLeftThumbKeys.some((k) => k !== '')) {
			const thumbKeys = this.#getThumbKeysForHand(layout, 'l');
			if (!this.#matchesThumbKeyPosition(thumbKeys, this.appliedIncludeLeftThumbKeys)) return false;
		}
		if (this.appliedIncludeRightThumbKeys.some((k) => k !== '')) {
			const thumbKeys = this.#getThumbKeysForHand(layout, 'r');
			if (!this.#matchesThumbKeyPosition(thumbKeys, this.appliedIncludeRightThumbKeys)) return false;
		}
		return true;
	}

	// One thumb filter slot: does this hand's Nth thumb key (left-to-right) match chars?
	#matchesThumbKeyAtSlot(
		thumbKeys: ThumbKeyEntry[],
		slotIndex: number,
		chars: string
	): boolean {
		const filter = createEmptyThumbKeyFilters();
		filter[slotIndex] = chars;
		return this.#matchesThumbKeyPosition(thumbKeys, filter);
	}

	// Check if layout matches include OR filter (OR logic - at least one position must match)
	#matchesIncludeOr(layout: LayoutData): boolean {
		const matches: boolean[] = [];

		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChars = this.appliedIncludeOrGrid[row][col].toLowerCase();
				if (!filterChars) continue;
				const keyAtPos = this.#getKeyAt(layout, row, col)?.toLowerCase();
				matches.push(Boolean(keyAtPos && filterChars.includes(keyAtPos)));
			}
		}

		const leftThumbKeys = this.#getThumbKeysForHand(layout, 'l');
		for (let index = 0; index < THUMB_KEYS_PER_HAND; index++) {
			const filterChars = this.appliedIncludeOrLeftThumbKeys[index].toLowerCase();
			if (!filterChars) continue;
			matches.push(this.#matchesThumbKeyAtSlot(leftThumbKeys, index, filterChars));
		}

		const rightThumbKeys = this.#getThumbKeysForHand(layout, 'r');
		for (let index = 0; index < THUMB_KEYS_PER_HAND; index++) {
			const filterChars = this.appliedIncludeOrRightThumbKeys[index].toLowerCase();
			if (!filterChars) continue;
			matches.push(this.#matchesThumbKeyAtSlot(rightThumbKeys, index, filterChars));
		}

		if (matches.length === 0) return true;
		return matches.some(Boolean);
	}

	// Check if layout matches exclude filter (key must NOT be any of the specified chars)
	#matchesExclude(layout: LayoutData): boolean {
		// Check rows 0-2 (position-specific)
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChars = this.appliedExcludeGrid[row][col].toLowerCase();
				if (filterChars) {
					const keyAtPos = this.#getKeyAt(layout, row, col)?.toLowerCase();
					// If key matches any of the filter characters, exclude it
					if (keyAtPos && filterChars.includes(keyAtPos)) return false;
				}
			}
		}
		// Check thumb keys per hand — if matches positional filter, exclude
		if (this.appliedExcludeLeftThumbKeys.some((k) => k !== '')) {
			const thumbKeys = this.#getThumbKeysForHand(layout, 'l');
			if (this.#matchesThumbKeyPosition(thumbKeys, this.appliedExcludeLeftThumbKeys)) return false;
		}
		if (this.appliedExcludeRightThumbKeys.some((k) => k !== '')) {
			const thumbKeys = this.#getThumbKeysForHand(layout, 'r');
			if (this.#matchesThumbKeyPosition(thumbKeys, this.appliedExcludeRightThumbKeys)) return false;
		}
		return true;
	}

	// Check if layout name matches filter
	#matchesName(layout: LayoutData): boolean {
		if (!this.nameFilter) return true;
		const terms = this.nameFilter
			.split(',')
			.map((term) => term.trim().toLowerCase())
			.filter((term) => term !== '');
		if (terms.length === 0) return true;
		const name = layout.name.toLowerCase();
		return terms.some((term) => name.includes(term));
	}

	/** Lower rank = better match when a name filter is active. */
	#getNameSearchRank(layout: LayoutData): number {
		if (!this.nameFilter) return 0;
		const terms = this.nameFilter
			.split(',')
			.map((term) => term.trim().toLowerCase())
			.filter((term) => term !== '');
		if (terms.length === 0) return 0;

		const name = layout.name.toLowerCase();
		let best = 2;
		for (const term of terms) {
			if (!name.includes(term)) continue;
			if (name === term) return 0;
			if (name.startsWith(term)) best = Math.min(best, 1);
		}
		return best;
	}

	#compareNameSearchRank(a: LayoutData, b: LayoutData): number {
		if (!this.nameFilter) return 0;
		return this.#getNameSearchRank(a) - this.#getNameSearchRank(b);
	}

	// Check if layout author matches filter
	#matchesAuthor(layout: LayoutData): boolean {
		if (this.selectedAuthors.size === 0) return true;
		return this.selectedAuthors.has(layout.user);
	}

	// Check if layout matches thumb key filter
	#matchesMagicKeyFilter(layout: LayoutData): boolean {
		if (this.magicKeyFilter === 'optional') return true;
		if (this.magicKeyFilter === 'excluded') return !layout.hasMagicKey;
		if (this.magicKeyFilter === 'required') return layout.hasMagicKey;
		return true;
	}

	#matchesThumbKeyFilter(layout: LayoutData): boolean {
		if (this.thumbKeyFilter === 'optional') return true;
		return this.thumbKeyFilter === 'required' ? layout.hasThumbKeys : !layout.hasThumbKeys;
	}

	// Check if layout matches character set filter
	#matchesCharacterSet(layout: LayoutData): boolean {
		if (this.characterSetFilter === 'all') return true;
		return layout.characterSet === this.characterSetFilter;
	}

	// Check if layout matches board type filter
	#matchesBoardType(layout: LayoutData): boolean {
		if (this.boardTypeFilter === 'all') return true;
		if (this.boardTypeFilter === 'angle-stagger') {
			return layout.board === 'angle' || layout.board === 'stagger';
		}
		return layout.board === this.boardTypeFilter;
	}

	/**
	 * Active (non-empty) applied stat limits, grouped by analyzer.
	 * Built once per filterLayouts pass so the per-layout path only derives/compares.
	 */
	#buildActiveAnalyzerStatFilters(
		limits: Record<StatLimitKey, StatLimit>
	): ActiveAnalyzerStatFilters[] {
		const active: ActiveAnalyzerStatFilters[] = [];

		for (const analyzer of STAT_ANALYZERS.map((entry) => entry.value)) {
			const checks: ActiveAnalyzerStatFilters['checks'] = [];
			for (const field of getStatFilterFieldsForAnalyzer(analyzer)) {
				const limit = limits[field.key];
				const threshold = parseStatFilterThreshold(field, limit.value);
				if (threshold === null) continue;
				checks.push({
					operator: limit.operator,
					threshold,
					statKey: getStatFilterStatKey(field)
				});
			}
			if (checks.length > 0) active.push({ analyzer, checks });
		}

		return active;
	}

	#matchesStatLimits(
		layout: LayoutData,
		statsMaps: StatsMaps,
		likesData: LayoutLikesMap,
		activeFilters: ActiveAnalyzerStatFilters[],
		likesCheck: LikesLimitCheck | null
	): boolean {
		if (activeFilters.length === 0 && !likesCheck) return true;

		for (const { analyzer, checks } of activeFilters) {
			const analyzerStats = getLayoutAnalyzerStats(
				statsMaps,
				layout.name,
				analyzer,
				layout.cyanophageCompatible
			);
			if (!analyzerStats) return false;

			const stats =
				analyzer === CYANOPHAGE_ANALYZER
					? deriveCyanophageStats(analyzerStats as CyanophageStats)
					: analyzer === MANA2_ANALYZER
						? deriveMana2Stats(analyzerStats as Mana2Stats)
						: deriveBotStats(analyzerStats as MonkeyracerStats);

			for (const { operator, threshold, statKey } of checks) {
				const value = stats[statKey as keyof typeof stats];
				if (operator === 'lt' && value >= threshold) return false;
				if (operator === 'gt' && value <= threshold) return false;
			}
		}

		if (likesCheck) {
			const value = likesData[layout.name] ?? 0;
			if (likesCheck.operator === 'lt' && value >= likesCheck.threshold) return false;
			if (likesCheck.operator === 'gt' && value <= likesCheck.threshold) return false;
		}

		return true;
	}

	/** True when applied stat limits need analyzer maps that are not ready yet. */
	statFiltersAwaitingStats(statsMaps: StatsMaps, statsReady: boolean): boolean {
		const needed = this.analyzersNeededForStatLimits;
		if (needed.length === 0) return false;
		return (
			!statsReady || !needed.every((analyzer) => isAnalyzerStatsReady(statsMaps, analyzer))
		);
	}

	// Filter layouts based on all criteria
	filterLayouts(
		layouts: LayoutData[],
		statsMaps: StatsMaps = {},
		statsReady = false,
		likesData: LayoutLikesMap = {}
	): LayoutData[] {
		const activeFilters = this.#buildActiveAnalyzerStatFilters(this.appliedStatLimits);
		let likesCheck: LikesLimitCheck | null = null;
		if (this.canUseLikes) {
			const threshold = Number.parseFloat(this.appliedStatLimits.likes.value.trim());
			if (Number.isFinite(threshold)) {
				likesCheck = {
					operator: this.appliedStatLimits.likes.operator,
					threshold
				};
			}
		}

		// Hold results until needed stats maps are loaded (avoid flashing the full list).
		if (
			activeFilters.length > 0 &&
			(!statsReady ||
				!activeFilters.every(({ analyzer }) => isAnalyzerStatsReady(statsMaps, analyzer)))
		) {
			return [];
		}

		return layouts.filter((l) => {
			// Source pool: when "Selected layouts only", other filters apply within selection.
			if (this.layoutSource === 'selected' && !this.compareSelectedNames.has(l.name)) {
				return false;
			}

			// Cheap boolean / enum filters first
			if (
				!this.showUnfinished &&
				this.characterSetFilter !== 'international' &&
				!l.hasAllLetters &&
				!l.hasMagicKey
			)
				return false;
			if (!this.#matchesThumbKeyFilter(l)) return false;
			if (!this.#matchesMagicKeyFilter(l)) return false;
			if (!this.#matchesCharacterSet(l)) return false;
			if (!this.#matchesBoardType(l)) return false;
			if (!this.#matchesName(l)) return false;
			if (!this.#matchesAuthor(l)) return false;
			if (!this.#matchesInclude(l)) return false;
			if (!this.#matchesExclude(l)) return false;
			if (!this.#matchesIncludeOr(l)) return false;
			// Stat derivation last — only for layouts that already passed cheaper filters
			return this.#matchesStatLimits(l, statsMaps, likesData, activeFilters, likesCheck);
		});
	}

	sortLayouts(
		layouts: LayoutData[],
		statsMaps: StatsMaps = {},
		likesData: LayoutLikesMap = {}
	): LayoutData[] {
		const sorted = [...layouts];
		const descending = this.sortOrder === 'desc';
		const statSort = isStatSortBy(this.sortBy) ? getStatSortField(this.sortBy) : undefined;

		if (statSort) {
			const values = new Map<string, number | null>();
			for (const layout of sorted) {
				values.set(layout.name, getStatSortValue(statsMaps, layout, this.sortBy));
			}

			return sorted.sort((a, b) => {
				const aValue = values.get(a.name) ?? null;
				const bValue = values.get(b.name) ?? null;

				if (aValue === null && bValue === null) {
					return a.name.localeCompare(b.name);
				}
				if (aValue === null) return 1;
				if (bValue === null) return -1;

				const diff = descending ? bValue - aValue : aValue - bValue;
				return diff !== 0 ? diff : a.name.localeCompare(b.name);
			});
		}

		if (this.sortBy === 'date') {
			return sorted.sort((a, b) => {
				const byRank = this.#compareNameSearchRank(a, b);
				if (byRank !== 0) return byRank;

				const byDate = a.updatedAt.localeCompare(b.updatedAt);
				const diff = descending ? -byDate : byDate;
				return diff !== 0 ? diff : a.name.localeCompare(b.name);
			});
		}

		if (this.sortBy === 'likes') {
			return sorted.sort((a, b) => {
				const byRank = this.#compareNameSearchRank(a, b);
				if (byRank !== 0) return byRank;

				const aLikes = likesData[a.name] ?? 0;
				const bLikes = likesData[b.name] ?? 0;
				const diff = descending ? bLikes - aLikes : aLikes - bLikes;
				return diff !== 0 ? diff : a.name.localeCompare(b.name);
			});
		}

		return sorted.sort((a, b) => {
			const byRank = this.#compareNameSearchRank(a, b);
			if (byRank !== 0) return byRank;

			const byName = a.name.localeCompare(b.name);
			return descending ? -byName : byName;
		});
	}
}

export const filterStore = new FilterStore();
