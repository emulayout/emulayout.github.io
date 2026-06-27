import { SvelteSet, SvelteURL } from 'svelte/reactivity';
import {
	deriveBotStats,
	getLayoutCorpusStats,
	getStatSortField,
	isSortBy,
	isSortOrder,
	isStatSortBy,
	isStatsCorpus,
	parseLegacySortParam,
	STAT_FILTER_FIELDS,
	DEFAULT_STATS_CORPUS,
	type SortBy,
	type SortOrder,
	type StatSortKey,
	type StatsCorpus
} from './layoutStats';
import type { LayoutData, LayoutStatsMap } from './layout';

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

function createEmptyStatLimits(): Record<StatSortKey, StatLimit> {
	const limits = {} as Record<StatSortKey, StatLimit>;
	for (const field of STAT_FILTER_FIELDS) {
		limits[field.key] = { operator: 'lt', value: '' };
	}
	return limits;
}

function serializeStatLimits(limits: Record<StatSortKey, StatLimit>): string {
	const parts: string[] = [];
	for (const field of STAT_FILTER_FIELDS) {
		const limit = limits[field.key];
		const value = limit.value.trim();
		if (!value) continue;
		parts.push(`${field.key}:${limit.operator}:${value}`);
	}
	return parts.join(',');
}

function deserializeStatLimits(str: string): Record<StatSortKey, StatLimit> {
	const limits = createEmptyStatLimits();
	if (!str) return limits;

	for (const part of str.split(',')) {
		const [key, operator, ...valueParts] = part.split(':');
		if (!key || !operator || valueParts.length === 0) continue;
		if (!(key in limits)) continue;
		if (operator !== 'lt' && operator !== 'gt') continue;
		limits[key as StatSortKey] = {
			operator,
			value: valueParts.join(':')
		};
	}
	return limits;
}

function parseStatLimitPercent(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed)) return null;
	return parsed / 100;
}

