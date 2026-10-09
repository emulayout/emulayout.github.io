import {
	cloneCreatorSnapshot,
	createDefaultCreatorSnapshot,
	creatorContentEqual,
	creatorSnapshotFromContent,
	type CreatorSnapshot
} from '$lib/creatorContent';
import { nextDuplicatedLayoutName } from '$lib/layoutCreator';
import {
	addSavedLayout,
	findSavedLayout,
	isSavedLayoutDirty,
	loadSavedLayouts,
	mergeSavedLayouts,
	persistSavedLayouts,
	removeSavedLayout,
	resolveCreatorSession,
	savedCreatorLayoutName,
	snapshotForSavedLayoutView,
	updateSavedLayout,
	type SavedCreatorLayout
} from '$lib/layoutCreatorStorage';
import { DEFAULT_LAYOUT_DETAIL_SECTION } from '$lib/layoutDetailTabs';
import { mergeSavedLayoutsBackup, type SavedLayoutsImportMode } from '$lib/savedLayoutsBackup';

interface CreatorSessionTransition {
	ok: boolean;
	/** Replace the live canvas only when a transition supplies a snapshot. */
	snapshot?: CreatorSnapshot;
}

/** Saved-layout state and transitions. The page owns the live editor, view state, and effects. */
export class CreatorSession {
	#layouts = $state.raw<SavedCreatorLayout[]>([]);
	#activeId = $state<string | null>(null);
	#error = $state<string | null>(null);

	constructor(layouts: SavedCreatorLayout[], activeId: string | null) {
		this.#layouts = layouts;
		this.#activeId = activeId;
	}

	get layouts() {
		return this.#layouts;
	}
	get activeId() {
		return this.#activeId;
	}
	get activeLayout() {
		return findSavedLayout(this.#layouts, this.#activeId);
	}
	get error() {
		return this.#error;
	}
	clearError() {
		this.#error = null;
	}
	find(id: string | null) {
		return findSavedLayout(this.#layouts, id);
	}
	isDirty(snapshot: CreatorSnapshot): boolean {
		return isSavedLayoutDirty(snapshot, this.activeLayout);
	}
	hasUnsavedChanges(snapshot: CreatorSnapshot): boolean {
		return this.#activeId
			? this.isDirty(snapshot)
			: !creatorContentEqual(snapshot, createDefaultCreatorSnapshot());
	}

	#layoutsForWrite(): SavedCreatorLayout[] {
		return mergeSavedLayouts(this.#layouts, loadSavedLayouts());
	}
	#commit(layouts: SavedCreatorLayout[], id: string): boolean {
		if (!persistSavedLayouts(layouts)) {
			this.#error = 'Unable to save this layout in your browser. Your draft is still in the URL.';
			return false;
		}
		this.#layouts = layouts;
		this.#activeId = id;
		this.clearError();
		return true;
	}

	save(snapshot: CreatorSnapshot): boolean {
		this.clearError();
		if (!this.#activeId) return this.saveAsNew(snapshot);
		const next = updateSavedLayout(this.#layoutsForWrite(), this.#activeId, { snapshot });
		return next !== null && this.#commit(next, this.#activeId);
	}
	saveAsNew(snapshot: CreatorSnapshot): boolean {
		this.clearError();
		const result = addSavedLayout(this.#layoutsForWrite(), { snapshot });
		return this.#commit(result.layouts, result.id);
	}
	duplicate(current: CreatorSnapshot): CreatorSnapshot | null {
		this.clearError();
		const snapshot = cloneCreatorSnapshot(current);
		const layouts = this.#layoutsForWrite();
		snapshot.name = nextDuplicatedLayoutName(
			savedCreatorLayoutName(snapshot),
			layouts.map((saved) => saved.name)
		);
		snapshot.preview = false;
		const result = addSavedLayout(layouts, { snapshot });
		if (!this.#commit(result.layouts, result.id)) return null;
		snapshot.section = DEFAULT_LAYOUT_DETAIL_SECTION;
		return snapshot;
	}
	open(id: string | null): CreatorSnapshot | null {
		const saved = this.find(id);
		if (!saved) return null;
		this.#activeId = saved.id;
		return snapshotForSavedLayoutView(saved.snapshot);
	}
	restore(searchParams: URLSearchParams): CreatorSnapshot {
		const session = resolveCreatorSession(searchParams, this.#layouts);
		this.#activeId = session.savedId;
		return session.snapshot;
	}
	revert(current: CreatorSnapshot): CreatorSnapshot | null {
		const saved = this.activeLayout;
		return saved ? this.#withCurrentView(saved, current) : null;
	}
	startNew(): CreatorSnapshot {
		this.#activeId = null;
		return createDefaultCreatorSnapshot();
	}
	#withCurrentView(saved: SavedCreatorLayout, current: CreatorSnapshot): CreatorSnapshot {
		return creatorSnapshotFromContent(saved.snapshot, {
			preview: current.preview,
			section: current.section
		});
	}

	importBackup(
		current: CreatorSnapshot,
		imported: SavedCreatorLayout[],
		mode: SavedLayoutsImportMode
	): CreatorSessionTransition {
		const preserveDraft = this.isDirty(current);
		const merged = mergeSavedLayoutsBackup(this.#layoutsForWrite(), imported, mode);
		if (!persistSavedLayouts(merged.layouts)) {
			this.#error = 'Unable to import layouts in this browser. Your current draft is unchanged.';
			return { ok: false };
		}
		this.#layouts = merged.layouts;
		this.clearError();
		if (!this.#activeId) return { ok: true };
		const active = this.activeLayout;
		if (!active) {
			this.#activeId = null;
			return { ok: true, snapshot: preserveDraft ? undefined : createDefaultCreatorSnapshot() };
		}
		return {
			ok: true,
			snapshot:
				!preserveDraft && merged.importedIds.has(this.#activeId)
					? this.#withCurrentView(active, current)
					: undefined
		};
	}

	/** Storage updates refresh tabs, retaining the live canvas unless its clean save was removed. */
	syncStorage(current: CreatorSnapshot): { activeRemoved: boolean; snapshot?: CreatorSnapshot } {
		const preserveDraft = this.isDirty(current);
		this.#layouts = loadSavedLayouts();
		if (!this.#activeId || this.activeLayout) return { activeRemoved: false };
		this.#activeId = null;
		return {
			activeRemoved: true,
			snapshot: preserveDraft ? undefined : createDefaultCreatorSnapshot()
		};
	}

	delete(id: string): CreatorSessionTransition {
		const result = removeSavedLayout(this.#layoutsForWrite(), id);
		if (!result.removed) return { ok: false };
		if (!persistSavedLayouts(result.layouts)) {
			this.#error = 'Unable to delete this layout in your browser.';
			return { ok: false };
		}
		this.#layouts = result.layouts;
		this.clearError();
		return { ok: true, snapshot: this.#activeId === id ? this.startNew() : undefined };
	}
}
