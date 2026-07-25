import { cloneViewFilterSnapshot, type ViewFilterSnapshot } from './filterSnapshot';
import {
	createSavedFilterId,
	sortLayoutSourceNames,
	type SavedFilter
} from './savedFiltersStorage';

export type LayoutSource = 'all' | 'selected';

export interface SavedViewUpsertInput {
	name: string;
	snapshot: ViewFilterSnapshot;
	/**
	 * `undefined`/`null` means the full catalog. A provided iterable, including an
	 * empty one, is explicit source membership.
	 */
	sourceLayoutNames?: Iterable<string> | null;
}

export interface SavedViewUpsertOptions {
	createId?: () => string;
	now?: () => number;
}

export interface SavedViewUpsertResult {
	filters: SavedFilter[];
	id: string;
}

function normalizedSourceLayoutNames(
	sourceLayoutNames: Iterable<string> | null | undefined
): string[] | undefined {
	return sourceLayoutNames == null ? undefined : sortLayoutSourceNames(sourceLayoutNames);
}

function withSourceLayoutNames(
	filter: Omit<SavedFilter, 'sourceLayoutNames'>,
	sourceLayoutNames: string[] | undefined
): SavedFilter {
	return {
		...filter,
		...(sourceLayoutNames !== undefined ? { sourceLayoutNames } : {})
	};
}

export function findSavedView(filters: SavedFilter[], id: string | null): SavedFilter | undefined {
	return id ? filters.find((entry) => entry.id === id) : undefined;
}

/** Case-insensitive upsert that preserves an existing view's id and creation time. */
export function upsertSavedView(
	filters: SavedFilter[],
	input: SavedViewUpsertInput,
	options: SavedViewUpsertOptions = {}
): SavedViewUpsertResult | null {
	const name = input.name.trim();
	if (!name) return null;

	const sourceLayoutNames = normalizedSourceLayoutNames(input.sourceLayoutNames);
	const snapshot = cloneViewFilterSnapshot(input.snapshot);
	const existingIndex = filters.findIndex(
		(entry) => entry.name.toLowerCase() === name.toLowerCase()
	);

	if (existingIndex >= 0) {
		const existing = filters[existingIndex];
		const next = [...filters];
		next[existingIndex] = withSourceLayoutNames(
			{
				id: existing.id,
				name,
				snapshot,
				createdAt: existing.createdAt
			},
			sourceLayoutNames
		);
		return { filters: next, id: existing.id };
	}

	const id = (options.createId ?? createSavedFilterId)();
	const createdAt = (options.now ?? Date.now)();
	return {
		filters: [
			...filters,
			withSourceLayoutNames({ id, name, snapshot, createdAt }, sourceLayoutNames)
		],
		id
	};
}

export function updateSavedView(
	filters: SavedFilter[],
	id: string,
	snapshot: ViewFilterSnapshot,
	sourceLayoutNames: Iterable<string> | null
): SavedFilter[] | null {
	const index = filters.findIndex((entry) => entry.id === id);
	if (index < 0) return null;

	const existing = filters[index];
	const next = [...filters];
	next[index] = withSourceLayoutNames(
		{
			id: existing.id,
			name: existing.name,
			snapshot: cloneViewFilterSnapshot(snapshot),
			createdAt: existing.createdAt
		},
		normalizedSourceLayoutNames(sourceLayoutNames)
	);
	return next;
}

export interface RenameSavedViewResult {
	filters: SavedFilter[];
	success: boolean;
	changed: boolean;
}

export function renameSavedView(
	filters: SavedFilter[],
	id: string,
	name: string
): RenameSavedViewResult {
	const trimmed = name.trim();
	if (!trimmed) return { filters, success: false, changed: false };
	if (
		filters.some((entry) => entry.id !== id && entry.name.toLowerCase() === trimmed.toLowerCase())
	) {
		return { filters, success: false, changed: false };
	}

	const index = filters.findIndex((entry) => entry.id === id);
	if (index < 0) return { filters, success: false, changed: false };
	if (filters[index].name === trimmed) {
		return { filters, success: true, changed: false };
	}

	const next = [...filters];
	next[index] = { ...next[index], name: trimmed };
	return { filters: next, success: true, changed: true };
}

export function removeSavedView(
	filters: SavedFilter[],
	id: string
): { filters: SavedFilter[]; removed: boolean } {
	const next = filters.filter((entry) => entry.id !== id);
	return {
		filters: next,
		removed: next.length !== filters.length
	};
}

export interface ActiveSourceState {
	filters: SavedFilter[];
	activeSavedViewId: string | null;
	draftSourceLayoutNames: string[] | null | undefined;
	ephemeralSourceLayoutNames: string[] | null;
}

/** Resolve draft → saved → ephemeral source membership in precedence order. */
export function resolveActiveSourceLayoutNames({
	filters,
	activeSavedViewId,
	draftSourceLayoutNames,
	ephemeralSourceLayoutNames
}: ActiveSourceState): string[] | null {
	if (draftSourceLayoutNames !== undefined) return draftSourceLayoutNames;
	if (activeSavedViewId) {
		return findSavedView(filters, activeSavedViewId)?.sourceLayoutNames ?? null;
	}
	return ephemeralSourceLayoutNames;
}

export function createLayoutNameSet(names: string[] | null): Set<string> | null {
	return names === null ? null : new Set(names);
}

export function isSavedViewDirty(
	saved: SavedFilter,
	currentSnapshot: ViewFilterSnapshot,
	currentSourceLayoutNames: string[] | null
): boolean {
	if (JSON.stringify(currentSnapshot) !== JSON.stringify(saved.snapshot)) return true;
	const savedSourceLayoutNames = saved.sourceLayoutNames ?? null;
	return JSON.stringify(currentSourceLayoutNames) !== JSON.stringify(savedSourceLayoutNames);
}

/** Isolated snapshots for switching between the built-in All and Selected views. */
export class ViewFilterSnapshotCache {
	#snapshots = new Map<LayoutSource, ViewFilterSnapshot>();

	clear(): void {
		this.#snapshots.clear();
	}

	set(source: LayoutSource, snapshot: ViewFilterSnapshot): void {
		this.#snapshots.set(source, cloneViewFilterSnapshot(snapshot));
	}

	get(source: LayoutSource): ViewFilterSnapshot | undefined {
		const snapshot = this.#snapshots.get(source);
		return snapshot ? cloneViewFilterSnapshot(snapshot) : undefined;
	}
}
