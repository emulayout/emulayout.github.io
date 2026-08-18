<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';

	interface Props {
		open: boolean;
		layoutName: string;
		destination: string;
		onClose: () => void;
		onConfirm: () => void;
	}

	let { open, layoutName, destination, onClose, onConfirm }: Props = $props();
</script>

<ModalShell {open} {onClose} labelledBy="discard-creator-changes-title" panelClass="max-w-md">
	<ModalHeader
		titleId="discard-creator-changes-title"
		title="Discard changes?"
		{onClose}
		divider={false}
	/>

	<div class="px-5 py-4">
		<p class="text-sm leading-relaxed" style="color: var(--text-secondary);">
			Discard unsaved changes to
			<span style="color: var(--text-primary); font-weight: 600;">{layoutName}</span> and
			{destination}? This cannot be undone.
		</p>
	</div>

	<div class="flex items-center justify-end gap-2 px-5 pb-4">
		<button type="button" class="filter-reset-button discard-creator-button" onclick={onClose}>
			Cancel
		</button>
		<button
			type="button"
			class="filter-reset-button discard-creator-button discard-creator-button--danger"
			onclick={onConfirm}
		>
			Discard changes
		</button>
	</div>
</ModalShell>

<style>
	.discard-creator-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.discard-creator-button--danger {
		border-color: color-mix(in srgb, var(--filter-action) 55%, var(--border));
		background-color: color-mix(in srgb, var(--filter-action) 16%, var(--bg-primary));
		color: var(--text-primary);
	}

	.discard-creator-button--danger:hover {
		border-color: var(--filter-action);
		background-color: color-mix(in srgb, var(--filter-action) 24%, var(--bg-primary));
		color: var(--filter-action);
	}
</style>
