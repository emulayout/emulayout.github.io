<script lang="ts">
	import StatFiltersModal from '$lib/components/StatFiltersModal.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { getStatFilterSectionSummary, type StatFilterSection } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/layoutStats';

	let openSection = $state<StatFilterSection | null>(null);

	const generalSummary = $derived(getStatFilterSectionSummary(filterStore, 'general'));
	const handsSummary = $derived(getStatFilterSectionSummary(filterStore, 'hands'));
	const hasActive = $derived(Boolean(generalSummary || handsSummary));

	function open(section: StatFilterSection) {
		openSection = section;
	}
</script>

<div
	class="stat-filters w-full p-3 rounded-xl"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="flex items-center justify-between gap-2 mb-2">
		<div class="flex items-center gap-1.5 min-w-0">
			<span class="text-sm font-medium" style="color: var(--text-secondary);">Stat filters</span>
			<Tooltip
				text="Filter layouts by analyzer stats. General covers overall metrics; Hands & fingers covers per-hand and per-finger usage. Layouts without stats are hidden when any limit is set."
			/>
		</div>
		{#if hasActive}
			<button
				type="button"
				class="text-xs px-2 py-1 rounded transition-colors inline-flex shrink-0"
				style="color: var(--accent); background-color: var(--bg-primary);"
				onclick={() => filterStore.clearStatLimits()}
			>
				Reset
			</button>
		{/if}
	</div>

	<label class="analyzer-field">
		<span class="text-sm" style="color: var(--text-secondary);">Analyzer</span>
		<select
			value={filterStore.statsAnalyzer}
			onchange={(e) => filterStore.setStatsAnalyzer(e.currentTarget.value as StatsAnalyzer)}
			class="analyzer-select"
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
			aria-label="Analyzer"
		>
			{#each STAT_ANALYZERS as analyzer (analyzer.value)}
				<option value={analyzer.value}>{analyzer.label}</option>
			{/each}
		</select>
	</label>

	<div class="filter-open-button-group">
		<button type="button" class="filter-open-button" onclick={() => open('general')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">General stats</span>
				{#if generalSummary}
					<span
						class="filter-open-button-summary"
						style="color: var(--accent);"
						title={generalSummary}>{generalSummary}</span
					>
				{/if}
			</span>
			<svg
				class="filter-open-button-chevron"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		</button>

		<button type="button" class="filter-open-button" onclick={() => open('hands')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">Hands &amp; fingers</span>
				{#if handsSummary}
					<span
						class="filter-open-button-summary"
						style="color: var(--accent);"
						title={handsSummary}>{handsSummary}</span
					>
				{/if}
			</span>
			<svg
				class="filter-open-button-chevron"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	</div>
</div>

<StatFiltersModal
	open={openSection !== null}
	section={openSection}
	onClose={() => (openSection = null)}
/>

<style>
	.analyzer-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.analyzer-select {
		width: 100%;
		padding: 0.5rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
		cursor: pointer;
	}

	.analyzer-select:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}
</style>
