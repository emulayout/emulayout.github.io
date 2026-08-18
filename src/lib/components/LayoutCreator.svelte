<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PathnameWithSearchOrHash } from '$app/types';
	import type { Attachment } from 'svelte/attachments';
	import AuthorAutocomplete from '$lib/components/AuthorAutocomplete.svelte';
	import CreatorAdaptiveMappingsPanel from '$lib/components/CreatorAdaptiveMappingsPanel.svelte';
	import CreatorMagicMappingsPanel from '$lib/components/CreatorMagicMappingsPanel.svelte';
	import DeleteSavedLayoutModal from '$lib/components/DeleteSavedLayoutModal.svelte';
	import DiscardCreatorChangesModal from '$lib/components/DiscardCreatorChangesModal.svelte';
	import DropdownMenu from '$lib/components/DropdownMenu.svelte';
	import KeyboardInputEditor from '$lib/components/KeyboardInputEditor.svelte';
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import LayoutBackupsMenu from '$lib/components/LayoutBackupsMenu.svelte';
	import LayoutExpandedView from '$lib/components/LayoutExpandedView.svelte';
	import LayoutInputFeatureIcon from '$lib/components/LayoutInputFeatureIcon.svelte';
	import LayoutKeyImportModal from '$lib/components/LayoutKeyImportModal.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		createHistoryTarget,
		isRouterNotReadyError,
		shouldWriteHistory
	} from '$lib/filterNavigation';
	import {
		clearKeyboardInputConfig,
		createKeyboardInputConfigFromLayout,
		keyboardInputEditorWidthTerms,
		type InputKeyboardType,
		type KeyboardInputConfig
	} from '$lib/keyboardInputConfig';
	import {
		LAYOUT_CREATOR_NEW_LAYOUT_NAME,
		LAYOUT_CREATOR_NEW_TAB,
		LOCAL_LAYOUT_STATS_UNAVAILABLE_DETAIL,
		createLayoutFromKeyConfig,
		nextDuplicatedLayoutName,
		keyboardConfigGainedMagicTriggers,
		keyboardConfigHasMagicTrigger,
		savedCreatorTabId,
		savedCreatorTabValue,
		type LayoutCreatorTabValue
	} from '$lib/layoutCreator';
	import {
		compileCreatorInputProfile,
		createEmptyCreatorAdaptiveDraft,
		createEmptyCreatorMagicDraft,
		creatorAdaptiveDraftHasEnabledMappings,
		creatorAdaptiveDraftHasMappings,
		creatorDraftsFromSupplemental,
		creatorMagicDraftHasEnabledMappings,
		creatorMagicDraftHasMappings,
		creatorLayoutMissingKeys,
		ensureCreatorMagicTrigger,
		type CreatorAdaptiveDraft,
		type CreatorMagicDraft
	} from '$lib/layoutCreatorMappings';
	import {
		addSavedLayout,
		findSavedLayout,
		isSavedLayoutDirty,
		loadSavedLayouts,
		mergeSavedLayouts,
		persistSavedLayouts,
		removeSavedLayout,
		resolveCreatorSession,
		snapshotForSavedLayoutView,
		SAVED_LAYOUTS_STORAGE_KEY,
		savedCreatorLayoutName,
		updateSavedLayout,
		type SavedCreatorLayout
	} from '$lib/layoutCreatorStorage';
	import { mergeSavedLayoutsBackup, type SavedLayoutsImportMode } from '$lib/savedLayoutsBackup';
	import {
		cloneCreatorUrlSnapshot,
		createDefaultCreatorUrlSnapshot,
		creatorSearchFromSnapshot,
		creatorSnapshotFromContent,
		creatorUrlContentEqual,
		creatorUrlSnapshotsEqual,
		type CreatorContentSnapshot,
		type CreatorUrlSnapshot
	} from '$lib/layoutCreatorUrl';
	import {
		normalizeTypingPracticeLessonSettings,
		type TypingPracticeLessonSettings
	} from '$lib/typingPracticeText';
	import {
		DEFAULT_LAYOUT_DETAIL_SECTION,
		parseCreatorDetailSection,
		type LayoutDetailSection
	} from '$lib/layoutDetailTabs';
	import type { LayoutKeyboardPresentation } from '$lib/layoutKeyboardFeedback';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import type { TabOption } from '$lib/tabs';

	type PendingCreatorNavigation =
		| { kind: 'saved'; savedId: string; destinationName: string }
		| { kind: 'new' };

	const NEW_TAB_ID = 'layout-creator-tab-new';
	const PANEL_ID = 'layout-creator-panel';
	const MAGIC_MAPPINGS_PANEL_ID = 'layout-creator-magic-mappings';
	const ADAPTIVE_MAPPINGS_PANEL_ID = 'layout-creator-adaptive-mappings';
	const CREATOR_PATH = resolve('/create');
	const CREATOR_URL_DEBOUNCE_MS = 300;
	const initialLayouts = loadSavedLayouts();
	const initialSession = resolveCreatorSession(page.url.searchParams, initialLayouts);

	let savedLayouts = $state.raw<SavedCreatorLayout[]>(initialLayouts);
	let activeSavedId = $state<string | null>(initialSession.savedId);
	let layoutNameDraft = $state(initialSession.snapshot.name);
	let layoutAuthorDraft = $state(initialSession.snapshot.author);
	let layoutPreview = $state(initialSession.snapshot.preview);
	let layoutNameFocusEpoch = $state(
		!initialSession.savedId && !initialSession.snapshot.preview ? 1 : 0
	);
	let consumedLayoutNameFocusEpoch = 0;
	let autofocusFirstKey = $state(false);
	let disabledMappingIds = $state<string[]>([...initialSession.snapshot.disabledMappingIds]);
	let includeMagicKey = $state(initialSession.snapshot.includeMagicKey);
	let includeAdaptiveKey = $state(initialSession.snapshot.includeAdaptiveKey);
	let magicPanelOpen = $state(initialSession.snapshot.includeMagicKey);
	let adaptivePanelOpen = $state(initialSession.snapshot.includeAdaptiveKey);
	let magicDraft = $state.raw(initialSession.snapshot.magicDraft);
	let adaptiveDraft = $state.raw(initialSession.snapshot.adaptiveDraft);
	let keyConfig = $state.raw(initialSession.snapshot.keyConfig);
	let practiceLesson = $state.raw(initialSession.snapshot.practiceLesson);
	let activeSection = $state<LayoutDetailSection>(initialSession.snapshot.section);
	let saveMenuOpen = $state(false);
	let keyImportOpen = $state(false);
	let saveError = $state<string | null>(null);
	let deleteSavedLayoutId = $state<string | null>(null);
	let deleteSavedLayoutName = $state('');
	let pendingCreatorNavigation = $state<PendingCreatorNavigation | null>(null);
	let pendingHistoryRetry = false;
	let urlSyncTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastWrittenSearch = page.url.search;
	const layoutName = $derived(layoutNameDraft.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME);
	const layoutAuthor = $derived(layoutAuthorDraft.trim());
	const authorNames = $derived(
		Object.keys(layoutsCatalog.authorsData).toSorted((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' })
		)
	);
	const activeSavedLayout = $derived(findSavedLayout(savedLayouts, activeSavedId));
	const activeTab = $derived<LayoutCreatorTabValue>(
		activeSavedId ? savedCreatorTabValue(activeSavedId) : LAYOUT_CREATOR_NEW_TAB
	);
	const selectedTabId = $derived(activeSavedId ? savedCreatorTabId(activeSavedId) : NEW_TAB_ID);
	const practiceMagicEnabled = $derived(includeMagicKey);
	const practiceAdaptiveEnabled = $derived(includeAdaptiveKey);
	const layout = $derived(
		createLayoutFromKeyConfig(keyConfig, {
			name: layoutName,
			magicKey: practiceMagicEnabled,
			adaptiveKey: practiceAdaptiveEnabled
		})
	);
	const availableLayoutKeys = $derived(Object.keys(layout.keys));
	const magicDraftHasMappings = $derived(
		creatorMagicDraftHasMappings(magicDraft, availableLayoutKeys)
	);
	const adaptiveDraftHasMappings = $derived(
		creatorAdaptiveDraftHasMappings(adaptiveDraft, availableLayoutKeys)
	);
	const magicIconActive = $derived(
		magicPanelOpen &&
			creatorMagicDraftHasEnabledMappings(magicDraft, disabledMappingIds, availableLayoutKeys)
	);
	const adaptiveIconActive = $derived(
		adaptivePanelOpen &&
			creatorAdaptiveDraftHasEnabledMappings(adaptiveDraft, disabledMappingIds, availableLayoutKeys)
	);
	const magicIconHasData = $derived(!magicPanelOpen && magicDraftHasMappings);
	const adaptiveIconHasData = $derived(!adaptivePanelOpen && adaptiveDraftHasMappings);
	const inputProfile = $derived(
		compileCreatorInputProfile(
			practiceMagicEnabled,
			magicDraft,
			practiceAdaptiveEnabled,
			adaptiveDraft,
			availableLayoutKeys
		)
	);
	const showEditorMappings = $derived(magicPanelOpen || adaptivePanelOpen);
	const missingLetters = $derived(
		creatorLayoutMissingKeys(
			includeMagicKey ? magicDraft : undefined,
			availableLayoutKeys,
			disabledMappingIds
		)
	);
	const editorWidthTerms = $derived(keyboardInputEditorWidthTerms(keyConfig));
	const options: TabOption<LayoutCreatorTabValue>[] = $derived.by(() => {
		const savedTabs = savedLayouts.map((saved) => ({
			value: savedCreatorTabValue(saved.id),
			label: saved.id === activeSavedId ? layoutName : saved.name,
			id: savedCreatorTabId(saved.id),
			controls: PANEL_ID
		}));
		if (activeSavedId) return savedTabs;
		return [
			{
				value: LAYOUT_CREATOR_NEW_TAB,
				label: layoutName,
				id: NEW_TAB_ID,
				controls: PANEL_ID
			},
			...savedTabs
		];
	});
	const savedLayoutByValue = $derived(
		new Map(savedLayouts.map((saved) => [savedCreatorTabValue(saved.id), saved] as const))
	);

	let baseLayoutSeed = 0;

	$effect(() => {
		void layoutsCatalog.ensureLoaded();
		void layoutsCatalog.ensureSupplementalLoaded();
	});

	$effect(() => {
		const snapshot = currentCreatorSnapshot();
		const savedId = activeSavedId;
		const savedSnapshot = findSavedLayout(savedLayouts, savedId)?.snapshot ?? null;
		if (urlSyncTimeout) clearTimeout(urlSyncTimeout);
		urlSyncTimeout = setTimeout(() => {
			urlSyncTimeout = null;
			writeCreatorHistory(snapshot, savedId, savedSnapshot);
		}, CREATOR_URL_DEBOUNCE_MS);
		return () => {
			if (urlSyncTimeout) {
				clearTimeout(urlSyncTimeout);
				urlSyncTimeout = null;
			}
		};
	});

	function currentCreatorSnapshot(): CreatorUrlSnapshot {
		return {
			name: layoutNameDraft,
			author: layoutAuthorDraft,
			preview: layoutPreview,
			section: parseCreatorDetailSection(activeSection),
			includeMagicKey,
			includeAdaptiveKey,
			magicDraft,
			adaptiveDraft,
			keyConfig,
			practiceLesson,
			disabledMappingIds
		};
	}

	const isActiveSavedDirty = $derived(
		isSavedLayoutDirty(currentCreatorSnapshot(), activeSavedLayout)
	);
	const hasUnsavedCreatorChanges = $derived(
		activeSavedId
			? isActiveSavedDirty
			: !creatorUrlContentEqual(currentCreatorSnapshot(), createDefaultCreatorUrlSnapshot())
	);
	const discardDestination = $derived(
		pendingCreatorNavigation?.kind === 'saved'
			? `open ${pendingCreatorNavigation.destinationName}`
			: 'start a new layout'
	);
	const deleteDiscardsUnsavedChanges = $derived(
		deleteSavedLayoutId !== null && deleteSavedLayoutId === activeSavedId && isActiveSavedDirty
	);
	const showUpdateSplit = $derived(Boolean(activeSavedId && isActiveSavedDirty));
	const showDuplicateButton = $derived(Boolean(activeSavedId && !isActiveSavedDirty));
	const canClearNewLayout = $derived(
		!activeSavedId &&
			(Boolean(keyConfig.baseLayoutName) ||
				keyConfig.keys.some((key) => Boolean(key.value)) ||
				includeMagicKey ||
				includeAdaptiveKey)
	);

	$effect(() => {
		if (!showUpdateSplit) saveMenuOpen = false;
	});

	const focusNewLayoutName: Attachment<HTMLInputElement> = (node) => {
		const epoch = layoutNameFocusEpoch;
		if (epoch === 0 || epoch === consumedLayoutNameFocusEpoch) return;
		consumedLayoutNameFocusEpoch = epoch;
		node.focus();
		if (node.value === LAYOUT_CREATOR_NEW_LAYOUT_NAME) node.select();
	};

	function applyCreatorSnapshot(snapshot: CreatorUrlSnapshot) {
		const next = cloneCreatorUrlSnapshot(snapshot);
		layoutNameDraft = next.name;
		layoutAuthorDraft = next.author;
		layoutPreview = next.preview;
		activeSection = next.section;
		includeMagicKey = next.includeMagicKey;
		includeAdaptiveKey = next.includeAdaptiveKey;
		magicPanelOpen = next.includeMagicKey;
		adaptivePanelOpen = next.includeAdaptiveKey;
		magicDraft = next.magicDraft;
		adaptiveDraft = next.adaptiveDraft;
		keyConfig = next.keyConfig;
		practiceLesson = next.practiceLesson;
		disabledMappingIds = [...next.disabledMappingIds];
		saveError = null;
		autofocusFirstKey = false;
	}

	function commitSavedLayouts(layouts: SavedCreatorLayout[], id: string): boolean {
		if (!persistSavedLayouts(layouts)) {
			saveError = 'Unable to save this layout in your browser. Your draft is still in the URL.';
			flushCreatorUrl();
			return false;
		}
		savedLayouts = layouts;
		activeSavedId = id;
		saveError = null;
		return true;
	}

	function savedLayoutsForWrite(): SavedCreatorLayout[] {
		return mergeSavedLayouts(savedLayouts, loadSavedLayouts());
	}

	function importSavedLayoutBackup(
		importedLayouts: SavedCreatorLayout[],
		mode: SavedLayoutsImportMode
	): boolean {
		const currentSnapshot = currentCreatorSnapshot();
		const previousSaved = findSavedLayout(savedLayouts, activeSavedId);
		const preserveDraft = isSavedLayoutDirty(currentSnapshot, previousSaved);
		const merged = mergeSavedLayoutsBackup(savedLayoutsForWrite(), importedLayouts, mode);
		if (!persistSavedLayouts(merged.layouts)) {
			saveError = 'Unable to import layouts in this browser. Your current draft is unchanged.';
			return false;
		}

		savedLayouts = merged.layouts;
		saveError = null;
		if (!activeSavedId) {
			flushCreatorUrl();
			return true;
		}

		const active = findSavedLayout(merged.layouts, activeSavedId);
		if (!active) {
			activeSavedId = null;
			if (!preserveDraft) applyCreatorSnapshot(createDefaultCreatorUrlSnapshot());
		} else if (!preserveDraft && merged.importedIds.has(activeSavedId)) {
			applyCreatorSnapshot(
				creatorSnapshotFromContent(active.snapshot, {
					preview: layoutPreview,
					section: parseCreatorDetailSection(activeSection)
				})
			);
		}
		flushCreatorUrl();
		return true;
	}

	function handleSavedLayoutsStorage(event: StorageEvent) {
		if (event.key !== SAVED_LAYOUTS_STORAGE_KEY && event.key !== null) return;
		const currentSnapshot = currentCreatorSnapshot();
		const previousSaved = findSavedLayout(savedLayouts, activeSavedId);
		const preserveAsUnsaved = isSavedLayoutDirty(currentSnapshot, previousSaved);
		const nextLayouts = loadSavedLayouts();
		savedLayouts = nextLayouts;
		if (activeSavedId && !findSavedLayout(nextLayouts, activeSavedId)) {
			activeSavedId = null;
			if (!preserveAsUnsaved) applyCreatorSnapshot(createDefaultCreatorUrlSnapshot());
			flushCreatorUrl();
		}
	}

	function flushCreatorUrl() {
		if (urlSyncTimeout) {
			clearTimeout(urlSyncTimeout);
			urlSyncTimeout = null;
		}
		writeCreatorHistory(
			currentCreatorSnapshot(),
			activeSavedId,
			findSavedLayout(savedLayouts, activeSavedId)?.snapshot ?? null
		);
	}

	function writeCreatorHistory(
		snapshot: CreatorUrlSnapshot,
		savedId: string | null,
		savedSnapshot: CreatorContentSnapshot | null
	) {
		if (typeof window === 'undefined') return;
		if (page.url.pathname !== CREATOR_PATH) return;
		const search = creatorSearchFromSnapshot(snapshot, { savedId, savedSnapshot });
		lastWrittenSearch = search;
		const next = createHistoryTarget({
			pathname: CREATOR_PATH,
			search,
			hash: page.url.hash
		});
		const current = createHistoryTarget({
			pathname: page.url.pathname,
			search: page.url.search,
			hash: page.url.hash
		});
		if (!shouldWriteHistory('replace', next, current)) return;
		try {
			replaceState(resolve(next as PathnameWithSearchOrHash), page.state);
		} catch (error) {
			if (!isRouterNotReadyError(error)) throw error;
			if (pendingHistoryRetry) return;
			pendingHistoryRetry = true;
			setTimeout(() => {
				pendingHistoryRetry = false;
				writeCreatorHistory(
					currentCreatorSnapshot(),
					activeSavedId,
					findSavedLayout(savedLayouts, activeSavedId)?.snapshot ?? null
				);
			}, 0);
		}
	}

	$effect(() => {
		if (page.url.pathname !== CREATOR_PATH) return;
		const search = page.url.search;
		if (search === lastWrittenSearch) return;
		const session = resolveCreatorSession(page.url.searchParams, savedLayouts);
		activeSavedId = session.savedId;
		applyCreatorSnapshot(session.snapshot);
		lastWrittenSearch = search;
	});

	function applyEmptyMappingDrafts() {
		magicDraft = createEmptyCreatorMagicDraft();
		adaptiveDraft = createEmptyCreatorAdaptiveDraft();
		disabledMappingIds = [];
	}

	function applySupplementalDrafts(name: string) {
		const seeded = creatorDraftsFromSupplemental(layoutsCatalog.supplemental, name);
		magicDraft = seeded.magicDraft;
		adaptiveDraft = seeded.adaptiveDraft;
		if (seeded.hasMagicMappings) includeMagicKey = true;
		if (seeded.hasMagicMappings) magicPanelOpen = true;
		if (seeded.hasAdaptiveMappings) {
			includeAdaptiveKey = true;
			adaptivePanelOpen = true;
		}
		disabledMappingIds = [];
	}

	async function selectBaseLayout(name: string) {
		const nextLayout = layoutsCatalog.layouts.find((candidate) => candidate.name === name);
		if (!nextLayout) return;
		const seed = ++baseLayoutSeed;
		keyConfig = createKeyboardInputConfigFromLayout(nextLayout);
		includeMagicKey = nextLayout.hasMagicKey;
		includeAdaptiveKey = nextLayout.hasAdaptiveSwap;
		magicPanelOpen = nextLayout.hasMagicKey;
		adaptivePanelOpen = nextLayout.hasAdaptiveSwap;
		applyEmptyMappingDrafts();
		await layoutsCatalog.ensureSupplementalLoaded();
		if (seed !== baseLayoutSeed || keyConfig.baseLayoutName !== name) return;
		applySupplementalDrafts(name);
	}

	function clearAllKeys() {
		baseLayoutSeed += 1;
		keyConfig = clearKeyboardInputConfig(keyConfig);
		includeMagicKey = false;
		includeAdaptiveKey = false;
		magicPanelOpen = false;
		adaptivePanelOpen = false;
		applyEmptyMappingDrafts();
	}

	function setKeyboardType(keyboardType: InputKeyboardType) {
		keyConfig = { ...keyConfig, keyboardType };
	}

	function setKeyConfig(nextConfig: KeyboardInputConfig) {
		const gainedTriggers = keyboardConfigGainedMagicTriggers(keyConfig, nextConfig);
		const replaceUnusedPlaceholder = !includeMagicKey && !keyboardConfigHasMagicTrigger(keyConfig);
		keyConfig = nextConfig;
		if (gainedTriggers.length === 0) return;

		let nextDraft = magicDraft;
		for (const trigger of gainedTriggers) {
			nextDraft = ensureCreatorMagicTrigger(nextDraft, trigger, { replaceUnusedPlaceholder });
		}
		if (nextDraft !== magicDraft) magicDraft = nextDraft;
		includeMagicKey = true;
		magicPanelOpen = true;
	}

	function toggleMagicKey() {
		if (magicPanelOpen) {
			magicPanelOpen = false;
			return;
		}
		includeMagicKey = true;
		magicPanelOpen = true;
		if (magicDraft.sections.length === 0) {
			magicDraft = createEmptyCreatorMagicDraft();
		}
	}

	function toggleAdaptiveKey() {
		if (adaptivePanelOpen) {
			adaptivePanelOpen = false;
			return;
		}
		includeAdaptiveKey = true;
		adaptivePanelOpen = true;
		if (
			includeAdaptiveKey &&
			adaptiveDraft.rules.length === 0 &&
			adaptiveDraft.groups.length === 0
		) {
			adaptiveDraft = createEmptyCreatorAdaptiveDraft();
		}
	}

	function setMagicDraft(next: CreatorMagicDraft) {
		magicDraft = next;
	}

	function setAdaptiveDraft(next: CreatorAdaptiveDraft) {
		adaptiveDraft = next;
	}

	function setLayoutName(name: string) {
		layoutNameDraft = name;
	}

	function setLayoutAuthor(author: string) {
		layoutAuthorDraft = author;
	}

	function toggleLayoutPreview() {
		if (layoutPreview) {
			layoutPreview = false;
			autofocusFirstKey = true;
			return;
		}
		layoutPreview = true;
		autofocusFirstKey = false;
	}

	function setActiveSection(section: LayoutDetailSection) {
		activeSection = parseCreatorDetailSection(section);
	}

	function setPracticeLesson(lesson: TypingPracticeLessonSettings) {
		practiceLesson = normalizeTypingPracticeLessonSettings(lesson);
	}

	function openSavedLayout(saved: SavedCreatorLayout) {
		activeSavedId = saved.id;
		applyCreatorSnapshot(snapshotForSavedLayoutView(saved.snapshot));
		activeSection = DEFAULT_LAYOUT_DETAIL_SECTION;
		flushCreatorUrl();
	}

	function changeCreatorTab(value: LayoutCreatorTabValue) {
		if (value === activeTab) return;
		if (value === LAYOUT_CREATOR_NEW_TAB) return;
		const saved = findSavedLayout(savedLayouts, value.slice('saved:'.length));
		if (!saved) return;
		if (hasUnsavedCreatorChanges) {
			pendingCreatorNavigation = {
				kind: 'saved',
				savedId: saved.id,
				destinationName: saved.name
			};
			return;
		}
		openSavedLayout(saved);
	}

	function saveCurrentLayout() {
		saveError = null;
		const snapshot = currentCreatorSnapshot();
		const input = { snapshot };
		const layouts = savedLayoutsForWrite();
		if (activeSavedId) {
			const next = updateSavedLayout(layouts, activeSavedId, input);
			if (!next) return;
			if (!commitSavedLayouts(next, activeSavedId)) return;
		} else {
			const result = addSavedLayout(layouts, input);
			if (!commitSavedLayouts(result.layouts, result.id)) return;
		}
		saveMenuOpen = false;
		flushCreatorUrl();
	}

	function saveAsNewLayout() {
		saveError = null;
		const snapshot = currentCreatorSnapshot();
		const result = addSavedLayout(savedLayoutsForWrite(), {
			snapshot
		});
		if (!commitSavedLayouts(result.layouts, result.id)) return;
		saveMenuOpen = false;
		flushCreatorUrl();
	}

	function duplicateSavedLayout() {
		saveError = null;
		const snapshot = cloneCreatorUrlSnapshot(currentCreatorSnapshot());
		const layouts = savedLayoutsForWrite();
		snapshot.name = nextDuplicatedLayoutName(
			savedCreatorLayoutName(snapshot),
			layouts.map((saved) => saved.name)
		);
		snapshot.preview = false;
		const result = addSavedLayout(layouts, {
			snapshot
		});
		if (!commitSavedLayouts(result.layouts, result.id)) return;
		applyCreatorSnapshot(snapshot);
		activeSection = DEFAULT_LAYOUT_DETAIL_SECTION;
		flushCreatorUrl();
	}

	function undoSavedLayoutChanges() {
		const saved = findSavedLayout(savedLayouts, activeSavedId);
		if (!saved) return;
		const next = creatorSnapshotFromContent(saved.snapshot, {
			preview: layoutPreview,
			section: parseCreatorDetailSection(activeSection)
		});
		applyCreatorSnapshot(next);
		saveMenuOpen = false;
		flushCreatorUrl();
	}

	function startNewLayoutNow() {
		activeSavedId = null;
		applyCreatorSnapshot(createDefaultCreatorUrlSnapshot());
		activeSection = DEFAULT_LAYOUT_DETAIL_SECTION;
		flushCreatorUrl();
		layoutNameFocusEpoch += 1;
	}

	function startNewLayout() {
		if (
			!activeSavedId &&
			creatorUrlSnapshotsEqual(currentCreatorSnapshot(), createDefaultCreatorUrlSnapshot())
		) {
			return;
		}
		if (hasUnsavedCreatorChanges) {
			pendingCreatorNavigation = { kind: 'new' };
			return;
		}
		startNewLayoutNow();
	}

	function focusSelectedCreatorTab() {
		requestAnimationFrame(() => {
			document
				.querySelector<HTMLElement>('.layout-creator-tabs [role="tab"][aria-selected="true"]')
				?.focus();
		});
	}

	function closeDiscardChangesModal() {
		pendingCreatorNavigation = null;
		focusSelectedCreatorTab();
	}

	function confirmDiscardChanges() {
		const navigation = pendingCreatorNavigation;
		pendingCreatorNavigation = null;
		if (!navigation) return;
		if (navigation.kind === 'new') {
			startNewLayoutNow();
			return;
		}
		const saved = findSavedLayout(savedLayouts, navigation.savedId);
		if (saved) openSavedLayout(saved);
		focusSelectedCreatorTab();
	}

	function requestDeleteSavedLayout(id: string, name: string) {
		deleteSavedLayoutId = id;
		deleteSavedLayoutName = name;
	}

	function closeDeleteSavedLayoutModal(restoreTabFocus = true) {
		deleteSavedLayoutId = null;
		deleteSavedLayoutName = '';
		if (restoreTabFocus) focusSelectedCreatorTab();
	}

	function handleSavedTabKeydown(
		event: KeyboardEvent,
		saved: SavedCreatorLayout,
		handleTabKeydown: (event: KeyboardEvent) => void
	) {
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			requestDeleteSavedLayout(saved.id, saved.id === activeSavedId ? layoutName : saved.name);
			return;
		}
		handleTabKeydown(event);
	}

	function confirmDeleteSavedLayout() {
		if (!deleteSavedLayoutId) return;
		const id = deleteSavedLayoutId;
		const wasActive = activeSavedId === id;
		const result = removeSavedLayout(savedLayoutsForWrite(), id);
		if (!result.removed) {
			closeDeleteSavedLayoutModal();
			return;
		}
		if (!persistSavedLayouts(result.layouts)) {
			saveError = 'Unable to delete this layout in your browser.';
			closeDeleteSavedLayoutModal();
			return;
		}
		savedLayouts = result.layouts;
		saveError = null;
		closeDeleteSavedLayoutModal(!wasActive);
		if (!wasActive) return;
		activeSavedId = null;
		applyCreatorSnapshot(createDefaultCreatorUrlSnapshot());
		flushCreatorUrl();
		layoutNameFocusEpoch += 1;
	}
