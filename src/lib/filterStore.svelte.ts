import { SvelteSet, SvelteURL } from 'svelte/reactivity';
import {
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	deriveBotStats,
	deriveCyanophageStats,
	getLayoutAnalyzerStats,
	getStatFilterFieldsForAnalyzer,
	getStatSortField,
	getStatSortValue,
	isSortBy,
	isSortOrder,
	isStatSortBy,
	isStatSortByForAnalyzer,
	isStatsAnalyzer,
	parseLegacySortParam,
	parseStatFilterThreshold,
	ALL_STAT_FILTER_FIELDS,
	type SortBy,
	type SortOrder,
	type StatLimitKey,
	type StatsAnalyzer
} from './layoutStats';
import type {
	CyanophageStats,
	MonkeyracerStats,
	LayoutData,
	LayoutLikesMap,
	StatsMaps,
	ThumbKeyEntry
} from './layout';
import { positionSlotKey } from './layoutCodec';

export type ThumbKeyFilter = 'optional' | 'excluded' | 'required';
export type MagicKeyFilter = 'optional' | 'excluded' | 'required';
export type CharacterSetFilter = 'all' | 'english' | 'international';
export type BoardTypeFilter = 'all' | 'angle' | 'stagger' | 'ortho' | 'mini';
export type StatLimitOperator = 'lt' | 'gt';
export type { SortBy, SortOrder };

