<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import type { LayoutData } from '$lib/layout';
	import { resolveLayoutDetailStats, type LayoutDetailStats } from '$lib/layoutDetails';
	import {
		decodeCyanophageStats,
		decodeMana2Stats,
		decodeCminiStats,
		deriveBotStats,
		deriveCyanophageStats,
		deriveMana2Stats
	} from '$lib/statsDerivation';
	import {
		CYANOPHAGE_ANALYZER,
		CMINI_ANALYZER,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		getCyanophageStatsUnavailableReason,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { buildExpandedStatsTables, type ExpandedStatsRow } from '$lib/layoutExpandedStats';
	import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import InputMappingsPanel from '$lib/components/InputMappingsPanel.svelte';
	import CorpusTabs from '$lib/components/CorpusTabs.svelte';
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import LayoutExpandUniqueStats from '$lib/components/LayoutExpandUniqueStats.svelte';
	import LayoutKeyboardPreview from '$lib/components/LayoutKeyboardPreview.svelte';
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import LayoutTypingPractice from '$lib/components/LayoutTypingPractice.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import type { TabOption } from '$lib/tabs';
	import {
		applyAnglemodToDisplayRows,
		computeDisplayRows,
		displayRowsToString,
		removeAnglemodFromDisplayRows,
		type DisplayCell
	} from '$lib/layoutDisplay';
	import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import {
		buildAdaptiveKeyboardSwapPaths,
		buildLayoutKeyboardFeedback
	} from '$lib/layoutKeyboardFeedback';
	import { createColemakCampURLFromKeyMap } from '$lib/colemakCamp';
	import { buildCyanophagePlaygroundUrl } from '$lib/cyanophage';
	import { repeatKeyMappingId } from '$lib/inputMappingControls';
	import type { LayoutDetailSection } from '$lib/layoutDetailTabs';
	import { uiPrefs } from '$lib/uiPrefs.svelte';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		onBackToLayouts?: (event: MouseEvent) => void;
		detailStats?: LayoutDetailStats;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		activeSection: LayoutDetailSection;
		onActiveSectionChange: (section: LayoutDetailSection) => void;
		customPracticeText?: string | null;
		onCustomPracticeTextChange?: (text: string | null) => void;
	}

	const {
		layout,
		authorName,
		likeCount,
		onBackToLayouts,
		detailStats = {},
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		activeSection,
		onActiveSectionChange,
		customPracticeText = null,
		onCustomPracticeTextChange
	}: Props = $props();

	const cminiLabel =
		STAT_ANALYZERS.find((analyzer) => analyzer.value === CMINI_ANALYZER)?.label ?? 'cmini';
	const cminiTableLabel = 'cmini';
	const cyanophageLabel =
		STAT_ANALYZERS.find((analyzer) => analyzer.value === CYANOPHAGE_ANALYZER)?.label ??
		'Cyanophage';
	const mana2Label =
		STAT_ANALYZERS.find((analyzer) => analyzer.value === MANA2_ANALYZER)?.label ?? 'Mana2';

	let showCmini = $state(false);
	let showCyanophage = $state(false);
	let showMana2 = $state(false);
	let analyzerPrefsInitialized = $state(false);
	let summaryStatsAnalyzer = $state<StatsAnalyzer>(CMINI_ANALYZER);
	let anglemodTransformActive = $state(false);
	let previewContextualKeyOutput = $state(true);
	let showAdaptiveSwapPaths = $state(false);
	let layoutInputHistory = $state('');
	const titleId = $derived(`layout-expand-title-${layout.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
	const practiceTabId = $derived(`${titleId}-tab-practice`);
	const testTabId = $derived(`${titleId}-tab-test`);
	const statsTabId = $derived(`${titleId}-tab-stats`);
	const practicePanelId = $derived(`${titleId}-panel-practice`);
	const testPanelId = $derived(`${titleId}-panel-test`);
	const statsPanelId = $derived(`${titleId}-panel-stats`);
	const sections = $derived<TabOption<LayoutDetailSection>[]>([
		{
			value: 'practice',
			label: 'Typing practice',
			id: practiceTabId,
			controls: practicePanelId
		},
		{ value: 'test', label: 'Test area', id: testTabId, controls: testPanelId },
		{ value: 'stats', label: 'Stats', id: statsTabId, controls: statsPanelId }
	]);
	const isAngleBoard = $derived(layout.board === 'angle');
	const baseDisplayRows = $derived(computeDisplayRows(layout));
	const displayRows = $derived.by((): DisplayCell[][] => {
		if (!anglemodTransformActive) return baseDisplayRows;
		return isAngleBoard
			? removeAnglemodFromDisplayRows(baseDisplayRows)
			: applyAnglemodToDisplayRows(baseDisplayRows);
	});
	const displayValue = $derived(displayRowsToString(displayRows));
	const testKeyMaps = $derived(createLayoutTestKeyMaps(displayValue));
	const repeatMappingId = $derived(
		inputProfile?.repeatKey ? repeatKeyMappingId(inputProfile.repeatKey.trigger) : undefined
	);
	const repeatKeyEnabled = $derived(
		repeatMappingId === undefined || !disabledMappingIds.includes(repeatMappingId)
	);
	const repeatOptionLabel = $derived(repeatKeyEnabled ? 'Disable repeat key' : 'Enable repeat key');
	const hasSpecialMappings = $derived(
		Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps)
	);
	const conventionalMagicTriggers = $derived(
		layout.hasMagicKey && Object.prototype.hasOwnProperty.call(layout.keys, '*') ? ['*'] : []
	);
	const hasMagicKeyPreview = $derived(
		conventionalMagicTriggers.length > 0 || Boolean(inputProfile?.magicKeys)
	);
	const hasAdaptiveSwapPreview = $derived(Boolean(inputProfile?.adaptiveSwaps));
	const hasContextualKeyPreview = $derived(hasMagicKeyPreview || hasAdaptiveSwapPreview);
	const contextualKeyPreviewLabel = $derived(
		hasMagicKeyPreview && hasAdaptiveSwapPreview
			? 'Preview Magic and Adaptive output'
			: hasAdaptiveSwapPreview
				? 'Preview Adaptive swaps'
				: 'Preview Magic key output'
	);
	const keyboardFeedback = $derived(
		buildLayoutKeyboardFeedback({
			magicKeys: previewContextualKeyOutput ? inputProfile?.magicKeys : undefined,
			adaptiveSwaps: previewContextualKeyOutput ? inputProfile?.adaptiveSwaps : undefined,
			inputHistory: layoutInputHistory,
			disabledMappingIds,
			knownMagicTriggers: previewContextualKeyOutput ? conventionalMagicTriggers : []
		})
	);
	const keyboardSwapPaths = $derived(
		showAdaptiveSwapPaths
			? buildAdaptiveKeyboardSwapPaths(
					inputProfile?.adaptiveSwaps,
					layoutInputHistory,
					disabledMappingIds
				)
			: []
	);
	const colemakCampUrl = $derived(createColemakCampURLFromKeyMap(testKeyMaps.keyMap, layout.board));
	const cyanophageUrl = $derived(
		buildCyanophagePlaygroundUrl(
			layout.keys,
			layout.board,
			displayValue,
			layout.cyanophageThumb ?? 'l',
			{ preferDisplay: anglemodTransformActive }
		)
	);
	const statsOptionsTitleId = $derived(`${titleId}-stats-options`);
	const analyzersTitleId = $derived(`${titleId}-analyzers`);
	const analyzerCount = $derived(
		(showCmini ? 1 : 0) + (showCyanophage ? 1 : 0) + (showMana2 ? 1 : 0)
	);

	const embeddedStats = $derived(
		resolveLayoutDetailStats(detailStats, layoutStatsStore.activeCorpus)
	);
	const cminiCompact = $derived(layoutStatsStore.maps.cmini?.[layout.name] ?? embeddedStats.cmini);
	const cyanophageCompact = $derived(
		layoutStatsStore.maps.cyanophage?.[layout.name] ?? embeddedStats.cyanophage
	);
	const mana2Compact = $derived(layoutStatsStore.maps.mana2?.[layout.name] ?? embeddedStats.mana2);

	const cminiLoading = $derived(showCmini && layoutStatsStore.isLoading(CMINI_ANALYZER));
	const cyanophageLoading = $derived(
		showCyanophage && layoutStatsStore.isLoading(CYANOPHAGE_ANALYZER)
	);
	const mana2Loading = $derived(showMana2 && layoutStatsStore.isLoading(MANA2_ANALYZER));

	const botStats = $derived.by(() => {
		if (!cminiCompact) return null;
		const decoded = decodeCminiStats(cminiCompact);
		return decoded ? deriveBotStats(decoded) : null;
	});
	const cyanophageStats = $derived.by(() => {
		if (!cyanophageCompact) return null;
		const decoded = decodeCyanophageStats(cyanophageCompact);
		return decoded ? deriveCyanophageStats(decoded) : null;
	});
	const mana2Stats = $derived.by(() => {
		if (!mana2Compact) return null;
		const decoded = decodeMana2Stats(mana2Compact);
		return decoded ? deriveMana2Stats(decoded) : null;
	});

	const statsTables = $derived(
		buildExpandedStatsTables({
			cminiStats: botStats,
			cyanophageStats,
			mana2Stats,
			cminiLoading,
			cyanophageLoading,
			mana2Loading
		})
	);

	function hasAnalyzerData(analyzer: StatsAnalyzer): boolean {
		if (analyzer === CMINI_ANALYZER) {
			return cminiCompact != null && decodeCminiStats(cminiCompact) != null;
		}
		if (analyzer === CYANOPHAGE_ANALYZER) {
			return cyanophageCompact != null && decodeCyanophageStats(cyanophageCompact) != null;
		}
		return mana2Compact != null && decodeMana2Stats(mana2Compact) != null;
	}

	function setAnalyzer(analyzer: StatsAnalyzer, checked: boolean) {
		if (analyzer === CMINI_ANALYZER) showCmini = checked;
		else if (analyzer === CYANOPHAGE_ANALYZER) showCyanophage = checked;
		else showMana2 = checked;
		uiPrefs.setLayoutDetailStatsAnalyzers(selectedAnalyzers());
	}

	function selectedAnalyzers(): StatsAnalyzer[] {
		return STAT_ANALYZERS.flatMap(({ value }) => {
			if (value === CMINI_ANALYZER) return showCmini ? [value] : [];
			if (value === CYANOPHAGE_ANALYZER) return showCyanophage ? [value] : [];
			return showMana2 ? [value] : [];
		});
	}

	function toggleRepeatKey() {
		if (!repeatMappingId || !onDisabledMappingIdsChange) return;
		const retained = disabledMappingIds.filter((id) => id !== repeatMappingId);
		onDisabledMappingIdsChange(repeatKeyEnabled ? [...retained, repeatMappingId] : retained);
	}

	$effect(() => {
		if (!uiPrefs.hydrated || analyzerPrefsInitialized) return;
		untrack(() => {
			const persisted = uiPrefs.layoutDetailStatsAnalyzers;
			if (persisted === null) {
				// First use defaults to every analyzer included in this detail payload.
				showCmini = hasAnalyzerData(CMINI_ANALYZER) || Boolean(cminiCompact);
				showCyanophage = hasAnalyzerData(CYANOPHAGE_ANALYZER) || Boolean(cyanophageCompact);
				showMana2 = hasAnalyzerData(MANA2_ANALYZER) || Boolean(mana2Compact);
				uiPrefs.setLayoutDetailStatsAnalyzers(selectedAnalyzers());
			} else {
				showCmini = persisted.includes(CMINI_ANALYZER);
				showCyanophage = persisted.includes(CYANOPHAGE_ANALYZER);
				showMana2 = persisted.includes(MANA2_ANALYZER);
			}
			analyzerPrefsInitialized = true;
		});
	});

	$effect(() => {
		if (!analyzerPrefsInitialized) return;
		const missing = STAT_ANALYZERS.flatMap(({ value }) => {
			if (value === CMINI_ANALYZER && showCmini && !hasAnalyzerData(value)) return [value];
			if (value === CYANOPHAGE_ANALYZER && showCyanophage && !hasAnalyzerData(value))
				return [value];
			if (value === MANA2_ANALYZER && showMana2 && !hasAnalyzerData(value)) return [value];
			return [];
		});
		untrack(() => {
			for (const analyzer of missing) void layoutStatsStore.ensureLoaded(analyzer);
		});
	});
</script>

{#snippet analyzerToggle(analyzer: StatsAnalyzer, label: string, checked: boolean, accent: string)}
	<label class="flex items-center gap-2 min-w-0 cursor-pointer">
		<span class="relative size-4 shrink-0">
			<input
				type="checkbox"
				{checked}
				onchange={(event) => setAnalyzer(analyzer, event.currentTarget.checked)}
				class="size-4 rounded appearance-none cursor-pointer absolute inset-0 m-0"
				style="
					background-color: {checked ? accent : 'var(--bg-primary)'};
					border: 1px solid {checked ? accent : 'var(--border)'};
				"
			/>
			{#if checked}
				<svg
					class="absolute inset-0 m-auto size-3 pointer-events-none"
					style="color: white;"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="3"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{/if}
		</span>
		<span class="text-sm font-semibold min-w-0 truncate" style="color: {accent};">{label}</span>
	</label>
{/snippet}

{#snippet sharedHeaders()}
	{#if showCmini}
		<th scope="col" class="shared-stats-col shared-stats-col--cmini">{cminiTableLabel}</th>
	{/if}
	{#if showCyanophage}
		<th scope="col" class="shared-stats-col shared-stats-col--cyanophage">{cyanophageLabel}</th>
	{/if}
	{#if showMana2}
		<th scope="col" class="shared-stats-col shared-stats-col--mana2">{mana2Label}</th>
	{/if}
{/snippet}

{#snippet sharedCellsRow(row: ExpandedStatsRow)}
	{#if showCmini}
		<td class="shared-stats-col shared-stats-col--cmini">{row.cmini}</td>
	{/if}
	{#if showCyanophage}
		<td class="shared-stats-col shared-stats-col--cyanophage">{row.cyanophage}</td>
	{/if}
	{#if showMana2}
		<td class="shared-stats-col shared-stats-col--mana2">{row.mana2}</td>
	{/if}
{/snippet}

{#snippet layoutSummary()}
	<LayoutCard
		{layout}
		{authorName}
		{likeCount}
		compactCminiStats={cminiCompact}
		compactCyanophageStats={cyanophageCompact}
		compactMana2Stats={mana2Compact}
		statsAnalyzer={summaryStatsAnalyzer}
		onStatsAnalyzerChange={(analyzer) => (summaryStatsAnalyzer = analyzer)}
		{inputProfile}
		{disabledMappingIds}
		{onDisabledMappingIdsChange}
		{anglemodTransformActive}
		showAnglemodAction
		onAnglemodTransformChange={(active) => (anglemodTransformActive = active)}
		variant="summary"
	/>
	<nav class="layout-detail-links" aria-label={`${layout.name} external links`}>
		{#if cyanophageUrl}
			<!-- Dynamic absolute URL; SvelteKit resolve() is only typed for app routes. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={cyanophageUrl} target="_blank" rel="noopener noreferrer">
				View in Cyanophage
				<span aria-hidden="true">↗</span>
			</a>
		{/if}
		<!-- Dynamic absolute URL; SvelteKit resolve() is only typed for app routes. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={colemakCampUrl} target="_blank" rel="noopener noreferrer">
			Practice typing on Colemak Camp
			<span aria-hidden="true">↗</span>
		</a>
	</nav>
	{#if inputProfile?.repeatKey}
		<div class="layout-detail-options" role="group" aria-label={`${layout.name} layout options`}>
			<button type="button" onclick={toggleRepeatKey}>
				<svg
					class="size-4 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m17 2 4 4-4 4" />
					<path d="M3 11V9a3 3 0 0 1 3-3h15" />
					<path d="m7 22-4-4 4-4" />
					<path d="M21 13v2a3 3 0 0 1-3 3H3" />
				</svg>
				{repeatOptionLabel}
			</button>
		</div>
	{/if}
{/snippet}

<article class="layout-detail-page" data-layout-detail aria-label={`${layout.name} details`}>
	<header class="layout-detail-header">
		<a
			class="layout-detail-back"
			href={resolve('/')}
			onclick={onBackToLayouts}
			aria-label="All layouts"
		>
			<svg
				class="size-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="m15 18-6-6 6-6" />
			</svg>
			<span>All layouts</span>
		</a>
	</header>

	<div class="layout-detail-scroll">
		<div class="detail-columns">
			<div class="detail-side">
				{@render layoutSummary()}
			</div>

			<div class="detail-main">
				<div class="layout-detail-tabs-wrap">
					<Tabs
						value={activeSection}
						onChange={onActiveSectionChange}
						options={sections}
						ariaLabel="Layout detail sections"
						class="layout-detail-tabs"
						buttonClass="layout-detail-tab"
						selectedClass="layout-detail-tab--selected"
					/>
				</div>

				{#if activeSection === 'practice'}
					<div
						id={practicePanelId}
						class="detail-practice-panel detail-panel-content"
						role="tabpanel"
						aria-labelledby={practiceTabId}
					>
						<LayoutTypingPractice
							{layout}
							rows={displayRows}
							keyMaps={testKeyMaps}
							{inputProfile}
							{disabledMappingIds}
							{onDisabledMappingIdsChange}
							knownMagicTriggers={conventionalMagicTriggers}
							{customPracticeText}
							{onCustomPracticeTextChange}
						/>
					</div>
				{:else if activeSection === 'test'}
					<div
						id={testPanelId}
						class="detail-test-panel detail-panel-content"
						role="tabpanel"
						aria-labelledby={testTabId}
					>
						<div
							class="detail-test-input-row"
							class:detail-test-input-row--with-mappings={hasSpecialMappings}
						>
							<div class="detail-test-area-wrap">
								<LayoutTestArea
									{layout}
									keyMaps={testKeyMaps}
									{inputProfile}
									{disabledMappingIds}
									variant="page"
									onInputHistoryChange={(history) => (layoutInputHistory = history)}
								/>
							</div>

							{#if hasSpecialMappings && inputProfile}
								<div class="detail-test-mappings">
									<InputMappingsPanel
										profile={inputProfile}
										{disabledMappingIds}
										{onDisabledMappingIdsChange}
									/>
								</div>
							{/if}
						</div>

						<div class="detail-keyboard-preview">
							{#if hasContextualKeyPreview}
								<div class="detail-keyboard-preview-controls">
									<ToggleSwitch
										checked={previewContextualKeyOutput}
										label={contextualKeyPreviewLabel}
										onCheckedChange={(checked) => (previewContextualKeyOutput = checked)}
									/>
									{#if hasAdaptiveSwapPreview}
										<ToggleSwitch
											checked={showAdaptiveSwapPaths}
											label="Show swap paths"
											onCheckedChange={(checked) => (showAdaptiveSwapPaths = checked)}
										/>
									{/if}
								</div>
							{/if}
							<LayoutKeyboardPreview
								{layout}
								rows={displayRows}
								feedback={keyboardFeedback}
								swapPaths={keyboardSwapPaths}
							/>
						</div>
					</div>
				{:else}
					<div
						id={statsPanelId}
						class="detail-stats-panel detail-panel-content"
						role="tabpanel"
						aria-labelledby={statsTabId}
					>
						<section
							class="detail-stats-controls flex min-w-0 flex-col gap-3 rounded-xl px-3 py-3"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
							aria-labelledby={statsOptionsTitleId}
						>
							<div class="detail-stats-controls-header">
								<h3
									id={statsOptionsTitleId}
									class="text-sm font-semibold m-0"
									style="color: var(--text-primary);"
								>
									Stats options
								</h3>
								<label class="detail-corpus-option">
									<span class="detail-stats-option-label">Corpus</span>
									<CorpusTabs
										value={uiPrefs.statsCorpus}
										onChange={(corpus) => uiPrefs.setStatsCorpus(corpus)}
									/>
								</label>
							</div>
							<div class="detail-analyzer-group" role="group" aria-labelledby={analyzersTitleId}>
								<span id={analyzersTitleId} class="detail-stats-option-label"> Analyzers </span>
								<div class="detail-analyzer-options">
									{@render analyzerToggle(
										CMINI_ANALYZER,
										cminiLabel,
										showCmini,
										'var(--analyzer-cmini)'
									)}
									{@render analyzerToggle(
										CYANOPHAGE_ANALYZER,
										cyanophageLabel,
										showCyanophage,
										'var(--analyzer-cyanophage)'
									)}
									{@render analyzerToggle(
										MANA2_ANALYZER,
										mana2Label,
										showMana2,
										'var(--analyzer-mana2)'
									)}
								</div>
							</div>
						</section>
						{#if analyzerCount > 0}
							<div class="unique-columns" style="--unique-cols: {analyzerCount};">
								{#if showCmini}
									<LayoutExpandUniqueStats
										analyzer={CMINI_ANALYZER}
										label={cminiLabel}
										stats={botStats}
										loading={cminiLoading}
									/>
								{/if}
								{#if showCyanophage}
									<LayoutExpandUniqueStats
										analyzer={CYANOPHAGE_ANALYZER}
										label={cyanophageLabel}
										stats={cyanophageStats}
										loading={cyanophageLoading}
										cyanophageUnavailableReason={getCyanophageStatsUnavailableReason(layout)}
									/>
								{/if}
								{#if showMana2}
									<LayoutExpandUniqueStats
										analyzer={MANA2_ANALYZER}
										label={mana2Label}
										stats={mana2Stats}
										loading={mana2Loading}
									/>
								{/if}
							</div>

							<section class="shared-stats" aria-labelledby={`${titleId}-shared`}>
								<h3
									id={`${titleId}-shared`}
									class="shared-stats-title"
									style="color: var(--text-primary);"
								>
									Shared stats
								</h3>
								<p class="shared-stats-note" style="color: var(--text-secondary);">
									Metrics present in at least two analyzers. Values use each analyzer’s own
									definition and units — not always directly comparable.
								</p>
								<div class="shared-stats-scroll">
									<table class="shared-stats-table">
										<thead>
											<tr>
												<th scope="col" class="shared-stats-metric">Stat</th>
												{@render sharedHeaders()}
											</tr>
										</thead>
										<tbody>
											{#each statsTables.sharedRows as row (row.label)}
												<tr>
													<th scope="row" class="shared-stats-metric">{row.label}</th>
													{@render sharedCellsRow(row)}
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="shared-hand-grid">
									<div>
										<h3
											id={`${titleId}-left-hand`}
											class="shared-stats-title shared-stats-title--secondary"
											style="color: var(--text-primary);"
										>
											Left hand
										</h3>
										<p class="shared-stats-note" style="color: var(--text-secondary);">
											Left-hand balance and per-finger load.
										</p>
										<div class="shared-stats-scroll">
											<table class="shared-stats-table">
												<thead>
													<tr>
														<th scope="col" class="shared-stats-metric">Stat</th>
														{@render sharedHeaders()}
													</tr>
												</thead>
												<tbody>
													{#each statsTables.leftHandRows as row (row.label)}
														<tr>
															<th scope="row" class="shared-stats-metric">{row.label}</th>
															{@render sharedCellsRow(row)}
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>

									<div>
										<h3
											id={`${titleId}-right-hand`}
											class="shared-stats-title shared-stats-title--secondary"
											style="color: var(--text-primary);"
										>
											Right hand
										</h3>
										<p class="shared-stats-note" style="color: var(--text-secondary);">
											Right-hand balance and per-finger load.
										</p>
										<div class="shared-stats-scroll">
											<table class="shared-stats-table">
												<thead>
													<tr>
														<th scope="col" class="shared-stats-metric">Stat</th>
														{@render sharedHeaders()}
													</tr>
												</thead>
												<tbody>
													{#each statsTables.rightHandRows as row (row.label)}
														<tr>
															<th scope="row" class="shared-stats-metric">{row.label}</th>
															{@render sharedCellsRow(row)}
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							</section>
						{:else}
							<p class="m-0 text-sm" style="color: var(--text-secondary);">
								Select one or more analyzers to show stats.
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</article>

<style>
	.layout-detail-page {
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		min-height: 0;
		width: 100%;
	}

	.layout-detail-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex-shrink: 0;
		padding: 0.75rem 0.25rem 0.25rem;
	}

	.layout-detail-back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		width: fit-content;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.25rem;
		text-decoration: none;
	}

	.layout-detail-back:hover,
	.layout-detail-back:focus-visible {
		color: var(--accent);
	}

	.layout-detail-back:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 0.2rem;
		border-radius: 0.25rem;
	}

	.layout-detail-tabs-wrap {
		flex-shrink: 0;
		border-bottom: 1px solid var(--border);
	}

	.layout-detail-tabs-wrap :global(.layout-detail-tabs) {
		display: flex;
		align-items: stretch;
		gap: 0.25rem;
	}

	.layout-detail-tabs-wrap :global(.layout-detail-tab) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.625rem 0.875rem;
		margin-bottom: -1px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25;
		cursor: pointer;
	}

	.layout-detail-tabs-wrap :global(.layout-detail-tab:hover) {
		color: var(--text-primary);
	}

	.layout-detail-tabs-wrap :global(.layout-detail-tab:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: 0.25rem;
	}

	.layout-detail-tabs-wrap :global(.layout-detail-tab--selected) {
		border-bottom-color: var(--accent);
		color: var(--text-primary);
		font-weight: 600;
	}

	.layout-detail-scroll {
		min-height: 0;
		padding: 0.5rem 0.25rem 2rem;
	}

	.detail-practice-panel,
	.detail-test-panel,
	.detail-stats-panel {
		min-width: 0;
	}

	.detail-columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.detail-side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.layout-detail-links {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding-inline: 0.25rem;
	}

	.layout-detail-links a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.25rem;
		text-decoration: none;
	}

	.layout-detail-links a:hover {
		text-decoration: underline;
	}

	.layout-detail-links a:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 0.2rem;
		border-radius: 0.2rem;
	}

	.layout-detail-options {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
		padding-inline: 0.25rem;
	}

	.layout-detail-options button {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		width: 100%;
		min-height: 2rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.25rem;
		cursor: pointer;
	}

	.layout-detail-options button:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
		color: var(--text-primary);
	}

	.layout-detail-options button:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 0.15rem;
	}

	.detail-main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.detail-panel-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.detail-practice-panel {
		padding-block: clamp(1.5rem, 5vh, 3.5rem) 0.5rem;
	}

	.detail-test-input-row {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.detail-test-area-wrap,
	.detail-test-mappings {
		min-width: 0;
	}

	.detail-keyboard-preview {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.detail-keyboard-preview-controls {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.625rem 1rem;
	}

	@media (min-width: 768px) {
		.detail-test-input-row--with-mappings {
			display: grid;
			grid-template-columns: minmax(0, 3fr) minmax(16rem, 2fr);
			align-items: start;
		}

		.detail-test-input-row--with-mappings .detail-test-mappings {
			grid-row: 1;
			grid-column: 2;
		}

		.detail-test-input-row--with-mappings .detail-test-area-wrap {
			grid-row: 1;
			grid-column: 1;
		}
	}

	.detail-analyzer-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.75rem 1rem;
		min-width: 0;
	}

	.detail-corpus-option {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.detail-stats-controls-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
	}

	.detail-stats-option-label {
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
	}

	.detail-analyzer-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.unique-columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		min-width: 0;
		align-items: start;
		--unique-cols: 1;
	}

	@media (min-width: 720px) {
		.unique-columns {
			grid-template-columns: repeat(var(--unique-cols), minmax(0, 1fr));
			align-items: stretch;
		}
	}

	@media (min-width: 960px) {
		.detail-columns {
			grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
			gap: 1.5rem;
		}
	}

	.shared-stats {
		min-width: 0;
	}

	.shared-stats-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.25rem;
	}

	.shared-stats-title--secondary {
		margin-top: 0;
	}

	.shared-hand-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	@media (min-width: 768px) {
		.shared-hand-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.shared-stats-note {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.75rem;
		line-height: 1.2rem;
	}

	.shared-stats-scroll {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background-color: var(--bg-secondary);
	}

	.shared-stats-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
		line-height: 1.25rem;
		font-variant-numeric: tabular-nums;
	}

	.shared-stats-table th,
	.shared-stats-table td {
		padding: 0.45rem 0.75rem;
		text-align: right;
		border-bottom: 1px solid var(--border);
		color: var(--text-primary);
		white-space: nowrap;
	}

	.shared-stats-table tbody tr:last-child th,
	.shared-stats-table tbody tr:last-child td {
		border-bottom: 0;
	}

	.shared-stats-metric {
		text-align: left !important;
		font-weight: 500;
		color: var(--text-secondary) !important;
	}

	.shared-stats-table thead th {
		font-weight: 600;
		background-color: color-mix(in srgb, var(--bg-primary) 55%, var(--bg-secondary));
	}

	.shared-stats-col--cmini {
		color: var(--analyzer-cmini);
	}

	.shared-stats-col--cyanophage {
		color: var(--analyzer-cyanophage);
	}

	.shared-stats-col--mana2 {
		color: var(--analyzer-mana2);
	}

	.shared-stats-table tbody td.shared-stats-col--cmini,
	.shared-stats-table tbody td.shared-stats-col--cyanophage,
	.shared-stats-table tbody td.shared-stats-col--mana2 {
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
</style>
