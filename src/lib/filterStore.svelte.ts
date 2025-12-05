import { browser } from '$app/environment';
import { SvelteURL } from 'svelte/reactivity';
import type { LayoutData } from './printPretty';

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
	hideEmpty: boolean = $state(true);

	#debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		if (browser) {
			this.#loadFromUrl();
		}
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

		const hideEmpty = url.searchParams.get('hideEmpty');
		if (hideEmpty !== null) {
			this.hideEmpty = hideEmpty !== '0';
		}
	}

	#saveToUrl() {
		if (!browser) return;

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

		if (!this.hideEmpty) {
			url.searchParams.set('hideEmpty', '0');
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

	setHideEmpty(value: boolean) {
		this.hideEmpty = value;
		this.#debouncedSave();
	}

	clearInclude() {
		this.includeGrid = createEmptyGrid();
		this.#debouncedSave();
	}

	clearExclude() {
		this.excludeGrid = createEmptyGrid();
		this.#debouncedSave();
	}

	clearAll() {
		this.includeGrid = createEmptyGrid();
		this.excludeGrid = createEmptyGrid();
		this.hideEmpty = true;
		this.#debouncedSave();
	}

	get hasActiveFilters(): boolean {
		const hasInclude = this.includeGrid.some((row) => row.some((cell) => cell !== ''));
		const hasExclude = this.excludeGrid.some((row) => row.some((cell) => cell !== ''));
		return hasInclude || hasExclude || !this.hideEmpty;
	}

	// Get key at a specific position in a layout
	#getKeyAt(layout: LayoutData, row: number, col: number): string | undefined {
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info.row === row && info.col === col) return key;
		}
		return undefined;
	}

	// Check if layout matches include filter
	#matchesInclude(layout: LayoutData): boolean {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChar = this.includeGrid[row][col].toLowerCase();
				if (filterChar) {
					const keyAtPos = this.#getKeyAt(layout, row, col);
					if (keyAtPos?.toLowerCase() !== filterChar) return false;
				}
			}
		}
		return true;
	}

	// Check if layout matches exclude filter
	#matchesExclude(layout: LayoutData): boolean {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChar = this.excludeGrid[row][col].toLowerCase();
				if (filterChar) {
					const keyAtPos = this.#getKeyAt(layout, row, col);
					if (keyAtPos?.toLowerCase() === filterChar) return false;
				}
			}
		}
		return true;
	}

	// Filter layouts based on all criteria
	filterLayouts(layouts: LayoutData[]): LayoutData[] {
		return layouts.filter((l) => {
			if (this.hideEmpty && Object.keys(l.keys).length === 0) return false;
			return this.#matchesInclude(l) && this.#matchesExclude(l);
		});
	}
}

export const filterStore = new FilterStore();