export interface StatLimit {
	operator: StatLimitOperator;
	value: string;
}

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
	focusLayoutName: string | null = $state(null);
	scrollToSelectedLayout = $state(false);
	similarReferenceName: string | null = $state(null);
	similarityFilterOperator: StatLimitOperator = $state('gt');
	similarityFilterValue: string = $state('50');
	/** When true, only compare layouts with the same board type. Default: any board. */
	similaritySameBoardOnly: boolean = $state(false);
	sortBy: SortBy = $state('date');
	sortOrder: SortOrder = $state('desc');
	statsAnalyzer: StatsAnalyzer = $state(DEFAULT_STATS_ANALYZER);
	hideLayoutStats: boolean = $state(false);
	hideLayoutTestArea: boolean = $state(false);
	hideLayoutLikes: boolean = $state(false);
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

	get showLayoutStats(): boolean {
		return !this.hideLayoutStats;
	}

	get showLayoutTestArea(): boolean {
		return !this.hideLayoutTestArea;
	}

	get showLayoutLikes(): boolean {
		return !this.hideLayoutLikes;
	}

	get canUseLikes(): boolean {
		return this.showLayoutLikes && this.likesDataAvailable;
	}

	#debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	#nameDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
	#filterApplyTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		this.#loadFromUrl();
		this.#applyFiltersFromInputs();
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
	}

	#scheduleFilterApply() {
		if (this.#filterApplyTimeout) {
			clearTimeout(this.#filterApplyTimeout);
		}
		this.#filterApplyTimeout = setTimeout(() => {
			this.#applyFiltersFromInputs();
			this.#saveToUrl();
			this.#filterApplyTimeout = null;
		}, DEBOUNCE_MS);
	}

	#cancelFilterApply() {
		if (this.#filterApplyTimeout) {
			clearTimeout(this.#filterApplyTimeout);
			this.#filterApplyTimeout = null;
		}
	}

	#applyFiltersNow() {
		this.#cancelFilterApply();
		this.#applyFiltersFromInputs();
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
			this.selectedAuthors = new SvelteSet(authors.split(',').map(Number));
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

		const sort = url.searchParams.get('sort');
		const order = url.searchParams.get('order');

		if (sort) {
			const legacy = parseLegacySortParam(sort);
			if (legacy) {
				this.sortBy = legacy.sortBy;
				if (!order) {
					this.sortOrder = legacy.sortOrder;
				}
			} else if (isSortBy(sort)) {
				this.sortBy = sort;
			}
		}

		if (order && isSortOrder(order)) {
			this.sortOrder = order;
		}

		const analyzer = url.searchParams.get('analyzer');
		if (analyzer && isStatsAnalyzer(analyzer)) {
			this.statsAnalyzer = analyzer;
		}

		if (url.searchParams.get('stats') === '0') {
			this.hideLayoutStats = true;
		}

		if (url.searchParams.get('testArea') === '0') {
			this.hideLayoutTestArea = true;
		}

		const similar = url.searchParams.get('similar');
		if (similar) {
			this.similarReferenceName = similar;
			// Match click behavior: default to Similarity when no explicit sort is in the URL
			if (!sort) {
				this.sortBy = 'similarity';
				if (!order) this.sortOrder = 'desc';
			}
		}

		const similarFilter = url.searchParams.get('similarFilter');
		if (similarFilter) {
			const [operator, ...valueParts] = similarFilter.split(':');
			if ((operator === 'lt' || operator === 'gt') && valueParts.length > 0) {
				this.similarityFilterOperator = operator;
				this.similarityFilterValue = valueParts.join(':');
			}
		}

		const similarBoard = url.searchParams.get('similarBoard');
		if (similarBoard === 'same') {
			this.similaritySameBoardOnly = true;
		} else if (similarBoard === 'any') {
			this.similaritySameBoardOnly = false;
		}

		const statLimits = url.searchParams.get('statLimits');
		if (statLimits) {
			this.statLimits = deserializeStatLimits(statLimits);
			if (this.hideLayoutLikes) {
				this.statLimits.likes = { operator: 'lt', value: '' };
			}
		}
	}

	#saveToUrl() {
		const url = new SvelteURL(window.location.href);
		url.search = '';

		const includeSerialized = serializeGrid(this.includeGrid);
		if (includeSerialized) {
			url.searchParams.set('include', includeSerialized);
		}

		const excludeSerialized = serializeGrid(this.excludeGrid);
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

		const serializeThumbFilters = (filters: string[]) => filters.filter((k) => k !== '').join('|');

		const includeLeftThumbsSerialized = serializeThumbFilters(this.includeLeftThumbKeys);
		if (includeLeftThumbsSerialized) {
			url.searchParams.set('includeLeftThumbs', includeLeftThumbsSerialized);
		}

		const includeRightThumbsSerialized = serializeThumbFilters(this.includeRightThumbKeys);
		if (includeRightThumbsSerialized) {
			url.searchParams.set('includeRightThumbs', includeRightThumbsSerialized);
		}

		const excludeLeftThumbsSerialized = serializeThumbFilters(this.excludeLeftThumbKeys);
		if (excludeLeftThumbsSerialized) {
			url.searchParams.set('excludeLeftThumbs', excludeLeftThumbsSerialized);
		}

		const excludeRightThumbsSerialized = serializeThumbFilters(this.excludeRightThumbKeys);
		if (excludeRightThumbsSerialized) {
			url.searchParams.set('excludeRightThumbs', excludeRightThumbsSerialized);
		}

		const includeOrSerialized = serializeGrid(this.includeOrGrid);
		if (includeOrSerialized) {
			url.searchParams.set('includeOr', includeOrSerialized);
		}

		const includeOrLeftThumbsSerialized = serializeThumbFilters(this.includeOrLeftThumbKeys);
		if (includeOrLeftThumbsSerialized) {
			url.searchParams.set('includeOrLeftThumbs', includeOrLeftThumbsSerialized);
		}

		const includeOrRightThumbsSerialized = serializeThumbFilters(this.includeOrRightThumbKeys);
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

		if (this.similarReferenceName) {
			url.searchParams.set('similar', this.similarReferenceName);
			const filterValue = this.similarityFilterValue.trim();
			if (
				filterValue &&
				(this.similarityFilterOperator !== 'gt' || filterValue !== '50')
			) {
				url.searchParams.set(
					'similarFilter',
					`${this.similarityFilterOperator}:${filterValue}`
				);
			}
			if (this.similaritySameBoardOnly) {
				url.searchParams.set('similarBoard', 'same');
			}
		}

		const statLimitsSerialized = serializeStatLimits(this.statLimits);
		if (statLimitsSerialized) {
			url.searchParams.set('statLimits', statLimitsSerialized);
		}

		window.history.replaceState({}, '', url.toString());
	}

	#debouncedSave() {
		if (this.#debounceTimeout) {
			clearTimeout(this.#debounceTimeout);
		}
		this.#debounceTimeout = setTimeout(() => {
			this.#saveToUrl();
		}, DEBOUNCE_MS);
	}

	setIncludeCell(row: number, col: number, value: string) {
		this.includeGrid[row][col] = value;
		this.#scheduleFilterApply();
	}

	setExcludeCell(row: number, col: number, value: string) {
		this.excludeGrid[row][col] = value;
		this.#scheduleFilterApply();
	}

	setIncludeLeftThumbKey(index: number, value: string) {
		this.includeLeftThumbKeys[index] = value;
		this.#scheduleFilterApply();
	}

	setIncludeRightThumbKey(index: number, value: string) {
		this.includeRightThumbKeys[index] = value;
		this.#scheduleFilterApply();
	}

	setExcludeLeftThumbKey(index: number, value: string) {
		this.excludeLeftThumbKeys[index] = value;
		this.#scheduleFilterApply();
	}

	setExcludeRightThumbKey(index: number, value: string) {
		this.excludeRightThumbKeys[index] = value;
		this.#scheduleFilterApply();
	}

	setIncludeOrLeftThumbKey(index: number, value: string) {
		this.includeOrLeftThumbKeys[index] = value;
		this.#scheduleFilterApply();
	}

	setIncludeOrRightThumbKey(index: number, value: string) {
		this.includeOrRightThumbKeys[index] = value;
		this.#scheduleFilterApply();
	}

	setIncludeOrCell(row: number, col: number, value: string) {
		this.includeOrGrid[row][col] = value;
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

	setSortBy(value: SortBy) {
		this.sortBy = value;
		this.#saveToUrl();
	}

	setSortOrder(value: SortOrder) {
		this.sortOrder = value;
		this.#saveToUrl();
	}

	setStatsAnalyzer(value: StatsAnalyzer) {
		this.statsAnalyzer = value;
		if (isStatSortBy(this.sortBy) && !isStatSortByForAnalyzer(this.sortBy, value)) {
			this.sortBy = 'date';
			this.sortOrder = 'desc';
		}
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
			this.sortBy = 'date';
			this.sortOrder = 'desc';
		}
		if (value) {
			this.statLimits.likes = { operator: 'lt', value: '' };
			this.#applyFiltersNow();
		}
		this.#saveToUrl();
	}

	setLikesDataAvailable(value: boolean) {
		this.likesDataAvailable = value;
		if (!this.canUseLikes) {
			if (this.sortBy === 'likes') {
				this.sortBy = 'date';
				this.sortOrder = 'desc';
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

	setSimilarityFilterOperator(operator: StatLimitOperator) {
		this.similarityFilterOperator = operator;
		this.#saveToUrl();
	}

	setSimilarityFilterValue(value: string) {
		this.similarityFilterValue = value;
		this.#saveToUrl();
	}

	setSimilaritySameBoardOnly(value: boolean) {
		this.similaritySameBoardOnly = value;
		this.#saveToUrl();
	}

	#resetSimilarityFilter() {
		this.similarityFilterOperator = 'gt';
		this.similarityFilterValue = '50';
		this.similaritySameBoardOnly = false;
	}

	setNameFilter(value: string) {
		this.nameFilterInput = value;
		// Debounce the actual filter update
		if (this.#nameDebounceTimeout) {
			clearTimeout(this.#nameDebounceTimeout);
		}
		this.#nameDebounceTimeout = setTimeout(() => {
			this.nameFilter = value;
			this.#saveToUrl(); // Sync URL immediately after filter updates
		}, DEBOUNCE_MS);
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
		this.similarReferenceName = null;
		if (this.sortBy === 'similarity') {
			this.sortBy = 'date';
			this.sortOrder = 'desc';
		}
		this.#resetSimilarityFilter();
		this.statLimits = createEmptyStatLimits();
		this.statsAnalyzer = DEFAULT_STATS_ANALYZER;
		if (this.#nameDebounceTimeout) {
			clearTimeout(this.#nameDebounceTimeout);
		}
		this.#applyFiltersNow();
		this.#debouncedSave();
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
		this.nameFilter = name;
		if (this.#nameDebounceTimeout) {
			clearTimeout(this.#nameDebounceTimeout);
			this.#nameDebounceTimeout = null;
		}
		this.#applyFiltersNow();
		this.focusLayoutName = name;
		this.#saveToUrl();
	}

	clearFocusLayout() {
		this.focusLayoutName = null;
	}

	toggleSimilarReference(name: string) {
		if (this.similarReferenceName === name) {
			this.similarReferenceName = null;
			if (this.sortBy === 'similarity') {
				this.sortBy = 'date';
				this.sortOrder = 'desc';
			}
			this.#resetSimilarityFilter();
		} else {
			this.similarReferenceName = name;
			this.sortBy = 'similarity';
			this.sortOrder = 'desc';
			this.#resetSimilarityFilter();
			this.scrollToSelectedLayout = true;
			// Reset scroll before virtua applies length-change jumps from a deep offset.
			window.scrollTo(0, 0);
		}
		this.#saveToUrl();
	}

	clearScrollToSelectedLayout() {
		this.scrollToSelectedLayout = false;
	}

	clearSimilarReference() {
		this.similarReferenceName = null;
		if (this.sortBy === 'similarity') {
			this.sortBy = 'date';
			this.sortOrder = 'desc';
		}
		this.#resetSimilarityFilter();
		this.#saveToUrl();
	}

	get hasSimilarReference(): boolean {
		return this.similarReferenceName !== null;
	}

	get hasActiveStatLimits(): boolean {
		const fields = getStatFilterFieldsForAnalyzer(this.statsAnalyzer);
		const availableFields = this.canUseLikes
			? [...fields, { key: 'likes' as const }]
			: fields;
		return availableFields.some(
			(field) => this.statLimits[field.key].value.trim() !== ''
		);
	}

	/** Applied (debounced) stat limits — used by page load / filter pipeline. */
	get hasAppliedStatLimits(): boolean {
		const fields = getStatFilterFieldsForAnalyzer(this.statsAnalyzer);
		const availableFields = this.canUseLikes
			? [...fields, { key: 'likes' as const }]
			: fields;
		return availableFields.some(
			(field) => this.appliedStatLimits[field.key].value.trim() !== ''
		);
	}

	get hasActiveFilters(): boolean {
		const hasInclude = this.includeGrid.some((row) => row.some((cell) => cell !== ''));
		const hasExclude = this.excludeGrid.some((row) => row.some((cell) => cell !== ''));
		const hasIncludeOr =
			this.includeOrGrid.some((row) => row.some((cell) => cell !== '')) ||
			this.includeOrLeftThumbKeys.some((k) => k !== '') ||
			this.includeOrRightThumbKeys.some((k) => k !== '');
		const hasIncludeThumbs =
			this.includeLeftThumbKeys.some((k) => k !== '') ||
			this.includeRightThumbKeys.some((k) => k !== '');
		const hasExcludeThumbs =
			this.excludeLeftThumbKeys.some((k) => k !== '') ||
			this.excludeRightThumbKeys.some((k) => k !== '');
		return (
			hasInclude ||
			hasExclude ||
			hasIncludeOr ||
			hasIncludeThumbs ||
			hasExcludeThumbs ||
			this.showUnfinished ||
			this.thumbKeyFilter !== 'optional' ||
			this.magicKeyFilter !== 'optional' ||
			this.characterSetFilter !== 'english' ||
			this.boardTypeFilter !== 'all' ||
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
		return layout.board === this.boardTypeFilter;
	}

	#matchesStatLimits(
		layout: LayoutData,
		statsMaps: StatsMaps,
		statsReady: boolean,
		likesData: LayoutLikesMap = {}
	): boolean {
		const fields = getStatFilterFieldsForAnalyzer(this.statsAnalyzer);
		const hasStatsLimits = fields.some(
			(field) => this.appliedStatLimits[field.key].value.trim() !== ''
		);
		const hasLikesLimit =
			this.canUseLikes && this.appliedStatLimits.likes.value.trim() !== '';
		if (!hasStatsLimits && !hasLikesLimit) return true;
		if (hasStatsLimits && !statsReady) return true;

		const analyzerStats = getLayoutAnalyzerStats(
			statsMaps,
			layout.name,
			this.statsAnalyzer,
			layout.cyanophageCompatible
		);
		if (!analyzerStats) return false;

		const stats =
			this.statsAnalyzer === CYANOPHAGE_ANALYZER
				? deriveCyanophageStats(analyzerStats as CyanophageStats)
				: deriveBotStats(analyzerStats as MonkeyracerStats);

		for (const field of fields) {
			const limit = this.appliedStatLimits[field.key];
			const threshold = parseStatFilterThreshold(field, limit.value);
			if (threshold === null) continue;

			const value = stats[field.key as keyof typeof stats];
			if (limit.operator === 'lt' && value >= threshold) return false;
			if (limit.operator === 'gt' && value <= threshold) return false;
		}

		if (hasLikesLimit) {
			const threshold = Number.parseFloat(this.appliedStatLimits.likes.value.trim());
			if (Number.isFinite(threshold)) {
				const value = likesData[layout.name] ?? 0;
				if (this.appliedStatLimits.likes.operator === 'lt' && value >= threshold) return false;
				if (this.appliedStatLimits.likes.operator === 'gt' && value <= threshold) return false;
			}
		}

		return true;
	}

	// Filter layouts based on all criteria
	filterLayouts(
		layouts: LayoutData[],
		statsMaps: StatsMaps = {},
		statsReady = false,
		likesData: LayoutLikesMap = {}
	): LayoutData[] {
		return layouts.filter((l) => {
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
			return this.#matchesStatLimits(l, statsMaps, statsReady, likesData);
		});
	}

	sortLayouts(
		layouts: LayoutData[],
		statsMaps: StatsMaps = {},
		likesData: LayoutLikesMap = {}
	): LayoutData[] {
		const sorted = [...layouts];
		const descending = this.sortOrder === 'desc';
		const statSort = isStatSortBy(this.sortBy)
			? getStatSortField(this.sortBy, this.statsAnalyzer)
			: undefined;

		if (statSort) {
			return sorted.sort((a, b) => {
				const aValue = getStatSortValue(statsMaps, a, this.sortBy, this.statsAnalyzer);
				const bValue = getStatSortValue(statsMaps, b, this.sortBy, this.statsAnalyzer);

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
