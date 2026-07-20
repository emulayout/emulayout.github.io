<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import StatLimitFiltersBody from '$lib/components/StatLimitFiltersBody.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		getStatFilterSectionSummary,
		type StatFilterSection
	} from '$lib/filterSummaries';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		isStatsAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatLimitKey,
		type StatsAnalyzer
	} from '$lib/layoutStats';

	interface Props {
		open: boolean;
		section: StatFilterSection | null;
		onClose: () => void;
		/** Prefer this analyzer tab when opening from a chip. */
		preferredAnalyzer?: StatsAnalyzer | null;
		focusKey?: StatLimitKey | null;
		focusToken?: number;
	}

	let {
		open,
		section,
		onClose,
		preferredAnalyzer = null,
		focusKey = null,
		focusToken = 0
	}: Props = $props();

	/** Which analyzer’s filter fields to edit — independent of card display mode. */
	let editAnalyzer = $state<StatsAnalyzer>(DEFAULT_STATS_ANALYZER);

	// Prefer chip-targeted analyzer before paint so the field exists when we focus.
	$effect.pre(() => {
		if (!open) return;
		if (preferredAnalyzer) {
			editAnalyzer = preferredAnalyzer;
			return;
		}
		if (isStatsAnalyzer(filterStore.statsAnalyzer)) {
			editAnalyzer = filterStore.statsAnalyzer;
		}
	});

	const title = $derived(section === 'hands' ? 'Hands & fingers' : 'General stats');
	const panelClass = $derived(
		section === 'hands'
			? 'max-h-[min(92vh,900px)] max-w-lg'
			: 'max-h-[min(92vh,900px)] max-w-[770px]'
	);
	const hasActiveFilters = $derived(
		section
			? Boolean(getStatFilterSectionSummary(filterStore, section, editAnalyzer))
			: false
	);

	function analyzerHasFilters(analyzer: StatsAnalyzer): boolean {
		if (!section) return false;
		return Boolean(getStatFilterSectionSummary(filterStore, section, analyzer));
	}

	function clearActiveSection() {
		if (section === 'general') filterStore.clearGeneralStatLimits(editAnalyzer);
		else if (section === 'hands') filterStore.clearHandStatLimits(editAnalyzer);
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="stat-filters-modal-title"
	{panelClass}
	initialFocusSelector={focusKey ? `[data-stat-limit-key="${focusKey}"]` : null}
	initialFocusToken={focusToken}
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<div class="flex min-w-0 items-center gap-2">
			<h2
				id="stat-filters-modal-title"
				class="text-lg font-semibold shrink-0"
				style="color: var(--text-primary);"
			>
				{title}
			</h2>
			{#if hasActiveFilters}
				<button type="button" class="filter-reset-button" onclick={clearActiveSection}>
					Reset all
				</button>
			{/if}
		</div>
		<button
			onclick={onClose}
			class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div
		class="analyzer-tabs border-b px-5"
		style="border-color: var(--border);"
		role="tablist"
		aria-label="Stats analyzer filters"
	>
		{#each STAT_ANALYZERS as analyzer (analyzer.value)}
			{@const selected = editAnalyzer === analyzer.value}
			{@const hasFilters = analyzerHasFilters(analyzer.value)}
			<button
				type="button"
				role="tab"
				id="stat-analyzer-tab-{analyzer.value}"
				aria-selected={selected}
				aria-controls="stat-analyzer-panel"
				tabindex={selected ? 0 : -1}
				class="analyzer-tab"
				class:analyzer-tab--selected={selected}
				class:analyzer-tab--cmini={analyzer.value === DEFAULT_STATS_ANALYZER}
				class:analyzer-tab--cyanophage={analyzer.value === CYANOPHAGE_ANALYZER}
				class:analyzer-tab--mana2={analyzer.value === MANA2_ANALYZER}
				onclick={() => (editAnalyzer = analyzer.value)}
			>
				<span>{analyzer.label}</span>
				{#if hasFilters}
					<span class="analyzer-tab-dot" aria-hidden="true"></span>
					<span class="sr-only">Has active filters</span>
				{/if}
			</button>
		{/each}
	</div>

	<div
		id="stat-analyzer-panel"
		role="tabpanel"
		aria-labelledby="stat-analyzer-tab-{editAnalyzer}"
		class="min-h-0 flex-1 overflow-y-auto px-5 py-4"
	>
		{#if section}
			<StatLimitFiltersBody {section} analyzer={editAnalyzer} />
		{/if}
	</div>
</ModalShell>

<style>
	.analyzer-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.analyzer-tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.75rem 0.75rem 0.625rem;
		margin-bottom: -1px;
		border-bottom: 2px solid transparent;
		font-size: 0.875rem;
		line-height: 1.25;
		white-space: nowrap;
		color: var(--text-secondary);
		cursor: pointer;
		background: transparent;
	}

	.analyzer-tab:hover {
		color: var(--text-primary);
	}

	.analyzer-tab:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--accent);
		border-radius: 0.375rem 0.375rem 0 0;
	}

	.analyzer-tab--selected {
		color: var(--text-primary);
		font-weight: 600;
	}

	.analyzer-tab--cmini.analyzer-tab--selected {
		border-bottom-color: var(--analyzer-cmini);
	}

	.analyzer-tab--cyanophage.analyzer-tab--selected {
		border-bottom-color: var(--analyzer-cyanophage);
	}

	.analyzer-tab--mana2.analyzer-tab--selected {
		border-bottom-color: var(--analyzer-mana2);
	}

	.analyzer-tab-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 9999px;
		background-color: var(--accent);
		flex-shrink: 0;
	}

	.analyzer-tab--cmini .analyzer-tab-dot {
		background-color: var(--analyzer-cmini);
	}

	.analyzer-tab--cyanophage .analyzer-tab-dot {
		background-color: var(--analyzer-cyanophage);
	}

	.analyzer-tab--mana2 .analyzer-tab-dot {
		background-color: var(--analyzer-mana2);
	}
</style>
