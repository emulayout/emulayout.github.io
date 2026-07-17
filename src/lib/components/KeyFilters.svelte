<script lang="ts">
	import KeyFiltersModal from '$lib/components/KeyFiltersModal.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { getKeyFilterKindSummary, type KeyFilterKind } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';

	let openKind = $state<KeyFilterKind | null>(null);

	const andSummary = $derived(getKeyFilterKindSummary(filterStore, 'and'));
	const orSummary = $derived(getKeyFilterKindSummary(filterStore, 'or'));
	const excludeSummary = $derived(getKeyFilterKindSummary(filterStore, 'exclude'));
	const hasActive = $derived(Boolean(andSummary || orSummary || excludeSummary));

	function open(kind: KeyFilterKind) {
		openKind = kind;
	}
</script>

<div
	class="key-filters w-full p-3 rounded-xl"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="flex items-center justify-between gap-2 mb-2">
		<div class="flex items-center gap-1.5 min-w-0">
			<span class="text-sm font-medium" style="color: var(--text-secondary);">Key filters</span>
			<Tooltip
				text="Filter layouts by keys in specific positions. Include AND requires every filled position to match. Include OR matches if any filled position matches. Exclude removes layouts that place unwanted keys at the given positions."
			/>
		</div>
		{#if hasActive}
			<button
				type="button"
				class="text-xs px-2 py-1 rounded transition-colors inline-flex shrink-0"
				style="color: var(--accent); background-color: var(--bg-primary);"
				onclick={() => filterStore.clearKeyFilters()}
			>
				Reset
			</button>
		{/if}
	</div>

	<div class="filter-open-button-group">
		<button type="button" class="filter-open-button" onclick={() => open('and')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">Include keys (AND)</span>
				{#if andSummary}
					<span class="filter-open-button-summary" title={andSummary}>{andSummary}</span>
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

		<button type="button" class="filter-open-button" onclick={() => open('or')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">Include keys (OR)</span>
				{#if orSummary}
					<span class="filter-open-button-summary" title={orSummary}>{orSummary}</span>
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

		<button type="button" class="filter-open-button" onclick={() => open('exclude')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">Exclude keys</span>
				{#if excludeSummary}
					<span class="filter-open-button-summary" title={excludeSummary}>{excludeSummary}</span>
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

<KeyFiltersModal
	open={openKind !== null}
	kind={openKind}
	onClose={() => (openKind = null)}
/>

