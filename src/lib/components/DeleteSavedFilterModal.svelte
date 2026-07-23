<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		open: boolean;
		filterId: string | null;
		filterName: string;
		onClose: () => void;
	}

	let { open, filterId, filterName, onClose }: Props = $props();

	function confirmDelete() {
		if (!filterId) return;
		filterStore.deleteSavedFilter(filterId);
		onClose();
	}
</script>

<ModalShell {open} {onClose} labelledBy="delete-saved-filter-title" panelClass="max-w-md">
	<div
		class="flex items-center justify-between border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<h2
			id="delete-saved-filter-title"
			class="text-lg font-semibold"
			style="color: var(--text-primary);"
		>
			Delete view
		</h2>
		<button
			type="button"
			onclick={onClose}
			class="flex size-8 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="px-5 py-4">
		<p class="text-sm leading-relaxed" style="color: var(--text-secondary);">
			Delete <span style="color: var(--text-primary); font-weight: 600;">{filterName}</span>? This
			cannot be undone.
		</p>
	</div>

	<div
		class="flex items-center justify-end gap-2 border-t px-5 py-4"
		style="border-color: var(--border);"
	>
		<button type="button" class="filter-reset-button delete-saved-filter-button" onclick={onClose}>
			Cancel
		</button>
		<button
			type="button"
			class="filter-reset-button delete-saved-filter-button delete-saved-filter-button--danger"
			onclick={confirmDelete}
		>
			Delete
		</button>
	</div>
</ModalShell>

<style>
	.delete-saved-filter-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.delete-saved-filter-button--danger {
		border-color: color-mix(in srgb, var(--filter-action) 55%, var(--border));
		background-color: color-mix(in srgb, var(--filter-action) 16%, var(--bg-primary));
		color: var(--text-primary);
	}

	.delete-saved-filter-button--danger:hover {
		border-color: var(--filter-action);
		background-color: color-mix(in srgb, var(--filter-action) 24%, var(--bg-primary));
		color: var(--filter-action);
	}
</style>
