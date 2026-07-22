<script lang="ts">
	import KeyboardFiltersBody from '$lib/components/KeyboardFiltersBody.svelte';
	import type { KeyboardFilterField } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';

	let open = $state(false);
	let focusField = $state<KeyboardFilterField | null>(null);
	let focusToken = $state(0);

	const hasActive = $derived(filterStore.hasActiveKeyboardFilters);
	const panelId = 'keyboard-filters-accordion-panel';

	function toggle() {
		open = !open;
		if (!open) focusField = null;
	}

	$effect(() => {
		const req = takeFilterFocusRequest('keyboard');
		if (!req) return;
		open = true;
		focusField = req.field;
		focusToken = req.seq;
	});

	$effect(() => {
		if (!open || !focusField || !focusToken) return;
		const field = focusField;
		afterPaint(() => {
			focusFilterControl(
				document.querySelector<HTMLElement>(`#${panelId} [data-keyboard-field="${field}"]`)
			);
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
				Keyboard filters{#if hasActive}, active filters{/if}
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
					Keyboard filters
					{#if hasActive}
						<span class="filter-open-button-dot" aria-hidden="true"></span>
					{/if}
				</span>
			</span>
			<span class="filter-accordion-header-spacer" aria-hidden="true"></span>
			{#if hasActive}
				<div class="filter-accordion-header-actions">
					<button
						type="button"
						class="filter-reset-button shrink-0"
						onclick={() => filterStore.clearKeyboardFilters()}
					>
						Reset all
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if open}
		<div id={panelId} class="filter-accordion-panel" role="region" aria-label="Keyboard filters">
			<KeyboardFiltersBody />
		</div>
	{/if}
</div>
