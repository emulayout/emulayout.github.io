import { LAYOUT_CREATOR_NEW_LAYOUT_NAME } from '$lib/layoutCreator';
import {
	creatorContentFromSnapshot,
	creatorContentSnapshotSignature,
	creatorUrlContentEqual,
	creatorUrlHasDraftParams,
	creatorSnapshotFromContent,
	readCreatorSavedId,
	readCreatorPreviewFlag,
	readCreatorUrlSnapshot,
	type CreatorContentSnapshot,
	type CreatorUrlSnapshot
} from '$lib/layoutCreatorUrl';
import {
	DEFAULT_LAYOUT_DETAIL_SECTION,
	LAYOUT_DETAIL_TAB_PARAM,
	parseCreatorDetailSection
} from '$lib/layoutDetailTabs';

export const SAVED_LAYOUTS_STORAGE_KEY = 'emulayout:saved-layouts';
export const SAVED_LAYOUTS_SCHEMA_VERSION = 1;

export interface SavedCreatorLayout {
	id: string;
	name: string;
	snapshot: CreatorContentSnapshot;
	createdAt: number;
}

export interface SavedCreatorLayoutInput {
	snapshot: CreatorUrlSnapshot;
}

export interface SavedCreatorLayoutWriteOptions {
	createId?: () => string;
	now?: () => number;
}

export interface SavedCreatorLayoutWriteResult {
	layouts: SavedCreatorLayout[];
	id: string;
}

