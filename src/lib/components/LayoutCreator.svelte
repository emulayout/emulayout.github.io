<script lang="ts">
	import CreatorAdaptiveMappingsPanel from '$lib/components/CreatorAdaptiveMappingsPanel.svelte';
	import CreatorMagicMappingsPanel from '$lib/components/CreatorMagicMappingsPanel.svelte';
	import KeyboardInputEditor from '$lib/components/KeyboardInputEditor.svelte';
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import LayoutInputFeatureIcon from '$lib/components/LayoutInputFeatureIcon.svelte';
	import LayoutTypingPractice from '$lib/components/LayoutTypingPractice.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import {
		clearKeyboardInputConfig,
		createDefaultKeyboardInputConfig,
		createKeyboardInputConfigFromLayout,
		type InputKeyboardType,
		type KeyboardInputConfig
	} from '$lib/keyboardInputConfig';
	import {
		LAYOUT_CREATOR_NEW_LAYOUT_NAME,
		LAYOUT_CREATOR_NEW_TAB,
		createLayoutFromKeyConfig,
		keyboardConfigHasMagicKey,
		removeMagicKeysFromConfig,
		type LayoutCreatorTabValue
	} from '$lib/layoutCreator';
	import {
		compileCreatorInputProfile,
		createEmptyCreatorAdaptiveDraft,
		createEmptyCreatorMagicDraft,
		creatorDraftsFromSupplemental,
		type CreatorAdaptiveDraft,
		type CreatorMagicDraft
	} from '$lib/layoutCreatorMappings';
	import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
	import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import type { TabOption } from '$lib/tabs';

	const NEW_TAB_ID = 'layout-creator-tab-new';
	const PANEL_ID = 'layout-creator-panel';

	let activeTab = $state<LayoutCreatorTabValue>(LAYOUT_CREATOR_NEW_TAB);
	let layoutNameDraft = $state(LAYOUT_CREATOR_NEW_LAYOUT_NAME);
	let layoutLocked = $state(false);
	let disabledMappingIds = $state<string[]>([]);
	let includeMagicKey = $state(false);
	let includeAdaptiveKey = $state(false);
	let magicDraft = $state.raw(createEmptyCreatorMagicDraft());
	let adaptiveDraft = $state.raw(createEmptyCreatorAdaptiveDraft());
	let keyConfig = $state.raw(createDefaultKeyboardInputConfig());
	const layoutName = $derived(layoutNameDraft.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME);
	const layout = $derived(
		createLayoutFromKeyConfig(keyConfig, {
			name: layoutName,
			magicKey: includeMagicKey,
			adaptiveKey: includeAdaptiveKey
		})
	);
	const magicKeyEnabled = $derived(includeMagicKey || keyboardConfigHasMagicKey(keyConfig));
	const inputProfile = $derived(
		compileCreatorInputProfile(magicKeyEnabled, magicDraft, includeAdaptiveKey, adaptiveDraft)
	);
	const showKeyboardMappings = $derived(magicKeyEnabled || includeAdaptiveKey);
	const displayRows = $derived(computeDisplayRows(layout));
	const displayValue = $derived(displayRowsToString(displayRows));
	const testKeyMaps = $derived(
		createLayoutTestKeyMaps(displayValue, { layout, rows: displayRows })
	);
	const options: TabOption<LayoutCreatorTabValue>[] = [
		{
			value: LAYOUT_CREATOR_NEW_TAB,
			label: LAYOUT_CREATOR_NEW_LAYOUT_NAME,
			id: NEW_TAB_ID,
			controls: PANEL_ID
		}
	];

	let baseLayoutSeed = 0;

	$effect(() => {
		void layoutsCatalog.ensureLoaded();
		void layoutsCatalog.ensureSupplementalLoaded();
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
		keyConfig = nextConfig;
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

	function toggleLayoutLocked() {
		layoutLocked = !layoutLocked;
	}
</script>

<div class="layout-creator">
	<div class="layout-creator-view-bar">
		<Tabs
			value={activeTab}
			onChange={(value) => (activeTab = value)}
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
	</div>

	<div id={PANEL_ID} class="layout-creator-panel" role="tabpanel" aria-labelledby={NEW_TAB_ID}>
		{#snippet creatorHeaderStart()}
			<div class="layout-creator-name" class:layout-creator-name--locked={layoutLocked}>
				{#if layoutLocked}
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
				<button
					type="button"
					class="layout-creator-lock"
					class:layout-creator-lock--locked={layoutLocked}
					aria-pressed={layoutLocked}
					aria-label={layoutLocked ? 'Unlock layout' : 'Lock layout'}
					onclick={toggleLayoutLocked}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						{#if layoutLocked}
							<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						{:else}
							<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 9.9-1" />
						{/if}
					</svg>
				</button>
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
					class:layout-creator-special-key--magic={magicKeyEnabled}
					aria-pressed={magicKeyEnabled}
					aria-label={magicKeyEnabled ? 'Remove magic key' : 'Add magic key'}
					onclick={toggleMagicKey}
				>
					<span class="layout-creator-special-key__cap">
						<LayoutInputFeatureIcon feature="magic" />
					</span>
					<span class="layout-creator-special-key__label">Magic key</span>
				</button>
				<button
					type="button"
					class="layout-creator-special-key"
					class:layout-creator-special-key--adaptive={includeAdaptiveKey}
					aria-pressed={includeAdaptiveKey}
					aria-label={includeAdaptiveKey ? 'Remove adaptive key' : 'Add adaptive key'}
					onclick={toggleAdaptiveKey}
				>
					<span class="layout-creator-special-key__cap">
						<LayoutInputFeatureIcon feature="adaptive" />
					</span>
					<span class="layout-creator-special-key__label">Adaptive key</span>
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

		<LayoutTypingPractice
			{layout}
			rows={displayRows}
			keyMaps={testKeyMaps}
			{inputProfile}
			{disabledMappingIds}
			onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
			showKeyboardMappings={!layoutLocked && showKeyboardMappings}
			keyboardHeaderStart={creatorHeaderStart}
			keyboard={layoutLocked ? undefined : creatorKeyboard}
			keyboardAside={layoutLocked ? undefined : creatorAside}
			keyboardMappings={layoutLocked ? undefined : creatorMappings}
		/>
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
		min-width: 0;
		width: 100%;
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

	.layout-creator-panel {
		min-width: 0;
		padding: 0.5rem 0.25rem 2rem;
	}

	.layout-creator-name {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		min-width: 0;
	}

	.layout-creator-name--locked {
		align-items: center;
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

	.layout-creator-lock {
		display: inline-flex;
		width: 2.375rem;
		height: 2.375rem;
		flex: none;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: var(--input-bg);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.layout-creator-lock svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.layout-creator-lock:hover {
		color: var(--text-primary);
		border-color: color-mix(in srgb, var(--text-secondary) 55%, var(--border));
	}

	.layout-creator-lock:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.layout-creator-lock--locked {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
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
		gap: var(--keyboard-preview-key-gap, 0.45rem);
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

	.layout-creator-special-key--adaptive {
		color: var(--accent);
	}

	.layout-creator-special-key--adaptive .layout-creator-special-key__cap {
		border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--accent) 35%, var(--bg-primary)) 0%,
			color-mix(in srgb, var(--accent) 20%, var(--bg-primary)) 100%
		);
		color: var(--accent);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 20%, transparent),
			0 2px 0 color-mix(in srgb, var(--accent) 42%, black);
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
