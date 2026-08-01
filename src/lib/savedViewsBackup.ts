import { cloneViewFilterSnapshot } from '$lib/filterSnapshot';
import {
	SAVED_FILTERS_SCHEMA_VERSION,
	parseSavedFiltersDocument,
	type SavedFilter
} from '$lib/savedFiltersStorage';

export type SavedViewsImportMode = 'add' | 'replace';
export type SavedViewsBackupError = 'empty' | 'invalid-json' | 'unsupported-format' | 'no-views';

export type SavedViewsBackupParseResult =
	| { ok: true; filters: SavedFilter[]; skippedCount: number }
	| { ok: false; error: SavedViewsBackupError };

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function backupEntries(value: unknown): unknown[] | null {
	if (Array.isArray(value)) return value;
	if (
		isPlainObject(value) &&
		value.version === SAVED_FILTERS_SCHEMA_VERSION &&
		Array.isArray(value.filters)
	) {
		return value.filters;
	}
	return null;
}

export function parseSavedViewsBackup(text: string): SavedViewsBackupParseResult {
	if (!text.trim()) return { ok: false, error: 'empty' };

	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch {
		return { ok: false, error: 'invalid-json' };
	}

	const entries = backupEntries(value);
	if (!entries) return { ok: false, error: 'unsupported-format' };

	const filters = parseSavedFiltersDocument(value);
	if (filters.length === 0) return { ok: false, error: 'no-views' };

	return {
		ok: true,
		filters,
		skippedCount: entries.length - filters.length
	};
}

function cloneSavedView(view: SavedFilter): SavedFilter {
	return {
		id: view.id,
		name: view.name,
		snapshot: cloneViewFilterSnapshot(view.snapshot),
		...(view.sourceLayoutNames ? { sourceLayoutNames: [...view.sourceLayoutNames] } : {}),
		createdAt: view.createdAt
	};
}

export interface MergeSavedViewsResult {
	filters: SavedFilter[];
	/** Local ids whose stored contents came from the import. */
	importedIds: Set<string>;
}

/**
 * Merge imported views without creating duplicate ids or case-insensitive names.
 * A matching local view is refreshed in place so an active tab keeps its identity.
 */
export function mergeSavedViews(
	existing: SavedFilter[],
	imported: SavedFilter[],
	mode: SavedViewsImportMode
): MergeSavedViewsResult {
	let filters = mode === 'add' ? existing.map(cloneSavedView) : [];
	const importedIds = new Set<string>();

	for (const incoming of imported) {
		const normalizedName = incoming.name.toLowerCase();
		const conflictIndices = filters.flatMap((view, index) =>
			view.id === incoming.id || view.name.toLowerCase() === normalizedName ? [index] : []
		);

		if (conflictIndices.length === 0) {
			const next = cloneSavedView(incoming);
			filters.push(next);
			importedIds.add(next.id);
			continue;
		}

		const insertAt = conflictIndices[0];
		const localId = filters[insertAt].id;
		const conflicts = new Set(conflictIndices);
		filters = filters.filter((_, index) => !conflicts.has(index));
		filters.splice(insertAt, 0, { ...cloneSavedView(incoming), id: localId });
		importedIds.add(localId);
	}

	return { filters, importedIds };
}
