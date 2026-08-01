import {
	compactViewFilterSnapshot,
	normalizeViewFilterSnapshot,
	type ViewFilterSnapshot
} from '$lib/filterSnapshot';

const STORAGE_KEY = 'emulayout:saved-filters';
export const SAVED_FILTERS_SCHEMA_VERSION = 1;

export interface SavedFilter {
	id: string;
	name: string;
	snapshot: ViewFilterSnapshot;
	/** Explicit layout membership for this view (sorted). When set, the catalog is filtered to these names. */
	sourceLayoutNames?: string[];
	createdAt: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseSourceLayoutNames(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return sortLayoutSourceNames(
		value
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
	);
}

function parseSavedFilter(value: unknown): SavedFilter | null {
	if (!isPlainObject(value)) return null;
	if (typeof value.id !== 'string' || !value.id) return null;
	if (typeof value.name !== 'string' || !value.name.trim()) return null;
	if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
	if (!isPlainObject(value.snapshot)) return null;

	const sourceLayoutNames = parseSourceLayoutNames(value.sourceLayoutNames);
	return {
		id: value.id,
		name: value.name.trim(),
		snapshot: normalizeViewFilterSnapshot(value.snapshot),
		...(sourceLayoutNames !== undefined ? { sourceLayoutNames } : {}),
		createdAt: value.createdAt
	};
}

/**
 * Parse both the original unversioned array and the current versioned document.
 * Unknown future versions are ignored rather than interpreted with stale rules.
 */
export function parseSavedFiltersDocument(value: unknown): SavedFilter[] {
	let entries: unknown[];
	if (Array.isArray(value)) {
		entries = value;
	} else if (
		isPlainObject(value) &&
		value.version === SAVED_FILTERS_SCHEMA_VERSION &&
		Array.isArray(value.filters)
	) {
		entries = value.filters;
	} else {
		return [];
	}

	return entries.map(parseSavedFilter).filter((entry): entry is SavedFilter => entry !== null);
}

export function serializeSavedFiltersDocument(filters: SavedFilter[], space?: number): string {
	return JSON.stringify(
		{
			version: SAVED_FILTERS_SCHEMA_VERSION,
			filters: filters.map((filter) => ({
				...filter,
				snapshot: compactViewFilterSnapshot(filter.snapshot)
			}))
		},
		null,
		space
	);
}

export function loadSavedFilters(): SavedFilter[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return parseSavedFiltersDocument(parsed);
	} catch {
		return [];
	}
}

export function persistSavedFilters(filters: SavedFilter[]): void {
	try {
		if (filters.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}
		localStorage.setItem(STORAGE_KEY, serializeSavedFiltersDocument(filters));
	} catch {
		// ignore quota / private mode
	}
}

export function createSavedFilterId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable alphabetical sort for view source membership. */
export function sortLayoutSourceNames(names: Iterable<string>): string[] {
	return [...names]
		.map((name) => name.trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
}
