<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let name = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);
	let error = $state('');

	const activeName = $derived(
		filterStore.savedFilters.find((entry) => entry.id === filterStore.activeSavedFilterId)?.name ??
			''
	);
	const canSave = $derived(name.trim().length > 0);

	$effect(() => {
		if (!open) {
			name = '';
			error = '';
			return;
		}
		name = activeName;
		error = '';
		requestAnimationFrame(() => {
			nameInput?.focus();
			nameInput?.select();
		});
	});

	function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		const ok = filterStore.renameActiveSavedView(trimmed);
		if (!ok) {
			error = 'That name is already used by another view.';
			return;
		}
		onClose();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		}
	}
</script>

<ModalShell {open} {onClose} labelledBy="rename-view-title" panelClass="max-w-md">
	<ModalHeader titleId="rename-view-title" title="Rename view" {onClose} />

	<div class="px-5 py-4">
		<label class="flex flex-col gap-1.5">
			<span class="text-sm" style="color: var(--text-secondary);">Name</span>
			<input
				bind:this={nameInput}
				type="text"
				bind:value={name}
				onkeydown={handleKeyDown}
				oninput={() => (error = '')}
				class="w-full rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 transition-all duration-200"
				style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
					--tw-ring-color: var(--accent);
				"
			/>
		</label>
		{#if error}
			<p class="mt-2 text-sm" style="color: var(--filter-action);">{error}</p>
		{/if}
	</div>

	<div
		class="flex items-center justify-end gap-2 border-t px-5 py-4"
		style="border-color: var(--border);"
	>
		<button type="button" class="filter-reset-button rename-view-modal-button" onclick={onClose}>
			Cancel
		</button>
		<button
			type="button"
			class="filter-reset-button rename-view-modal-button rename-view-modal-button--primary"
			disabled={!canSave}
			onclick={submit}
		>
			Rename
		</button>
	</div>
</ModalShell>

<style>
	.rename-view-modal-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.rename-view-modal-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.rename-view-modal-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.rename-view-modal-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
