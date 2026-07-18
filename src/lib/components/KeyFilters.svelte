<script lang="ts">
	import KeyFiltersModal from '$lib/components/KeyFiltersModal.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { type KeyFilterKind } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';

	let openKind = $state<KeyFilterKind | null>(null);

	const andActive = $derived.by(() => filterStore.hasActiveKeyFilterKind('and'));
	const orActive = $derived.by(() => filterStore.hasActiveKeyFilterKind('or'));
	const excludeActive = $derived.by(() => filterStore.hasActiveKeyFilterKind('exclude'));
	const hasActive = $derived(andActive || orActive || excludeActive);

	function open(kind: KeyFilterKind) {
		openKind = kind;
	}

	$effect(() => {
		const seq = filterStore.filterFocusRequestSeq;
		const req = filterStore.filterFocusRequest;
		if (!seq || !req || req.target !== 'keys') return;
		openKind = req.kind;
	});
</script>

<div
	class="key-filters w-full p-3 rounded-xl"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="filter-section-header">
		<div class="filter-section-header-start">
			<span class="filter-section-header-label">Key filters</span>
			<Tooltip
				text="Filter layouts by keys in specific positions. Include AND requires every filled position to match. Include OR matches if any filled position matches. Exclude removes layouts that place unwanted keys at the given positions."
			/>
		</div>
		{#if hasActive}
			<button
				type="button"
				class="filter-reset-button shrink-0"
				onclick={() => filterStore.clearKeyFilters()}
			>
				Reset all
			</button>
		{/if}
	</div>

	<div class="filter-open-button-group">
		<button type="button" class="filter-open-button" onclick={() => open('and')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">
					Include keys (AND)
					{#if andActive}
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

		<button type="button" class="filter-open-button" onclick={() => open('or')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">
					Include keys (OR)
					{#if orActive}
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

		<button type="button" class="filter-open-button" onclick={() => open('exclude')}>
			<span class="filter-open-button-text">
				<span class="filter-open-button-title">
					Exclude keys
					{#if excludeActive}
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

<KeyFiltersModal
	open={openKind !== null}
	kind={openKind}
	onClose={() => (openKind = null)}
/>