export type CreatorSession = {
	snapshot: CreatorUrlSnapshot;
	savedId: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function savedCreatorLayoutName(snapshot: CreatorUrlSnapshot): string {
	return snapshot.name.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME;
}

export function createSavedLayoutId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function findSavedLayout(
	layouts: readonly SavedCreatorLayout[],
	id: string | null
): SavedCreatorLayout | undefined {
	return id ? layouts.find((entry) => entry.id === id) : undefined;
}

function parseSavedLayout(value: unknown): SavedCreatorLayout | null {
	if (!isPlainObject(value)) return null;
	if (typeof value.id !== 'string' || !value.id) return null;
	if (typeof value.name !== 'string' || !value.name.trim()) return null;
	if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
	if (typeof value.query !== 'string') return null;

	return {
		id: value.id,
		name: value.name.trim(),
		snapshot: creatorContentFromSnapshot(readCreatorUrlSnapshot(new URLSearchParams(value.query))),
		createdAt: value.createdAt
	};
}

/**
 * Parse the versioned saved-layout document.
 * Unknown future versions are ignored rather than interpreted with stale rules.
 */
export function parseSavedLayoutsDocument(value: unknown): SavedCreatorLayout[] {
	if (
		!isPlainObject(value) ||
		value.version !== SAVED_LAYOUTS_SCHEMA_VERSION ||
		!Array.isArray(value.layouts)
	) {
		return [];
	}

	const layouts: SavedCreatorLayout[] = [];
	const ids = new Set<string>();
	for (const rawLayout of value.layouts) {
		const layout = parseSavedLayout(rawLayout);
		if (!layout || ids.has(layout.id)) continue;
		ids.add(layout.id);
		layouts.push(layout);
	}
	return layouts;
}

export function serializeSavedLayoutsDocument(
	layouts: readonly SavedCreatorLayout[],
	space?: number
): string {
	return JSON.stringify(
		{
			version: SAVED_LAYOUTS_SCHEMA_VERSION,
			layouts: layouts.map((layout) => ({
				id: layout.id,
				name: layout.name,
				createdAt: layout.createdAt,
				query: creatorContentSnapshotSignature(layout.snapshot)
			}))
		},
		null,
		space
	);
}

export function loadSavedLayouts(): SavedCreatorLayout[] {
	try {
		if (typeof localStorage === 'undefined') return [];
		const raw = localStorage.getItem(SAVED_LAYOUTS_STORAGE_KEY);
		if (!raw) return [];
		return parseSavedLayoutsDocument(JSON.parse(raw) as unknown);
	} catch {
		return [];
	}
}

export function persistSavedLayouts(layouts: readonly SavedCreatorLayout[]): boolean {
	try {
		if (typeof localStorage === 'undefined') return false;
		if (layouts.length === 0) {
			localStorage.removeItem(SAVED_LAYOUTS_STORAGE_KEY);
			return true;
		}
		localStorage.setItem(SAVED_LAYOUTS_STORAGE_KEY, serializeSavedLayoutsDocument(layouts));
		return true;
	} catch {
		return false;
	}
}

/** Merge storage snapshots by stable id while retaining the first-seen tab order. */
export function mergeSavedLayouts(
	...collections: readonly (readonly SavedCreatorLayout[])[]
): SavedCreatorLayout[] {
	const merged: SavedCreatorLayout[] = [];
	const indexById = new Map<string, number>();
	for (const collection of collections) {
		for (const layout of collection) {
			const index = indexById.get(layout.id);
			if (index === undefined) {
				indexById.set(layout.id, merged.length);
				merged.push(layout);
			} else {
				merged[index] = layout;
			}
		}
	}
	return merged;
}

export function addSavedLayout(
	layouts: readonly SavedCreatorLayout[],
	input: SavedCreatorLayoutInput,
	options: SavedCreatorLayoutWriteOptions = {}
): SavedCreatorLayoutWriteResult {
	const id = (options.createId ?? createSavedLayoutId)();
	const createdAt = (options.now ?? Date.now)();
	return {
		id,
		layouts: [
			...layouts,
			{
				id,
				name: savedCreatorLayoutName(input.snapshot),
				snapshot: creatorContentFromSnapshot(input.snapshot),
				createdAt
			}
		]
	};
}

export function removeSavedLayout(
	layouts: readonly SavedCreatorLayout[],
	id: string
): { layouts: SavedCreatorLayout[]; removed: boolean } {
	const next = layouts.filter((entry) => entry.id !== id);
	return {
		layouts: next,
		removed: next.length !== layouts.length
	};
}

export function updateSavedLayout(
	layouts: readonly SavedCreatorLayout[],
	id: string,
	input: SavedCreatorLayoutInput
): SavedCreatorLayout[] | null {
	const index = layouts.findIndex((entry) => entry.id === id);
	if (index < 0) return null;
	const existing = layouts[index];
	const next = [...layouts];
	next[index] = {
		id: existing.id,
		name: savedCreatorLayoutName(input.snapshot),
		snapshot: creatorContentFromSnapshot(input.snapshot),
		createdAt: existing.createdAt
	};
	return next;
}

export function resolveCreatorSession(
	searchParams: URLSearchParams,
	layouts: readonly SavedCreatorLayout[]
): CreatorSession {
	const savedId = readCreatorSavedId(searchParams);
	const saved = findSavedLayout(layouts, savedId);
	if (!saved) {
		return { snapshot: readCreatorUrlSnapshot(searchParams), savedId: null };
	}
	if (creatorUrlHasDraftParams(searchParams)) {
		return { snapshot: readCreatorUrlSnapshot(searchParams), savedId: saved.id };
	}
	const snapshot = snapshotForSavedLayoutView(saved.snapshot);
	snapshot.preview = readCreatorPreviewFlag(searchParams);
	snapshot.section = parseCreatorDetailSection(searchParams.get(LAYOUT_DETAIL_TAB_PARAM));
	return { snapshot, savedId: saved.id };
}

/** Build a saved-layout view; callers may then overlay URL-owned view state. */
export function snapshotForSavedLayoutView(snapshot: CreatorContentSnapshot): CreatorUrlSnapshot {
	return creatorSnapshotFromContent(snapshot, {
		preview: true,
		section: DEFAULT_LAYOUT_DETAIL_SECTION
	});
}

export function isSavedLayoutDirty(
	snapshot: CreatorUrlSnapshot,
	saved: SavedCreatorLayout | undefined
): boolean {
	if (!saved) return false;
	return !creatorUrlContentEqual(snapshot, saved.snapshot);
}
