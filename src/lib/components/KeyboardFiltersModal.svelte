<script lang="ts">
	import KeyboardFiltersBody from '$lib/components/KeyboardFiltersBody.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import type { KeyboardFilterField } from '$lib/filterSummaries';

	interface Props {
		open: boolean;
		onClose: () => void;
		focusField?: KeyboardFilterField | null;
		focusToken?: number;
	}

	let { open, onClose, focusField = null, focusToken = 0 }: Props = $props();

	const hasActiveFilters = $derived(filterStore.hasActiveKeyboardFilters);
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="keyboard-filters-modal-title"
	panelClass="max-h-[min(92vh,900px)] max-w-md"
	initialFocusSelector={focusField ? `[data-keyboard-field="${focusField}"]` : null}
	initialFocusToken={focusToken}
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<div class="flex min-w-0 items-center gap-2">
			<h2
				id="keyboard-filters-modal-title"
				class="text-lg font-semibold shrink-0"
				style="color: var(--text-primary);"
			>
				Keyboard filters
			</h2>
			{#if hasActiveFilters}
				<button
					type="button"
					class="filter-reset-button"
					onclick={() => filterStore.clearKeyboardFilters()}
				>
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

	<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
		<KeyboardFiltersBody />
	</div>
</ModalShell>
