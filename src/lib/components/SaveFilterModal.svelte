<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let name = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);

	const canSave = $derived(name.trim().length > 0);

	$effect(() => {
		if (!open) {
			name = '';
			return;
		}
		requestAnimationFrame(() => {
			nameInput?.focus();
			nameInput?.select();
		});
	});

	function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		filterStore.saveCurrentFilters(trimmed);
		onClose();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		}
	}
</script>

<ModalShell {open} {onClose} labelledBy="save-filter-title" panelClass="max-w-md">
	<div
		class="flex items-center justify-between border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<h2 id="save-filter-title" class="text-lg font-semibold" style="color: var(--text-primary);">
			Save as view
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
		<label class="flex flex-col gap-1.5">
			<span class="text-sm" style="color: var(--text-secondary);">Name</span>
			<input
				bind:this={nameInput}
				type="text"
				bind:value={name}
				onkeydown={handleKeyDown}
				placeholder="e.g. Home row vowels"
				class="w-full rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 transition-all duration-200"
				style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
					--tw-ring-color: var(--accent);
				"
			/>
		</label>
	</div>

	<div
		class="flex items-center justify-end gap-2 border-t px-5 py-4"
		style="border-color: var(--border);"
	>
		<button
			type="button"
			class="filter-reset-button save-filter-modal-button"
			onclick={onClose}
		>
			Cancel
		</button>
		<button
			type="button"
			class="filter-reset-button save-filter-modal-button save-filter-modal-button--primary"
			disabled={!canSave}
			onclick={submit}
		>
			Save
		</button>
	</div>
</ModalShell>

<style>
	.save-filter-modal-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.save-filter-modal-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.save-filter-modal-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.save-filter-modal-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
