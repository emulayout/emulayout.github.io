<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PathnameWithSearchOrHash } from '$app/types';
	import CreatorAdaptiveMappingsPanel from '$lib/components/CreatorAdaptiveMappingsPanel.svelte';
	import CreatorMagicMappingsPanel from '$lib/components/CreatorMagicMappingsPanel.svelte';
	import DropdownMenu from '$lib/components/DropdownMenu.svelte';
	import KeyboardInputEditor from '$lib/components/KeyboardInputEditor.svelte';
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import LayoutInputFeatureIcon from '$lib/components/LayoutInputFeatureIcon.svelte';
	import LayoutTypingPractice from '$lib/components/LayoutTypingPractice.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import {
		createHistoryTarget,
		isRouterNotReadyError,
		shouldWriteHistory
	} from '$lib/filterNavigation';
	import {
		clearKeyboardInputConfig,
		createKeyboardInputConfigFromLayout,
		type InputKeyboardType,
		type KeyboardInputConfig
	} from '$lib/keyboardInputConfig';
	import {
		LAYOUT_CREATOR_NEW_LAYOUT_NAME,
		LAYOUT_CREATOR_NEW_TAB,
		createLayoutFromKeyConfig,
		keyboardConfigGainedMagicTriggers,
		keyboardConfigHasMagicKey,
		removeMagicKeysFromConfig,
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
		ensureCreatorMagicTrigger,
		type CreatorAdaptiveDraft,
		type CreatorMagicDraft
	} from '$lib/layoutCreatorMappings';
	import {
		addSavedLayout,
		findSavedLayout,
		isSavedLayoutDirty,
		loadSavedLayouts,
		persistSavedLayouts,
		resolveCreatorSession,
		savedCreatorLayoutName,
		updateSavedLayout,
		type SavedCreatorLayout
	} from '$lib/layoutCreatorStorage';
	import {
		cloneCreatorUrlSnapshot,
		createDefaultCreatorUrlSnapshot,
		creatorSearchFromSnapshot,
		creatorUrlSnapshotsEqual,
		type CreatorUrlSnapshot
	} from '$lib/layoutCreatorUrl';
	import {
		normalizeTypingPracticeLessonSettings,
		type TypingPracticeLessonSettings
	} from '$lib/typingPracticeText';
	import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
	import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import type { TabOption } from '$lib/tabs';

	const NEW_TAB_ID = 'layout-creator-tab-new';
	const PANEL_ID = 'layout-creator-panel';
	const CREATOR_PATH = resolve('/create');
	const CREATOR_URL_DEBOUNCE_MS = 300;
	const initialLayouts = loadSavedLayouts();
	const initialSession = resolveCreatorSession(page.url.searchParams, initialLayouts);

	let savedLayouts = $state.raw<SavedCreatorLayout[]>(initialLayouts);
	let activeSavedId = $state<string | null>(initialSession.savedId);
	let layoutNameDraft = $state(initialSession.snapshot.name);
	let layoutPreview = $state(initialSession.snapshot.preview);
	let disabledMappingIds = $state<string[]>([]);
	let includeMagicKey = $state(initialSession.snapshot.includeMagicKey);
	let includeAdaptiveKey = $state(initialSession.snapshot.includeAdaptiveKey);
	let magicDraft = $state.raw(initialSession.snapshot.magicDraft);
	let adaptiveDraft = $state.raw(initialSession.snapshot.adaptiveDraft);
	let keyConfig = $state.raw(initialSession.snapshot.keyConfig);
	let practiceLesson = $state.raw(initialSession.snapshot.practiceLesson);
	let saveMenuOpen = $state(false);
	let pendingHistoryRetry = false;
	let urlSyncTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastWrittenSearch = page.url.search;
	const layoutName = $derived(layoutNameDraft.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME);
	const activeSavedLayout = $derived(findSavedLayout(savedLayouts, activeSavedId));
	const activeTab = $derived<LayoutCreatorTabValue>(
		activeSavedId ? savedCreatorTabValue(activeSavedId) : LAYOUT_CREATOR_NEW_TAB
	);
	const selectedTabId = $derived(activeSavedId ? savedCreatorTabId(activeSavedId) : NEW_TAB_ID);
	const magicKeyEnabled = $derived(includeMagicKey || keyboardConfigHasMagicKey(keyConfig));
	const magicDraftHasMappings = $derived(creatorMagicDraftHasMappings(magicDraft));
	const adaptiveDraftHasMappings = $derived(creatorAdaptiveDraftHasMappings(adaptiveDraft));
	const magicIconActive = $derived(
		magicKeyEnabled && creatorMagicDraftHasEnabledMappings(magicDraft, disabledMappingIds)
	);
	const adaptiveIconActive = $derived(
		includeAdaptiveKey && creatorAdaptiveDraftHasEnabledMappings(adaptiveDraft, disabledMappingIds)
	);
	const magicIconHasData = $derived(!magicKeyEnabled && magicDraftHasMappings);
	const adaptiveIconHasData = $derived(!includeAdaptiveKey && adaptiveDraftHasMappings);
	const practiceMagicEnabled = $derived(layoutPreview ? magicDraftHasMappings : magicKeyEnabled);
	const practiceAdaptiveEnabled = $derived(
		layoutPreview ? adaptiveDraftHasMappings : includeAdaptiveKey
	);
	const layout = $derived(
		createLayoutFromKeyConfig(keyConfig, {
			name: layoutName,
			magicKey: practiceMagicEnabled,
			adaptiveKey: practiceAdaptiveEnabled
		})
	);
	const inputProfile = $derived(
		compileCreatorInputProfile(
			practiceMagicEnabled,
			magicDraft,
			practiceAdaptiveEnabled,
			adaptiveDraft
		)
	);
	const showEditorMappings = $derived(magicKeyEnabled || includeAdaptiveKey);
	const showPreviewMappings = $derived(magicDraftHasMappings || adaptiveDraftHasMappings);
	const displayRows = $derived(computeDisplayRows(layout));
	const displayValue = $derived(displayRowsToString(displayRows));
	const testKeyMaps = $derived(
		createLayoutTestKeyMaps(displayValue, { layout, rows: displayRows })
	);
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
			preview: layoutPreview,
			includeMagicKey,
			includeAdaptiveKey,
			magicDraft,
			adaptiveDraft,
			keyConfig,
			practiceLesson
		};
	}

	const isActiveSavedDirty = $derived(
		isSavedLayoutDirty(currentCreatorSnapshot(), activeSavedLayout)
	);
	const showUpdateSplit = $derived(Boolean(activeSavedId && isActiveSavedDirty));
	const showDuplicateButton = $derived(Boolean(activeSavedId && !isActiveSavedDirty));

	$effect(() => {
		if (!showUpdateSplit) saveMenuOpen = false;
	});

	function applyCreatorSnapshot(snapshot: CreatorUrlSnapshot) {
		const next = cloneCreatorUrlSnapshot(snapshot);
		layoutNameDraft = next.name;
		layoutPreview = next.preview;
		includeMagicKey = next.includeMagicKey;
		includeAdaptiveKey = next.includeAdaptiveKey;
		magicDraft = next.magicDraft;
		adaptiveDraft = next.adaptiveDraft;
		keyConfig = next.keyConfig;
		practiceLesson = next.practiceLesson;
		disabledMappingIds = [];
	}

	function commitSavedLayouts(layouts: SavedCreatorLayout[], id: string) {
		savedLayouts = layouts;
		persistSavedLayouts(layouts);
		activeSavedId = id;
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
		savedSnapshot: CreatorUrlSnapshot | null
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
		if (seeded.hasAdaptiveMappings) includeAdaptiveKey = true;
		disabledMappingIds = [];
	}

	async function selectBaseLayout(name: string) {
		const nextLayout = layoutsCatalog.layouts.find((candidate) => candidate.name === name);
		if (!nextLayout) return;
		const seed = ++baseLayoutSeed;
		keyConfig = createKeyboardInputConfigFromLayout(nextLayout);
		includeMagicKey = nextLayout.hasMagicKey;
		includeAdaptiveKey = nextLayout.hasAdaptiveSwap;
		applyEmptyMappingDrafts();
		await layoutsCatalog.ensureSupplementalLoaded();
		if (seed !== baseLayoutSeed || keyConfig.baseLayoutName !== name) return;
		applySupplementalDrafts(name);
	}

	function clearBaseLayout() {
		baseLayoutSeed += 1;
		keyConfig = clearKeyboardInputConfig(keyConfig);
		includeMagicKey = false;
		includeAdaptiveKey = false;
		applyEmptyMappingDrafts();
	}

	function setKeyboardType(keyboardType: InputKeyboardType) {
		keyConfig = { ...keyConfig, keyboardType };
	}

	function setKeyConfig(nextConfig: KeyboardInputConfig) {
		const gainedTriggers = keyboardConfigGainedMagicTriggers(keyConfig, nextConfig);
		const replaceUnusedPlaceholder = !includeMagicKey && !keyboardConfigHasMagicKey(keyConfig);
		keyConfig = nextConfig;
		if (gainedTriggers.length === 0) return;

		let nextDraft = magicDraft;
		for (const trigger of gainedTriggers) {
			nextDraft = ensureCreatorMagicTrigger(nextDraft, trigger, { replaceUnusedPlaceholder });
		}
		if (nextDraft !== magicDraft) magicDraft = nextDraft;
		includeMagicKey = true;
	}

	function toggleMagicKey() {
		if (magicKeyEnabled) {
			includeMagicKey = false;
			keyConfig = removeMagicKeysFromConfig(keyConfig);
			return;
		}
		includeMagicKey = true;
		if (magicDraft.sections.length === 0) {
			magicDraft = createEmptyCreatorMagicDraft();
		}
	}

	function toggleAdaptiveKey() {
		includeAdaptiveKey = !includeAdaptiveKey;
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

	function toggleLayoutPreview() {
		layoutPreview = !layoutPreview;
	}

	function setPracticeLesson(lesson: TypingPracticeLessonSettings) {
		practiceLesson = normalizeTypingPracticeLessonSettings(lesson);
	}

	function changeCreatorTab(value: LayoutCreatorTabValue) {
		if (value === activeTab) return;
		if (value === LAYOUT_CREATOR_NEW_TAB) return;
		const saved = findSavedLayout(savedLayouts, value.slice('saved:'.length));
		if (!saved) return;
		activeSavedId = saved.id;
		applyCreatorSnapshot(saved.snapshot);
		flushCreatorUrl();
	}

	function saveCurrentLayout() {
		const snapshot = currentCreatorSnapshot();
		const input = { name: savedCreatorLayoutName(snapshot), snapshot };
		if (activeSavedId) {
			const next = updateSavedLayout(savedLayouts, activeSavedId, input);
			if (!next) return;
			commitSavedLayouts(next, activeSavedId);
		} else {
			const result = addSavedLayout(savedLayouts, input);
			commitSavedLayouts(result.layouts, result.id);
		}
		saveMenuOpen = false;
		flushCreatorUrl();
	}

	function saveAsNewLayout() {
		const snapshot = currentCreatorSnapshot();
		const result = addSavedLayout(savedLayouts, {
			name: savedCreatorLayoutName(snapshot),
			snapshot
		});
		commitSavedLayouts(result.layouts, result.id);
		saveMenuOpen = false;
		flushCreatorUrl();
	}

	function startNewLayout() {
		if (
			!activeSavedId &&
			creatorUrlSnapshotsEqual(currentCreatorSnapshot(), createDefaultCreatorUrlSnapshot())
		) {
			return;
		}
		activeSavedId = null;
		applyCreatorSnapshot(createDefaultCreatorUrlSnapshot());
		flushCreatorUrl();
	}
</script>

<svelte:head>
	<title>{layoutName} · Emulayout</title>
</svelte:head>

<svelte:window onpagehide={flushCreatorUrl} />

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
				<button
					{...tabProps}
					class="layout-creator-tab"
					class:layout-creator-tab--selected={selected}
				>
					{option.label}
				</button>
			{/snippet}
		</Tabs>
		<button type="button" class="layout-creator-new" onclick={startNewLayout}>
			+ New layout
		</button>
	</div>

	<div id={PANEL_ID} class="layout-creator-panel" role="tabpanel" aria-labelledby={selectedTabId}>
		{#snippet creatorHeaderStart()}
			<div class="layout-creator-name">
				{#if layoutPreview}
					<h2 class="layout-creator-name-title">{layoutName}</h2>
				{:else}
					<label class="layout-creator-name-field">
						<span class="layout-creator-name-label">Layout name</span>
						<input
							type="text"
							value={layoutNameDraft}
							autocomplete="off"
							spellcheck="false"
							aria-label="Layout name"
							oninput={(event) => setLayoutName(event.currentTarget.value)}
						/>
					</label>
				{/if}
			</div>
		{/snippet}

		{#snippet creatorKeyboard()}
			<div class="layout-creator-keyboard">
				<div class="layout-creator-keyboard-fields">
					<div class="layout-creator-keyboard-field">
						<span id="layout-creator-base-label">Base layout (optional)</span>
						<LayoutAutocomplete
							layouts={layoutsCatalog.layouts}
							id="layout-creator-base"
							label="Base layout (optional)"
							placeholder="Search layouts…"
							selected={keyConfig.baseLayoutName}
							onSelect={selectBaseLayout}
							onClear={clearBaseLayout}
							loading={layoutsCatalog.loading && layoutsCatalog.layouts.length === 0}
						/>
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

				<KeyboardInputEditor
					config={keyConfig}
					showPlaceholders={false}
					ariaLabel="Layout keys"
					onConfigChange={setKeyConfig}
				/>
			</div>
		{/snippet}

		{#snippet creatorAside()}
			<div class="layout-creator-special-keys" role="group" aria-label="Special keys">
				<button
					type="button"
					class="layout-creator-special-key"
					class:layout-creator-special-key--magic={magicIconActive}
					class:layout-creator-special-key--magic-data={magicIconHasData}
					aria-pressed={magicKeyEnabled}
					aria-label={magicKeyEnabled ? 'Remove magic' : 'Add magic'}
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
					aria-pressed={includeAdaptiveKey}
					aria-label={includeAdaptiveKey ? 'Remove adaptive' : 'Add adaptive'}
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
			{#if magicKeyEnabled}
				<CreatorMagicMappingsPanel
					draft={magicDraft}
					{disabledMappingIds}
					onDraftChange={setMagicDraft}
					onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
				/>
			{/if}
			{#if includeAdaptiveKey}
				<CreatorAdaptiveMappingsPanel
					draft={adaptiveDraft}
					{disabledMappingIds}
					onDraftChange={setAdaptiveDraft}
					onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
				/>
			{/if}
		{/snippet}

		{#key activeTab}
			<LayoutTypingPractice
				{layout}
				rows={displayRows}
				keyMaps={testKeyMaps}
				{inputProfile}
				{disabledMappingIds}
				onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
				showKeyboardMappings={layoutPreview ? showPreviewMappings : showEditorMappings}
				{practiceLesson}
				onPracticeLessonChange={setPracticeLesson}
				keyboardHeaderStart={creatorHeaderStart}
				keyboard={layoutPreview ? undefined : creatorKeyboard}
				keyboardAside={layoutPreview ? undefined : creatorAside}
				keyboardMappings={layoutPreview ? undefined : creatorMappings}
			/>
		{/key}

		<div class="layout-creator-actions">
			<div class="layout-creator-actions-inner">
				<button
					type="button"
					class="filter-reset-button layout-creator-action-button"
					class:layout-creator-action-button--preview={layoutPreview}
					aria-pressed={layoutPreview}
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
					{:else if showDuplicateButton}
						<button
							type="button"
							class="filter-reset-button layout-creator-action-button"
							onclick={saveAsNewLayout}
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
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.layout-creator {
		display: flex;
		flex-direction: column;
		min-width: 0;
		width: 100%;
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
		display: flex;
		min-width: 0;
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

	.layout-creator-name-title {
		min-width: 0;
		flex: 1;
		margin: 0;
		color: var(--text-primary);
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.layout-creator-keyboard {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.75rem;
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
		justify-content: center;
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