</script>

<svelte:head>
	<title>{layoutName} · Emulayout</title>
</svelte:head>

<svelte:window onpagehide={flushCreatorUrl} onstorage={handleSavedLayoutsStorage} />

<div class="layout-creator">
	<div class="layout-creator-view-bar">
		<Tabs
			value={activeTab}
			onChange={changeCreatorTab}
			{options}
			ariaLabel="Layout creations"
			class="layout-creator-tabs"
		>
			{#snippet item({ option, selected, tabProps })}
				{@const saved = savedLayoutByValue.get(option.value)}
				{#if saved}
					<div class="layout-creator-saved" class:layout-creator-saved--selected={selected}>
						<button
							{...tabProps}
							aria-label={`${option.label}. Press Delete to delete this layout.`}
							onkeydown={(event) => handleSavedTabKeydown(event, saved, tabProps.onkeydown)}
							class="layout-creator-tab layout-creator-tab--saved"
							class:layout-creator-tab--selected={selected}
						>
							<span class="layout-creator-tab-label">{option.label}</span>
						</button>
						<!-- Pointer shortcut; the focused tab exposes the same action via Delete/Backspace. -->
						<span
							class="layout-creator-tab-delete"
							aria-hidden="true"
							title={`Delete layout ${saved.id === activeSavedId ? layoutName : saved.name}`}
							onclick={(event) => {
								event.stopPropagation();
								requestDeleteSavedLayout(
									saved.id,
									saved.id === activeSavedId ? layoutName : saved.name
								);
							}}
						>
							<svg
								class="layout-creator-tab-delete-icon"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</span>
					</div>
				{:else}
					<button
						{...tabProps}
						class="layout-creator-tab"
						class:layout-creator-tab--selected={selected}
					>
						{option.label}
					</button>
				{/if}
			{/snippet}
		</Tabs>
		{#if savedLayouts.length > 0}
			<button type="button" class="layout-creator-new" onclick={startNewLayout}>
				+ New layout
			</button>
		{/if}
		<LayoutBackupsMenu layouts={savedLayouts} onImport={importSavedLayoutBackup} />
	</div>

	<div id={PANEL_ID} class="layout-creator-panel" role="tabpanel" aria-labelledby={selectedTabId}>
		{#snippet creatorHeaderStart()}
			<div class="layout-creator-name">
				<label class="layout-creator-name-field">
					<span class="layout-creator-name-label">Layout name</span>
					<input
						{@attach !activeSavedId && focusNewLayoutName}
						type="text"
						value={layoutNameDraft}
						autocomplete="off"
						spellcheck="false"
						aria-label="Layout name"
						oninput={(event) => setLayoutName(event.currentTarget.value)}
					/>
				</label>
				<div class="layout-creator-name-field">
					<span class="layout-creator-name-label">Author name</span>
					<AuthorAutocomplete
						authors={authorNames}
						id="layout-creator-author"
						label="Author name"
						placeholder="Search or add author"
						selected={layoutAuthorDraft}
						onChange={setLayoutAuthor}
						onClear={() => setLayoutAuthor('')}
						loading={layoutsCatalog.loading && authorNames.length === 0}
					/>
				</div>
			</div>
		{/snippet}

		{#snippet creatorKeyboardLead()}
			<div class="layout-creator-keyboard-fields">
				<div class="layout-creator-keyboard-field">
					<span id="layout-creator-base-label">Base layout (optional)</span>
					<div class="layout-creator-base-row">
						<LayoutAutocomplete
							layouts={layoutsCatalog.layouts}
							preferredLayouts={['QWERTY']}
							id="layout-creator-base"
							label="Base layout (optional)"
							placeholder="Search layouts…"
							selected={keyConfig.baseLayoutName}
							onSelect={selectBaseLayout}
							onClear={clearAllKeys}
							loading={layoutsCatalog.loading && layoutsCatalog.layouts.length === 0}
						/>
						<button
							type="button"
							class="filter-reset-button layout-creator-import-button"
							aria-haspopup="dialog"
							onclick={() => (keyImportOpen = true)}
						>
							Import
						</button>
					</div>
					{#if layoutsCatalog.loadError && layoutsCatalog.layouts.length === 0}
						<p class="layout-creator-keyboard-error" role="alert">
							Unable to load the layout catalog.
						</p>
					{/if}
				</div>

				<label class="layout-creator-keyboard-field">
					<span>Keyboard type</span>
					<select
						value={keyConfig.keyboardType}
						onchange={(event) => setKeyboardType(event.currentTarget.value as InputKeyboardType)}
					>
						<option value="ortho">Ortho</option>
						<option value="staggered">Staggered</option>
					</select>
				</label>
			</div>
		{/snippet}

		{#snippet creatorKeyboard(presentation: LayoutKeyboardPresentation)}
			<KeyboardInputEditor
				config={keyConfig}
				showPlaceholders={false}
				ariaLabel="Layout keys"
				onConfigChange={setKeyConfig}
				feedback={presentation.feedback}
				swapPaths={presentation.swapPaths}
				highlightedKeys={presentation.highlightedKeys}
				unreachableKeys={presentation.unreachableKeys}
				highlightHomeKeys={presentation.highlightHomeKeys}
				autofocusFirst={autofocusFirstKey}
			/>
		{/snippet}

		{#snippet creatorAside()}
			<div class="layout-creator-special-keys" role="group" aria-label="Special keys">
				<button
					type="button"
					class="layout-creator-special-key"
					class:layout-creator-special-key--magic={magicIconActive}
					class:layout-creator-special-key--magic-data={magicIconHasData}
					aria-expanded={magicPanelOpen}
					aria-controls={MAGIC_MAPPINGS_PANEL_ID}
					aria-label={magicPanelOpen
						? 'Hide magic mappings'
						: includeMagicKey
							? 'Show magic mappings'
							: 'Add magic'}
					onclick={toggleMagicKey}
				>
					<span class="layout-creator-special-key__cap">
						<LayoutInputFeatureIcon feature="magic" />
					</span>
					<span class="layout-creator-special-key__label">Magic</span>
				</button>
				<button
					type="button"
					class="layout-creator-special-key"
					class:layout-creator-special-key--adaptive={adaptiveIconActive}
					class:layout-creator-special-key--adaptive-data={adaptiveIconHasData}
					aria-expanded={adaptivePanelOpen}
					aria-controls={ADAPTIVE_MAPPINGS_PANEL_ID}
					aria-label={adaptivePanelOpen
						? 'Hide adaptive mappings'
						: includeAdaptiveKey
							? 'Show adaptive mappings'
							: 'Add adaptive'}
					onclick={toggleAdaptiveKey}
				>
					<span class="layout-creator-special-key__cap">
						<LayoutInputFeatureIcon feature="adaptive" />
					</span>
					<span class="layout-creator-special-key__label">Adaptive</span>
				</button>
			</div>
		{/snippet}

		{#snippet creatorMappings()}
			{#if magicPanelOpen}
				<div id={MAGIC_MAPPINGS_PANEL_ID}>
					<CreatorMagicMappingsPanel
						draft={magicDraft}
						availableKeys={availableLayoutKeys}
						{disabledMappingIds}
						onDraftChange={setMagicDraft}
						onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
					/>
				</div>
			{/if}
			{#if adaptivePanelOpen}
				<div id={ADAPTIVE_MAPPINGS_PANEL_ID}>
					<CreatorAdaptiveMappingsPanel
						draft={adaptiveDraft}
						availableKeys={availableLayoutKeys}
						{disabledMappingIds}
						onDraftChange={setAdaptiveDraft}
						onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
					/>
				</div>
			{/if}
		{/snippet}

		{#snippet creatorKeyboardBelow()}
			{#if missingLetters.length > 0}
				<div class="layout-creator-missing-keys" role="status" data-creator-missing-mapping-keys>
					<Tooltip
						variant="caution"
						text="This layout is missing these letters. A Magic mapping can cover a letter if its trigger is on the keyboard and it emits that letter."
					/>
					<p>
						<span>Missing from this layout:</span>
						<span class="layout-creator-missing-keys__list">
							{#each missingLetters as key (key)}
								<kbd>{key}</kbd>
							{/each}
						</span>
					</p>
				</div>
			{/if}
		{/snippet}

		{#key activeTab}
			<LayoutExpandedView
				{layout}
				authorName={layoutAuthor}
				likeCount={0}
				{inputProfile}
				{disabledMappingIds}
				onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
				{activeSection}
				onActiveSectionChange={setActiveSection}
				{practiceLesson}
				onPracticeLessonChange={setPracticeLesson}
				localPreview
				statsUnavailableDetail={LOCAL_LAYOUT_STATS_UNAVAILABLE_DETAIL}
				hideSummary={!layoutPreview}
				keyboardHeaderStart={layoutPreview ? undefined : creatorHeaderStart}
				keyboard={layoutPreview ? undefined : creatorKeyboard}
				keyboardLead={layoutPreview ? undefined : creatorKeyboardLead}
				keyboardWidthTerms={layoutPreview ? undefined : editorWidthTerms}
				keyboardAside={layoutPreview ? undefined : creatorAside}
				keyboardBelow={layoutPreview ? undefined : creatorKeyboardBelow}
				keyboardMappings={layoutPreview ? undefined : creatorMappings}
				showKeyboardMappings={layoutPreview ? false : showEditorMappings}
				compactPractice={!layoutPreview}
			/>
		{/key}

		<div class="layout-creator-actions">
			{#if saveError}
				<p class="layout-creator-save-error" role="alert">{saveError}</p>
			{/if}
			<div class="layout-creator-actions-inner">
				<button
					type="button"
					class="filter-reset-button layout-creator-action-button"
					class:layout-creator-action-button--preview={layoutPreview}
					onclick={toggleLayoutPreview}
				>
					{#if layoutPreview}
						<svg
							class="layout-creator-action-icon"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
						</svg>
						Edit
					{:else}
						<svg
							class="layout-creator-action-icon"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
						Preview
					{/if}
				</button>
				<div class="layout-creator-save">
					{#if showUpdateSplit}
						<DropdownMenu
							bind:open={saveMenuOpen}
							placement="top-stretch"
							rootClass="layout-creator-split-button"
							menuLabel="More save options"
						>
							{#snippet trigger({ toggle, triggerProps })}
								<button
									type="button"
									class="filter-reset-button layout-creator-split-button-main"
									onclick={() => {
										saveMenuOpen = false;
										saveCurrentLayout();
									}}
								>
									Update layout
								</button>
								<button
									type="button"
									class="filter-reset-button layout-creator-split-button-toggle"
									aria-label="More save options"
									{...triggerProps}
									onclick={toggle}
								>
									<svg
										class="layout-creator-split-button-caret"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
										aria-hidden="true"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
									</svg>
								</button>
							{/snippet}
							{#snippet children({ close })}
								<button
									type="button"
									role="menuitem"
									class="layout-creator-split-menu-item"
									onclick={() => {
										close();
										saveAsNewLayout();
									}}
								>
									Save as new layout
								</button>
							{/snippet}
						</DropdownMenu>
						<button
							type="button"
							class="filter-reset-button layout-creator-action-button"
							onclick={undoSavedLayoutChanges}
						>
							Undo changes
						</button>
					{:else if showDuplicateButton}
						<button
							type="button"
							class="filter-reset-button layout-creator-action-button"
							onclick={duplicateSavedLayout}
						>
							Duplicate layout
						</button>
					{:else}
						<button
							type="button"
							class="filter-reset-button layout-creator-action-button"
							onclick={saveCurrentLayout}
						>
							Save layout
						</button>
						<button
							type="button"
							class="filter-reset-button layout-creator-action-button"
							disabled={!canClearNewLayout}
							onclick={clearAllKeys}
						>
							Clear all keys
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<LayoutKeyImportModal
	open={keyImportOpen}
	config={keyConfig}
	onClose={() => (keyImportOpen = false)}
	onImport={setKeyConfig}
/>

<DeleteSavedLayoutModal
	open={deleteSavedLayoutId !== null}
	layoutName={deleteSavedLayoutName}
	discardsUnsavedChanges={deleteDiscardsUnsavedChanges}
	onClose={closeDeleteSavedLayoutModal}
	onConfirm={confirmDeleteSavedLayout}
/>

<DiscardCreatorChangesModal
	open={pendingCreatorNavigation !== null}
	{layoutName}
	destination={discardDestination}
	onClose={closeDiscardChangesModal}
	onConfirm={confirmDiscardChanges}
/>

<style>
	.layout-creator {
		display: flex;
		flex-direction: column;
		min-width: 0;
		width: 100%;
	}

	.layout-creator-save-error {
		margin: 0 0 0.5rem;
		color: var(--keyboard-input-validation-error);
		font-size: 0.875rem;
		text-align: center;
	}

	.layout-creator-view-bar {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
		width: 100%;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
		padding: 0.125rem 0.25rem 0;
		box-sizing: border-box;
	}

	.layout-creator-view-bar :global(.layout-creator-tabs) {
		display: flex;
		align-items: stretch;
		gap: 0.25rem;
		flex: 1 1 auto;
		min-width: 0;
		width: auto;
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.layout-creator-view-bar :global(.layout-creator-tabs::-webkit-scrollbar) {
		display: none;
	}

	.layout-creator-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		flex: 0 0 auto;
		padding: 0.5rem 0.75rem;
		margin-bottom: -1px;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25;
		white-space: nowrap;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.layout-creator-tab--saved {
		padding-right: 0.25rem;
	}

	.layout-creator-saved {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
		margin-bottom: -1px;
		border-bottom: 2px solid transparent;
		min-width: 0;
	}

	.layout-creator-saved--selected {
		border-bottom-color: var(--accent);
	}

	.layout-creator-saved .layout-creator-tab {
		margin-bottom: 0;
		border-bottom: none;
	}

	.layout-creator-tab-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 10rem;
	}

	.layout-creator-tab-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-right: 0.25rem;
		padding: 0;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.layout-creator-tab-delete:hover {
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 10%, transparent);
	}

	.layout-creator-tab-delete:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.layout-creator-tab-delete-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	.layout-creator-tab:hover {
		color: var(--text-primary);
	}

	.layout-creator-tab:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 0.25rem;
	}

	.layout-creator-tab--selected {
		color: var(--text-primary);
		font-weight: 600;
		border-bottom-color: var(--accent);
	}

	.layout-creator-new {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		margin-bottom: -1px;
		padding: 0.5rem 0.75rem;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25;
		white-space: nowrap;
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.layout-creator-new:hover {
		color: var(--text-primary);
	}

	.layout-creator-new:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 0.25rem;
	}

	.layout-creator-panel {
		min-width: 0;
		padding: 0.5rem 0.25rem
			calc(var(--app-chrome-height) + 0.5rem + env(safe-area-inset-bottom, 0px));
	}

	.layout-creator-actions {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		height: calc(var(--app-chrome-height) + env(safe-area-inset-bottom, 0px));
		margin: 0;
		padding: 0 0.75rem env(safe-area-inset-bottom, 0px);
		border-top: 1px solid var(--border);
		background-color: var(--bg-primary);
	}

	.layout-creator-actions-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		max-width: 100%;
	}

	@media (min-width: 768px) {
		.layout-creator-actions {
			padding-right: 1.5rem;
			padding-left: 1.5rem;
		}
	}

	.layout-creator-save {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.layout-creator-action-button {
		gap: 0.375rem;
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.layout-creator-action-icon {
		width: 1rem;
		height: 1rem;
		flex: none;
	}

	.layout-creator-action-button--preview {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		color: var(--accent);
	}

	.layout-creator-save :global(.layout-creator-split-button) {
		position: relative;
		display: flex;
		align-items: stretch;
	}

	.layout-creator-split-button-main,
	.layout-creator-split-button-toggle {
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.layout-creator-split-button-main {
		justify-content: center;
		border-radius: 0.75rem 0 0 0.75rem;
		border-right-width: 0;
	}

	.layout-creator-split-button-toggle {
		flex: 0 0 auto;
		width: 2.25rem;
		padding-left: 0;
		padding-right: 0;
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.layout-creator-split-button-caret {
		width: 0.875rem;
		height: 0.875rem;
	}

	.layout-creator-split-menu-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}

	.layout-creator-split-menu-item:hover {
		background-color: color-mix(in srgb, var(--filter-action) 12%, var(--bg-primary));
	}

	.layout-creator-split-menu-item:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--filter-action);
	}

	.layout-creator-name {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
	}

	.layout-creator-name-field {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.375rem;
	}

	.layout-creator-name-label {
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.layout-creator-name-field input {
		width: 100%;
		height: 2.375rem;
		padding: 0 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		outline: none;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.layout-creator-name-field input:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.layout-creator-keyboard-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(10rem, 0.45fr);
		gap: 0.75rem;
		align-items: start;
	}

	.layout-creator-keyboard-field {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.375rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.layout-creator-base-row {
		display: flex;
		min-width: 0;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.layout-creator-base-row :global(.text-autocomplete) {
		flex: 1;
	}

	.layout-creator-import-button {
		flex: none;
		height: 2.375rem;
		padding: 0 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.layout-creator-keyboard-field select {
		width: 100%;
		height: 2.375rem;
		padding: 0 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		outline: none;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 400;
		cursor: pointer;
	}

	.layout-creator-keyboard-field select:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.layout-creator-keyboard-error {
		margin: 0;
		color: var(--keyboard-input-validation-error);
		font-size: 0.875rem;
	}

	.layout-creator-special-keys {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 1rem;
	}

	.layout-creator-special-key {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.layout-creator-special-key__cap {
		display: inline-flex;
		width: var(--keyboard-preview-key-size, 3.35rem);
		height: var(--keyboard-preview-key-size, 3.35rem);
		flex: none;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 0.45rem;
		background: var(--bg-primary);
		color: var(--text-primary);
		box-shadow: 0 2px 0 color-mix(in srgb, var(--border) 80%, black);
	}

	.layout-creator-special-key__cap :global(svg) {
		width: 1.35rem;
		height: 1.35rem;
	}

	.layout-creator-special-key__label {
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;
	}

	.layout-creator-special-key:hover .layout-creator-special-key__cap {
		border-color: color-mix(in srgb, var(--text-secondary) 55%, var(--border));
	}

	.layout-creator-special-key:focus-visible {
		outline: none;
	}

	.layout-creator-special-key:focus-visible .layout-creator-special-key__cap {
		border-color: var(--accent);
		box-shadow:
			0 2px 0 color-mix(in srgb, var(--border) 80%, black),
			0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.layout-creator-special-key--magic {
		color: var(--magic-key);
	}

	.layout-creator-special-key--magic .layout-creator-special-key__cap {
		border-color: color-mix(in srgb, var(--magic-key) 70%, black);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--magic-key) 82%, white) 0%,
			var(--magic-key) 100%
		);
		color: var(--magic-key-fg);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 22%, transparent),
			0 2px 0 color-mix(in srgb, var(--magic-key) 62%, black);
	}

	.layout-creator-special-key--magic-data {
		color: var(--magic-key);
	}

	.layout-creator-special-key--magic-data .layout-creator-special-key__cap {
		color: var(--magic-key);
		border-color: color-mix(in srgb, var(--magic-key) 40%, var(--border));
	}

	.layout-creator-special-key--magic-data:hover .layout-creator-special-key__cap {
		border-color: color-mix(in srgb, var(--magic-key) 55%, var(--border));
	}

	.layout-creator-special-key--adaptive {
		color: var(--adaptive-key);
	}

	.layout-creator-special-key--adaptive .layout-creator-special-key__cap {
		border-color: color-mix(in srgb, var(--adaptive-key) 70%, black);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--adaptive-key) 82%, white) 0%,
			var(--adaptive-key) 100%
		);
		color: var(--adaptive-key-fg);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 22%, transparent),
			0 2px 0 color-mix(in srgb, var(--adaptive-key) 62%, black);
	}

	.layout-creator-special-key--adaptive-data {
		color: var(--adaptive-key);
	}

	.layout-creator-special-key--adaptive-data .layout-creator-special-key__cap {
		color: var(--adaptive-key);
		border-color: color-mix(in srgb, var(--adaptive-key) 40%, var(--border));
	}

	.layout-creator-special-key--adaptive-data:hover .layout-creator-special-key__cap {
		border-color: color-mix(in srgb, var(--adaptive-key) 55%, var(--border));
	}

	.layout-creator-missing-keys {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		min-width: 0;
		max-width: 100%;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.layout-creator-missing-keys p {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.35rem;
		min-width: 0;
		flex: 1 1 auto;
		margin: 0;
	}

	.layout-creator-missing-keys__list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-width: 0;
		flex: 1 1 8rem;
	}

	.layout-creator-missing-keys kbd {
		display: inline-flex;
		min-width: 1.35rem;
		min-height: 1.35rem;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0.3rem;
		border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--border));
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--warning) 12%, var(--bg-primary));
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
	}

	@media (max-width: 40rem) {
		.layout-creator-keyboard-fields {
			grid-template-columns: 1fr;
		}

		.layout-creator-special-keys {
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: center;
		}
	}
</style>
