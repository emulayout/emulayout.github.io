<script lang="ts">
	import SimilarityFiltersBody from '$lib/components/SimilarityFiltersBody.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layouts: LayoutData[];
	}

	let { layouts }: Props = $props();

	let open = $state(false);
	let focusToken = $state(0);

	const hasActive = $derived(filterStore.hasSimilarReference);
	const showReset = $derived(hasActive || filterStore.hasModifiedSimilarityFilter);
	const panelId = 'similarity-filters-accordion-panel';

	function resetAll() {
		filterStore.clearSimilarReference();
		filterStore.resetSimilarityFilter();
	}

	function toggle() {
		open = !open;
		if (!open) focusToken = 0;
	}

	$effect(() => {
		const req = takeFilterFocusRequest('sidebar');
		if (!req || req.field !== 'similarity') return;
		open = true;
		focusToken = req.seq;
	});

	$effect(() => {
		if (!open || !focusToken) return;
		afterPaint(() => {
			const el =
				document.getElementById('similarity-match-value') ??
				document.getElementById('similarity-layout-search');
			focusFilterControl(el);
		});
	});
</script>

<div
	class="filter-accordion"
	class:filter-accordion--open={open}
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="filter-accordion-header">
		<button
			type="button"
			class="filter-accordion-trigger"
			aria-expanded={open}
			aria-controls={panelId}
			onclick={toggle}
		>
			<span class="sr-only">
				Similarity filter{#if hasActive}, active filters{/if}
			</span>
		</button>
		<div class="filter-accordion-header-face">
			<span class="filter-accordion-trigger-main">
				<svg
					class="filter-accordion-caret"
					class:filter-accordion-caret--expanded={open}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
				<span class="filter-accordion-trigger-label">
					Similarity filter
					{#if hasActive}
						<span class="filter-open-button-dot" aria-hidden="true"></span>
					{/if}
				</span>
			</span>
			<div class="filter-accordion-header-hint">
				<Tooltip
					text="Compare letter positions to a reference layout. Differing keys are highlighted on cards."
				/>
			</div>
			<span class="filter-accordion-header-spacer" aria-hidden="true"></span>
			{#if showReset}
				<div class="filter-accordion-header-actions">
					<button type="button" class="filter-reset-button shrink-0" onclick={resetAll}>
						Reset all
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if open}
		<div id={panelId} class="filter-accordion-panel" role="region" aria-label="Similarity filter">
			<SimilarityFiltersBody {layouts} />
		</div>
	{/if}
</div>
