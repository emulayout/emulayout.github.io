<script lang="ts">
	import StatFiltersModal from '$lib/components/StatFiltersModal.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { getStatFilterSectionSummary, type StatFilterSection } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';
	import type { StatLimitKey, StatsAnalyzer } from '$lib/layoutStats';

	let openSection = $state<StatFilterSection | null>(null);
	let focusAnalyzer = $state<StatsAnalyzer | null>(null);
	let focusKey = $state<StatLimitKey | null>(null);
	let focusToken = $state(0);

	const generalActive = $derived(Boolean(getStatFilterSectionSummary(filterStore, 'general')));
	const handsActive = $derived(Boolean(getStatFilterSectionSummary(filterStore, 'hands')));
	const hasActive = $derived(generalActive || handsActive);

	function open(section: StatFilterSection) {
		focusAnalyzer = null;
		focusKey = null;
		openSection = section;
	}

	function close() {
		openSection = null;
		focusAnalyzer = null;
		focusKey = null;
	}

	$effect(() => {
		const seq = filterStore.filterFocusRequestSeq;
		const req = filterStore.filterFocusRequest;
		if (!seq || !req || req.target !== 'stats') return;
		focusAnalyzer = req.analyzer;
		focusKey = req.key;
		focusToken = seq;
		openSection = req.section;
	});
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
				class="filter-reset-button shrink-0"
				onclick={() => filterStore.clearStatLimits()}
			>
				Reset all
			</button>
		{/if}
	</div>

	<div class="filter-open-button-group">
		<button type="button" class="filter-open-button" onclick={() => open('general')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">
					General stats
					{#if generalActive}
						<span class="filter-open-button-dot" aria-hidden="true"></span>
						<span class="sr-only">Active filters</span>
					{/if}
				</span>
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
				<span class="filter-open-button-title">
					Hands &amp; fingers
					{#if handsActive}
						<span class="filter-open-button-dot" aria-hidden="true"></span>
						<span class="sr-only">Active filters</span>
					{/if}
				</span>
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
	preferredAnalyzer={focusAnalyzer}
	{focusKey}
	{focusToken}
	onClose={close}
/>
