import { LAYOUT_CREATOR_NEW_LAYOUT_NAME } from '$lib/layoutCreator';
import {
	cloneCreatorUrlSnapshot,
	creatorUrlSnapshotSignature,
	creatorUrlHasDraftParams,
	readCreatorSavedId,
	readCreatorUrlSnapshot,
	type CreatorUrlSnapshot
} from '$lib/layoutCreatorUrl';

const STORAGE_KEY = 'emulayout:saved-layouts';
export const SAVED_LAYOUTS_SCHEMA_VERSION = 1;

export interface SavedCreatorLayout {
	id: string;
	name: string;
	snapshot: CreatorUrlSnapshot;
	createdAt: number;
}

export interface SavedCreatorLayoutInput {
	name: string;
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
		snapshot: readCreatorUrlSnapshot(new URLSearchParams(value.query)),
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

	return value.layouts
		.map(parseSavedLayout)
		.filter((entry): entry is SavedCreatorLayout => entry !== null);
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
				query: creatorUrlSnapshotSignature(layout.snapshot)
			}))
		},
		null,
		space
	);
}

export function loadSavedLayouts(): SavedCreatorLayout[] {
	try {
		if (typeof localStorage === 'undefined') return [];
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return parseSavedLayoutsDocument(JSON.parse(raw) as unknown);
	} catch {
		return [];
	}
}

export function persistSavedLayouts(layouts: readonly SavedCreatorLayout[]): void {
	try {
		if (typeof localStorage === 'undefined') return;
		if (layouts.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}
		localStorage.setItem(STORAGE_KEY, serializeSavedLayoutsDocument(layouts));
	} catch {
		// ignore quota / private mode
	}
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
				snapshot: cloneCreatorUrlSnapshot(input.snapshot),
				createdAt
			}
		]
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
		snapshot: cloneCreatorUrlSnapshot(input.snapshot),
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
	return { snapshot: cloneCreatorUrlSnapshot(saved.snapshot), savedId: saved.id };
}

export function isSavedLayoutDirty(
	snapshot: CreatorUrlSnapshot,
	saved: SavedCreatorLayout | undefined
): boolean {
	if (!saved) return false;
	return creatorUrlSnapshotSignature(snapshot) !== creatorUrlSnapshotSignature(saved.snapshot);
}
