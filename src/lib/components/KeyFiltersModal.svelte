<script lang="ts">
	import KeyPositionFiltersBody from '$lib/components/KeyPositionFiltersBody.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const hasActiveFilters = $derived(filterStore.hasActiveKeyFilters);
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="key-filters-modal-title"
	panelClass="max-h-[min(92vh,900px)] max-w-xl"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<div class="flex min-w-0 items-center gap-2">
			<h2
				id="key-filters-modal-title"
				class="text-lg font-semibold shrink-0"
				style="color: var(--text-primary);"
			>
				Key filters
			</h2>
			{#if hasActiveFilters}
				<button
					type="button"
					class="key-filters-modal-clear"
					style="color: var(--accent); background-color: var(--bg-secondary);"
					onclick={() => filterStore.clearKeyFilters()}
				>
					Clear all
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

	<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
		<p class="key-filters-modal-intro" style="color: var(--text-secondary);">
			Filter layouts by keys in specific positions. Include AND requires every filled position to
			match. Include OR matches if any filled position matches. Exclude removes layouts that place
			unwanted keys at the given positions.
		</p>
		<KeyPositionFiltersBody stacked />
	</div>
</ModalShell>

<style>
	.key-filters-modal-clear {
		padding: 0.25rem 0.5rem;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		cursor: pointer;
	}

	.key-filters-modal-intro {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		line-height: 1.45;
	}
</style>
