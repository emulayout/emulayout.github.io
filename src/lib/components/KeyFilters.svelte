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

	<div class="key-filters-actions">
		<button
			type="button"
			class="filter-open-button"
			style="
				color: var(--text-primary);
				background-color: var(--input-bg);
				border: 1px solid var(--border);
			"
			onclick={() => open('and')}
		>
			<span class="filter-open-button-title">Include keys (AND)</span>
			{#if andSummary}
				<span class="filter-open-button-summary" style="color: var(--accent);" title={andSummary}
					>{andSummary}</span
				>
			{/if}
		</button>

		<button
			type="button"
			class="filter-open-button"
			style="
				color: var(--text-primary);
				background-color: var(--input-bg);
				border: 1px solid var(--border);
			"
			onclick={() => open('or')}
		>
			<span class="filter-open-button-title">Include keys (OR)</span>
			{#if orSummary}
				<span class="filter-open-button-summary" style="color: var(--accent);" title={orSummary}
					>{orSummary}</span
				>
			{/if}
		</button>

		<button
			type="button"
			class="filter-open-button"
			style="
				color: var(--text-primary);
				background-color: var(--input-bg);
				border: 1px solid var(--border);
			"
			onclick={() => open('exclude')}
		>
			<span class="filter-open-button-title">Exclude keys</span>
			{#if excludeSummary}
				<span
					class="filter-open-button-summary"
					style="color: var(--accent);"
					title={excludeSummary}>{excludeSummary}</span
				>
			{/if}
		</button>
	</div>
</div>

<KeyFiltersModal
	open={openKind !== null}
	kind={openKind}
	onClose={() => (openKind = null)}
/>

<style>
	.key-filters-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-open-button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		width: 100%;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.filter-open-button:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.filter-open-button-title {
		line-height: 1.25;
	}

	.filter-open-button-summary {
		max-width: 100%;
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
