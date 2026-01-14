import { SvelteSet, SvelteURL } from 'svelte/reactivity';
import type { LayoutData } from './layout';

export type ThumbKeyFilter = 'optional' | 'excluded' | 'required';
export type MagicKeyFilter = 'optional' | 'excluded' | 'required';
export type CharacterSetFilter = 'all' | 'english' | 'international';
export type BoardTypeFilter = 'all' | 'angle' | 'stagger' | 'ortho' | 'mini';

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
		if (this.#nameDebounceTimeout) {
			clearTimeout(this.#nameDebounceTimeout);
		}
		this.#debouncedSave();
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
			this.selectedAuthors.size > 0
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

	// Filter layouts based on all criteria
	filterLayouts(layouts: LayoutData[]): LayoutData[] {
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
			return (
				this.#matchesName(l) &&
				this.#matchesAuthor(l) &&
				this.#matchesInclude(l) &&
				this.#matchesExclude(l) &&
				this.#matchesIncludeOr(l)
			);
		});
	}
}

export const filterStore = new FilterStore();
