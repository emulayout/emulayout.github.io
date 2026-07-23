import type { ViewFilterSnapshot } from '$lib/filterStore.svelte';

const STORAGE_KEY = 'emulayout:saved-filters';

export interface SavedFilter {
	id: string;
	name: string;
	snapshot: ViewFilterSnapshot;
	createdAt: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Light shape check — drop entries that clearly cannot restore. */
function isSavedFilter(value: unknown): value is SavedFilter {
	if (!isPlainObject(value)) return false;
	if (typeof value.id !== 'string' || !value.id) return false;
	if (typeof value.name !== 'string' || !value.name.trim()) return false;
	if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return false;
	if (!isPlainObject(value.snapshot)) return false;
	const snapshot = value.snapshot;
	return (
		Array.isArray(snapshot.includeGrid) &&
		Array.isArray(snapshot.excludeGrid) &&
		Array.isArray(snapshot.includeOrGrid) &&
		typeof snapshot.nameFilter === 'string' &&
		typeof snapshot.sortBy === 'string' &&
		typeof snapshot.sortOrder === 'string'
	);
}

export function loadSavedFilters(): SavedFilter[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isSavedFilter).map((entry) => ({
			id: entry.id,
			name: entry.name.trim(),
			snapshot: entry.snapshot,
			createdAt: entry.createdAt
		}));
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
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
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
