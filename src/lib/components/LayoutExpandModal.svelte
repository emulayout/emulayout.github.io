<script lang="ts">
	import type { Snippet } from 'svelte';
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
	import LayoutExpandUniqueStats from '$lib/components/LayoutExpandUniqueStats.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';

	interface Props {
		layout: LayoutData;
		compactCminiStats?: CompactLayoutStats;
		compactCyanophageStats?: CompactCyanophageStats;
		compactMana2Stats?: CompactMana2Stats;
		forceIncluded?: boolean;
		similarActive?: boolean;
		layoutCard: Snippet;
	}

	const {
		layout,
		compactCminiStats,
		compactCyanophageStats,
		compactMana2Stats,
		forceIncluded = false,
		similarActive = false,
		layoutCard
	}: Props = $props();

	const cminiLabel =
		STAT_ANALYZERS.find((analyzer) => analyzer.value === CMINI_ANALYZER)?.label ?? 'cmini';
	const cminiTableLabel = 'cmini';
	const cyanophageLabel =
		STAT_ANALYZERS.find((analyzer) => analyzer.value === CYANOPHAGE_ANALYZER)?.label ??
		'Cyanophage';
	const mana2Label =
		STAT_ANALYZERS.find((analyzer) => analyzer.value === MANA2_ANALYZER)?.label ?? 'Mana2';

	let expanded = $state(false);
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
		if (checked) void layoutStatsStore.ensureLoaded(analyzer);
	}

	export function open() {
		showCmini = hasAnalyzerData(CMINI_ANALYZER);
		showCyanophage = hasAnalyzerData(CYANOPHAGE_ANALYZER);
		showMana2 = hasAnalyzerData(MANA2_ANALYZER);
		expanded = true;
		if (showCmini) void layoutStatsStore.ensureLoaded(CMINI_ANALYZER);
		if (showCyanophage) void layoutStatsStore.ensureLoaded(CYANOPHAGE_ANALYZER);
		if (showMana2) void layoutStatsStore.ensureLoaded(MANA2_ANALYZER);
	}

	function close() {
		expanded = false;
	}
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

<ModalShell
	open={expanded}
	onClose={close}
	labelledBy={titleId}
	panelClass="max-h-[min(94vh,980px)] max-w-[min(1480px,98vw)]"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4 shrink-0"
		style="border-color: var(--border);"
	>
		<h2
			id={titleId}
			class="text-lg font-semibold truncate min-w-0"
			style="color: var(--text-primary);"
			title={layout.name}
		>
			{layout.name}
		</h2>
		<button
			type="button"
			onclick={close}
			class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg
				class="size-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
		<div class="modal-columns">
			<div class="modal-side">
				<div
					class="flex min-w-0 flex-col gap-2 rounded-xl px-3 pt-3 pb-2"
					style="
						background-color: {forceIncluded ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
						border: 1px solid {similarActive ? 'var(--similar-diff)' : 'var(--border)'};
					"
				>
					{@render layoutCard()}
				</div>

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

			<div class="modal-main">
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
</ModalShell>

<style>
	.modal-columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.modal-side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.modal-main {
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

	@media (min-width: 960px) {
		.modal-columns {
			grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
			gap: 1.5rem;
		}

		.modal-side {
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
