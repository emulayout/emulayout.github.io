<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		CompactMana2Stats,
		LayoutData
	} from '$lib/layout';
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
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { buildExpandedStatsTables, type ExpandedStatsRow } from '$lib/layoutExpandedStats';
	import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import InputMappingsPanel from '$lib/components/InputMappingsPanel.svelte';
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import LayoutExpandUniqueStats from '$lib/components/LayoutExpandUniqueStats.svelte';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		onBackToLayouts?: (event: MouseEvent) => void;
		compactCminiStats?: CompactLayoutStats;
		compactCyanophageStats?: CompactCyanophageStats;
		compactMana2Stats?: CompactMana2Stats;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
	}

	const {
		layout,
		authorName,
		likeCount,
		onBackToLayouts,
		compactCminiStats,
		compactCyanophageStats,
		compactMana2Stats,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange
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
	const titleId = $derived(`layout-expand-title-${layout.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
	const analyzersTitleId = $derived(`${titleId}-analyzers`);
	const analyzerCount = $derived(
		(showCmini ? 1 : 0) + (showCyanophage ? 1 : 0) + (showMana2 ? 1 : 0)
	);

	const cminiCompact = $derived(layoutStatsStore.maps.cmini?.[layout.name] ?? compactCminiStats);
	const cyanophageCompact = $derived(
		layoutStatsStore.maps.cyanophage?.[layout.name] ?? compactCyanophageStats
	);
	const mana2Compact = $derived(layoutStatsStore.maps.mana2?.[layout.name] ?? compactMana2Stats);

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
		if (!cyanophageCompact || !layout.cyanophageCompatible) return null;
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
		if (analyzer === CMINI_ANALYZER) return Boolean(cminiCompact);
		if (analyzer === CYANOPHAGE_ANALYZER) {
			return layout.cyanophageCompatible && Boolean(cyanophageCompact);
		}
		return Boolean(mana2Compact);
	}

	function setAnalyzer(analyzer: StatsAnalyzer, checked: boolean) {
		if (analyzer === CMINI_ANALYZER) showCmini = checked;
		else if (analyzer === CYANOPHAGE_ANALYZER) showCyanophage = checked;
		else showMana2 = checked;
		if (checked && !hasAnalyzerData(analyzer)) void layoutStatsStore.ensureLoaded(analyzer);
	}

	onMount(() => {
		showCmini = hasAnalyzerData(CMINI_ANALYZER);
		showCyanophage = hasAnalyzerData(CYANOPHAGE_ANALYZER);
		showMana2 = hasAnalyzerData(MANA2_ANALYZER);
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

<article class="layout-detail-page" data-layout-detail aria-labelledby={titleId}>
	<header class="layout-detail-header">
		<a
			class="layout-detail-back"
			href={resolve('/')}
			onclick={onBackToLayouts}
			aria-label="Back to layouts"
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
			<span>Back to layouts</span>
		</a>
		<h2 id={titleId} class="layout-detail-title" title={layout.name}>{layout.name}</h2>
	</header>

	<div class="layout-detail-scroll">
		<div class="detail-columns">
			<div class="detail-side">
				<LayoutCard
					{layout}
					{authorName}
					{likeCount}
					{compactCminiStats}
					{compactCyanophageStats}
					{compactMana2Stats}
					{inputProfile}
					{disabledMappingIds}
					{onDisabledMappingIdsChange}
					variant="summary"
				/>

				<section
					class="flex min-w-0 flex-col gap-2 rounded-xl px-3 py-3"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-labelledby={analyzersTitleId}
				>
					<h3
						id={analyzersTitleId}
						class="text-sm font-semibold m-0"
						style="color: var(--text-primary);"
					>
						Show analyzers
					</h3>
					<div class="flex flex-col gap-2 min-w-0">
						{@render analyzerToggle(CMINI_ANALYZER, cminiLabel, showCmini, 'var(--analyzer-cmini)')}
						{@render analyzerToggle(
							CYANOPHAGE_ANALYZER,
							cyanophageLabel,
							showCyanophage,
							'var(--analyzer-cyanophage)'
						)}
						{@render analyzerToggle(MANA2_ANALYZER, mana2Label, showMana2, 'var(--analyzer-mana2)')}
					</div>
				</section>
			</div>

			<div class="detail-main">
				{#if inputProfile?.magicKeys || inputProfile?.adaptiveSwaps}
					<InputMappingsPanel
						profile={inputProfile}
						{disabledMappingIds}
						{onDisabledMappingIdsChange}
					/>
				{/if}

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
								cyanophageUnsupported={!layout.cyanophageCompatible}
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
							Metrics present in at least two analyzers. Values use each analyzer’s own definition
							and units — not always directly comparable.
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
		gap: 0.5rem;
		flex-shrink: 0;
		padding: 0.25rem 0.25rem 0.75rem;
		border-bottom: 1px solid var(--border);
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

	.layout-detail-title {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.5rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.layout-detail-scroll {
		min-height: 0;
		padding: 1rem 0.25rem 2rem;
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

	.detail-main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
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

	@media (min-width: 768px) {
		.layout-detail-scroll {
			flex: 1 1 0;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: color-mix(in srgb, var(--text-caption) 70%, transparent) transparent;
		}
	}

	@media (min-width: 960px) {
		.detail-columns {
			grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
			gap: 1.5rem;
		}

		.detail-side {
			position: sticky;
			top: 0;
			align-self: start;
			z-index: 1;
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
