<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';

	interface Props {
		open: boolean;
		layoutName: string;
		onClose: () => void;
		onConfirm: () => void;
	}

	let { open, layoutName, onClose, onConfirm }: Props = $props();
</script>

<ModalShell {open} {onClose} labelledBy="delete-saved-layout-title" panelClass="max-w-md">
	<ModalHeader
		titleId="delete-saved-layout-title"
		title="Delete layout"
		{onClose}
		divider={false}
	/>

	<div class="px-5 py-4">
		<p class="text-sm leading-relaxed" style="color: var(--text-secondary);">
			Delete <span style="color: var(--text-primary); font-weight: 600;">{layoutName}</span>? This
			cannot be undone.
		</p>
	</div>

	<div class="flex items-center justify-end gap-2 px-5 pb-4">
		<button type="button" class="filter-reset-button delete-saved-layout-button" onclick={onClose}>
			Cancel
		</button>
		<button
			type="button"
			class="filter-reset-button delete-saved-layout-button delete-saved-layout-button--danger"
			onclick={onConfirm}
		>
			Delete
		</button>
	</div>
</ModalShell>

<style>
	.delete-saved-layout-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.delete-saved-layout-button--danger {
		border-color: color-mix(in srgb, var(--filter-action) 55%, var(--border));
		background-color: color-mix(in srgb, var(--filter-action) 16%, var(--bg-primary));
		color: var(--text-primary);
	}

	.delete-saved-layout-button--danger:hover {
		border-color: var(--filter-action);
		background-color: color-mix(in srgb, var(--filter-action) 24%, var(--bg-primary));
		color: var(--filter-action);
	}
</style>