const ROWS = 3;
const COLS = 10;
const DEBOUNCE_MS = 300;

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
	includeThumbKeys: string[] = $state(['', '', '', '']); // 4 thumb key position filters
	excludeThumbKeys: string[] = $state(['', '', '', '']); // 4 thumb key position filters
	showUnfinished: boolean = $state(false);
	thumbKeyFilter: ThumbKeyFilter = $state('optional');
	magicKeyFilter: MagicKeyFilter = $state('optional');
	characterSetFilter: CharacterSetFilter = $state('english');
	boardTypeFilter: BoardTypeFilter = $state('all');
	nameFilterInput: string = $state(''); // Immediate input value
	nameFilter: string = $state(''); // Debounced filter value
	selectedAuthors: SvelteSet<number> = new SvelteSet(); // Set of author user IDs
	focusLayoutName: string | null = $state(null);
	similarReferenceName: string | null = $state(null);
	sortBy: SortBy = $state('date');
	sortOrder: SortOrder = $state('desc');
	statsCorpus: StatsCorpus = $state(DEFAULT_STATS_CORPUS);
	hideLayoutStats: boolean = $state(false);
	hideLayoutTestArea: boolean = $state(false);
	statLimits: Record<StatSortKey, StatLimit> = $state(createEmptyStatLimits());

	get showLayoutStats(): boolean {
		return !this.hideLayoutStats;
	}

	get showLayoutTestArea(): boolean {
		return !this.hideLayoutTestArea;
	}

	#debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	#nameDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		this.#loadFromUrl();
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
				this.includeThumbKeys = ['', '', '', ''];
				this.excludeThumbKeys = ['', '', '', ''];
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

		const includeThumbs = url.searchParams.get('includeThumbs');
		if (includeThumbs) {
			const parsed = includeThumbs.split('|');
			this.includeThumbKeys = [...parsed, '', '', '', ''].slice(0, 4);
		}

		const excludeThumbs = url.searchParams.get('excludeThumbs');
		if (excludeThumbs) {
			const parsed = excludeThumbs.split('|');
			this.excludeThumbKeys = [...parsed, '', '', '', ''].slice(0, 4);
		}

		const includeOr = url.searchParams.get('includeOr');
		if (includeOr) {
			this.includeOrGrid = deserializeGrid(includeOr);
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

		const corpus = url.searchParams.get('corpus');
		if (corpus && isStatsCorpus(corpus)) {
			this.statsCorpus = corpus;
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
		}

		const statLimits = url.searchParams.get('statLimits');
		if (statLimits) {
			this.statLimits = deserializeStatLimits(statLimits);
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

		const includeThumbsSerialized = this.includeThumbKeys.filter((k) => k !== '').join('|');
		if (includeThumbsSerialized) {
			url.searchParams.set('includeThumbs', includeThumbsSerialized);
		}

		const excludeThumbsSerialized = this.excludeThumbKeys.filter((k) => k !== '').join('|');
		if (excludeThumbsSerialized) {
			url.searchParams.set('excludeThumbs', excludeThumbsSerialized);
		}

		const includeOrSerialized = serializeGrid(this.includeOrGrid);
		if (includeOrSerialized) {
			url.searchParams.set('includeOr', includeOrSerialized);
		}

		if (this.sortBy !== 'date' || this.sortOrder !== 'desc') {
			url.searchParams.set('sort', this.sortBy);
			url.searchParams.set('order', this.sortOrder);
		}

		if (this.statsCorpus !== DEFAULT_STATS_CORPUS) {
			url.searchParams.set('corpus', this.statsCorpus);
		}

		if (this.hideLayoutStats) {
			url.searchParams.set('stats', '0');
		}

		if (this.hideLayoutTestArea) {
			url.searchParams.set('testArea', '0');
		}

		if (this.similarReferenceName) {
			url.searchParams.set('similar', this.similarReferenceName);
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
		this.#debouncedSave();
	}

	setExcludeCell(row: number, col: number, value: string) {
		this.excludeGrid[row][col] = value;
		this.#debouncedSave();
	}

	setIncludeThumbKey(index: number, value: string) {
		this.includeThumbKeys[index] = value;
		this.#debouncedSave();
	}

	setExcludeThumbKey(index: number, value: string) {
		this.excludeThumbKeys[index] = value;
		this.#debouncedSave();
	}

	setIncludeOrCell(row: number, col: number, value: string) {
		this.includeOrGrid[row][col] = value;
		this.#debouncedSave();
	}

	setShowUnfinished(value: boolean) {
		this.showUnfinished = value;
		this.#debouncedSave();
	}

	setThumbKeyFilter(value: ThumbKeyFilter) {
		this.thumbKeyFilter = value;
		// Clear thumb key filters when set to excluded
		if (value === 'excluded') {
			this.includeThumbKeys = ['', '', '', ''];
			this.excludeThumbKeys = ['', '', '', ''];
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

	setStatsCorpus(value: StatsCorpus) {
		this.statsCorpus = value;
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

	setStatLimitOperator(key: StatSortKey, operator: StatLimitOperator) {
		this.statLimits[key].operator = operator;
		this.#debouncedSave();
	}

	setStatLimitValue(key: StatSortKey, value: string) {
		this.statLimits[key].value = value;
		this.#debouncedSave();
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
		this.includeThumbKeys = ['', '', '', ''];
		this.#debouncedSave();
	}

	clearIncludeOr() {
		this.includeOrGrid = createEmptyGrid();
		this.#debouncedSave();
	}

	clearExclude() {
		this.excludeGrid = createEmptyGrid();
		this.excludeThumbKeys = ['', '', '', ''];
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
		this.includeThumbKeys = ['', '', '', ''];
		this.excludeThumbKeys = ['', '', '', ''];
		this.showUnfinished = false;
		this.thumbKeyFilter = 'optional';
		this.magicKeyFilter = 'optional';
		this.characterSetFilter = 'english';
		this.boardTypeFilter = 'all';
		this.nameFilterInput = '';
		this.nameFilter = '';
		this.selectedAuthors.clear();
		this.similarReferenceName = null;
		this.statLimits = createEmptyStatLimits();
		this.statsCorpus = DEFAULT_STATS_CORPUS;
		if (this.#nameDebounceTimeout) {
			clearTimeout(this.#nameDebounceTimeout);
		}
		this.#debouncedSave();
	}

	focusLayout(name: string) {
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.includeOrGrid = createEmptyGrid();
		this.includeThumbKeys = ['', '', '', ''];
		this.excludeThumbKeys = ['', '', '', ''];
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
		this.focusLayoutName = name;
		this.#saveToUrl();
	}

	clearFocusLayout() {
		this.focusLayoutName = null;
	}

	toggleSimilarReference(name: string) {
		if (this.similarReferenceName === name) {
			this.similarReferenceName = null;
		} else {
			this.similarReferenceName = name;
			window.scrollTo(0, 0);
		}
		this.#saveToUrl();
	}

	clearSimilarReference() {
		this.similarReferenceName = null;
		this.#saveToUrl();
	}

	get hasSimilarReference(): boolean {
		return this.similarReferenceName !== null;
	}

	get hasActiveStatLimits(): boolean {
		return STAT_FILTER_FIELDS.some((field) => this.statLimits[field.key].value.trim() !== '');
	}

	get hasActiveFilters(): boolean {
		const hasInclude = this.includeGrid.some((row) => row.some((cell) => cell !== ''));
		const hasExclude = this.excludeGrid.some((row) => row.some((cell) => cell !== ''));
		const hasIncludeOr = this.includeOrGrid.some((row) => row.some((cell) => cell !== ''));
		const hasIncludeThumbs = this.includeThumbKeys.some((k) => k !== '');
		const hasExcludeThumbs = this.excludeThumbKeys.some((k) => k !== '');
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

	// Get key at a specific position in a layout
	#getKeyAt(layout: LayoutData, row: number, col: number): string | undefined {
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info.row === row && info.col === col) return key;
		}
		return undefined;
	}

	// Get all keys in row 3 with their column positions, sorted by column
	#getThumbKeysWithCols(layout: LayoutData): Array<{ key: string; col: number }> {
		const thumbKeys: Array<{ key: string; col: number }> = [];
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info.row === ROWS) {
				thumbKeys.push({ key: key.toLowerCase(), col: info.col });
			}
		}
		return thumbKeys.sort((a, b) => a.col - b.col);
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
				const filterChars = this.includeGrid[row][col].toLowerCase();
				if (filterChars) {
					const keyAtPos = this.#getKeyAt(layout, row, col)?.toLowerCase();
					// Key must match one of the filter characters
					if (!keyAtPos || !filterChars.includes(keyAtPos)) return false;
				}
			}
		}
		// Check thumb keys (row 3) - positional ordering
		// Only check if there are non-empty filters
		if (this.includeThumbKeys.some((k) => k !== '')) {
			const thumbKeys = this.#getThumbKeysWithCols(layout);
			if (!this.#matchesThumbKeyPosition(thumbKeys, this.includeThumbKeys)) return false;
		}
		return true;
	}

	// Check if layout matches include OR filter (OR logic - at least one position must match)
	#matchesIncludeOr(layout: LayoutData): boolean {
		// Collect all non-empty filter positions
		const filterPositions: Array<{ row: number; col: number; chars: string }> = [];
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChars = this.includeOrGrid[row][col].toLowerCase();
				if (filterChars) {
					filterPositions.push({ row, col, chars: filterChars });
				}
			}
		}

		// If no filters, return true
		if (filterPositions.length === 0) {
			return true;
		}

		// OR logic: at least one position must match
		for (const { row, col, chars } of filterPositions) {
			const keyAtPos = this.#getKeyAt(layout, row, col)?.toLowerCase();
			if (keyAtPos && chars.includes(keyAtPos)) {
				// At least one position matches
				return true;
			}
		}
		// No positions matched
		return false;
	}

	// Check if layout matches exclude filter (key must NOT be any of the specified chars)
	#matchesExclude(layout: LayoutData): boolean {
		// Check rows 0-2 (position-specific)
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChars = this.excludeGrid[row][col].toLowerCase();
				if (filterChars) {
					const keyAtPos = this.#getKeyAt(layout, row, col)?.toLowerCase();
					// If key matches any of the filter characters, exclude it
					if (keyAtPos && filterChars.includes(keyAtPos)) return false;
				}
			}
		}
		// Check thumb keys (row 3) - if matches positional filter, exclude
		// Only check if there are non-empty filters
		if (this.excludeThumbKeys.some((k) => k !== '')) {
			const thumbKeys = this.#getThumbKeysWithCols(layout);
			if (this.#matchesThumbKeyPosition(thumbKeys, this.excludeThumbKeys)) return false;
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

	#matchesStatLimits(layout: LayoutData, statsMap: LayoutStatsMap, statsReady: boolean): boolean {
		if (!this.hasActiveStatLimits) return true;
		if (!statsReady) return true;

		const corpusStats = getLayoutCorpusStats(statsMap, layout.name, this.statsCorpus);
		if (!corpusStats) return false;

		const stats = deriveBotStats(corpusStats);

		for (const field of STAT_FILTER_FIELDS) {
			const limit = this.statLimits[field.key];
			const threshold = parseStatLimitPercent(limit.value);
			if (threshold === null) continue;

			const value = stats[field.key];
			if (limit.operator === 'lt' && value >= threshold) return false;
			if (limit.operator === 'gt' && value <= threshold) return false;
		}

		return true;
	}

	// Filter layouts based on all criteria
	filterLayouts(
		layouts: LayoutData[],
		statsMap: LayoutStatsMap = {},
		statsReady = false
	): LayoutData[] {
		return layouts.filter((l) => {
			// Only apply hasAllLetters filter if not filtering by international character set
			// A layout is considered "finished" if it has all letters OR has a magic key
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
			if (!this.#matchesStatLimits(l, statsMap, statsReady)) return false;
			return (
				this.#matchesName(l) &&
				this.#matchesAuthor(l) &&
				this.#matchesInclude(l) &&
				this.#matchesExclude(l) &&
				this.#matchesIncludeOr(l)
			);
		});
	}

	sortLayouts(layouts: LayoutData[], statsMap: LayoutStatsMap = {}): LayoutData[] {
		const sorted = [...layouts];
		const descending = this.sortOrder === 'desc';
		const statSort = isStatSortBy(this.sortBy) ? getStatSortField(this.sortBy) : undefined;

		if (statSort) {
			return sorted.sort((a, b) => {
				const aCorpusStats = getLayoutCorpusStats(statsMap, a.name, this.statsCorpus);
				const bCorpusStats = getLayoutCorpusStats(statsMap, b.name, this.statsCorpus);
				const aValue = aCorpusStats ? deriveBotStats(aCorpusStats)[statSort.key] : null;
				const bValue = bCorpusStats ? deriveBotStats(bCorpusStats)[statSort.key] : null;

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

		return sorted.sort((a, b) => {
			const byRank = this.#compareNameSearchRank(a, b);
			if (byRank !== 0) return byRank;

			const byName = a.name.localeCompare(b.name);
			return descending ? -byName : byName;
		});
	}
}

export const filterStore = new FilterStore();
