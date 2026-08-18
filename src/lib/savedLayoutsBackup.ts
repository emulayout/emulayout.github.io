import {
	SAVED_LAYOUTS_SCHEMA_VERSION,
	parseSavedLayoutsDocument,
	type SavedCreatorLayout
} from '$lib/layoutCreatorStorage';
import { creatorContentFromSnapshot, creatorSnapshotFromContent } from '$lib/layoutCreatorUrl';

export type SavedLayoutsImportMode = 'add' | 'replace';
export type SavedLayoutsBackupError =
	| 'empty'
	| 'invalid-json'
	| 'unsupported-format'
	| 'no-layouts';

export type SavedLayoutsBackupParseResult =
	| { ok: true; layouts: SavedCreatorLayout[]; skippedCount: number }
	| { ok: false; error: SavedLayoutsBackupError };

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function backupEntries(value: unknown): unknown[] | null {
	if (
		isPlainObject(value) &&
		value.version === SAVED_LAYOUTS_SCHEMA_VERSION &&
		Array.isArray(value.layouts)
	) {
		return value.layouts;
	}
	return null;
}

export function parseSavedLayoutsBackup(text: string): SavedLayoutsBackupParseResult {
	if (!text.trim()) return { ok: false, error: 'empty' };

	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch {
		return { ok: false, error: 'invalid-json' };
	}

	const entries = backupEntries(value);
	if (!entries) return { ok: false, error: 'unsupported-format' };

	const layouts = parseSavedLayoutsDocument(value);
	if (layouts.length === 0) return { ok: false, error: 'no-layouts' };

	return {
		ok: true,
		layouts,
		skippedCount: entries.length - layouts.length
	};
}

function cloneSavedLayout(layout: SavedCreatorLayout): SavedCreatorLayout {
	return {
		id: layout.id,
		name: layout.name,
		snapshot: creatorContentFromSnapshot(creatorSnapshotFromContent(layout.snapshot)),
		createdAt: layout.createdAt
	};
}

export interface MergeSavedLayoutsBackupResult {
	layouts: SavedCreatorLayout[];
	/** Local ids whose stored contents came from the import. */
	importedIds: Set<string>;
}

/**
 * Merge imported layouts without creating duplicate ids or case-insensitive names.
 * In Add mode, a matching local layout is refreshed in place so active URLs keep their identity.
 */
export function mergeSavedLayoutsBackup(
	existing: readonly SavedCreatorLayout[],
	imported: readonly SavedCreatorLayout[],
	mode: SavedLayoutsImportMode
): MergeSavedLayoutsBackupResult {
	let layouts = mode === 'add' ? existing.map(cloneSavedLayout) : [];
	const importedIds = new Set<string>();

	for (const incoming of imported) {
		const normalizedName = incoming.name.toLowerCase();
		const conflictIndices = layouts.flatMap((layout, index) =>
			layout.id === incoming.id || layout.name.toLowerCase() === normalizedName ? [index] : []
		);

		if (conflictIndices.length === 0) {
			const next = cloneSavedLayout(incoming);
			layouts.push(next);
			importedIds.add(next.id);
			continue;
		}

		const insertAt = conflictIndices[0];
		const localId = layouts[insertAt].id;
		const conflicts = new Set(conflictIndices);
		layouts = layouts.filter((_, index) => !conflicts.has(index));
		layouts.splice(insertAt, 0, { ...cloneSavedLayout(incoming), id: localId });
		importedIds.add(localId);
	}

	return { layouts, importedIds };
}
