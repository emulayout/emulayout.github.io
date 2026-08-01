<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	const open = $derived(filterStore.showSourceSelectionModal);

	let draftNames = $state<string[]>([]);

	const isDirty = $derived.by(() => {
		const active = filterStore.activeSourceLayoutNames ?? [];
		if (draftNames.length !== active.length) return true;
		return draftNames.some((name, index) => name !== active[index]);
	});

	$effect(() => {
		if (!open) return;
		draftNames = [...(filterStore.activeSourceLayoutNames ?? [])];
	});

	function handleClose() {
		filterStore.closeSourceSelectionModal();
	}

	function removeDraftName(name: string) {
		draftNames = draftNames.filter((entry) => entry !== name);
	}

	function handleUpdateSource() {
		if (!isDirty) return;
		filterStore.applySourceSelection(draftNames);
	}
</script>

<ModalShell {open} onClose={handleClose} labelledBy="source-selection-title" panelClass="max-w-md">
	<ModalHeader titleId="source-selection-title" title="Custom selection" onClose={handleClose} />

	<div class="px-5 py-4">
		<p class="mb-3 text-sm" style="color: var(--text-secondary);">
			This view is scoped to a custom source
		</p>
		{#if draftNames.length === 0}
			<p class="text-sm" style="color: var(--text-secondary);">No layouts in the source.</p>
		{:else}
			<ul class="source-selection-list" aria-label="Source layouts">
				{#each draftNames as name (name)}
					<li class="source-selection-item">
						<span class="source-selection-name" style="color: var(--text-primary);">{name}</span>
						<button
							type="button"
							class="source-selection-remove"
							style="color: var(--text-secondary);"
							aria-label="Remove {name} from source"
							onclick={() => removeDraftName(name)}
						>
							<svg
								class="size-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
								aria-hidden="true"
							>
								<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div
		class="flex items-center justify-end gap-2 border-t px-5 py-4"
		style="border-color: var(--border);"
	>
		{#if isDirty}
			<button
				type="button"
				class="filter-reset-button source-selection-button"
				onclick={handleClose}
			>
				Cancel
			</button>
			<button
				type="button"
				class="filter-reset-button source-selection-button source-selection-button--primary"
				onclick={handleUpdateSource}
			>
				Update source
			</button>
		{:else}
			<button
				type="button"
				class="filter-reset-button source-selection-button"
				onclick={handleClose}
			>
				Close
			</button>
		{/if}
	</div>
</ModalShell>

<style>
	.source-selection-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: min(50vh, 22rem);
		overflow-y: auto;
	}

	.source-selection-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.5rem 0.45rem 0.65rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 4%, var(--bg-primary));
	}

	.source-selection-name {
		flex: 1 1 auto;
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 500;
		word-break: break-word;
	}

	.source-selection-remove {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 9999px;
		border: none;
		background: transparent;
		cursor: pointer;
	}

	.source-selection-remove:hover {
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 8%, transparent);
	}

	.source-selection-remove:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.source-selection-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.source-selection-button--primary {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		background-color: color-mix(in srgb, var(--accent) 16%, var(--bg-primary));
		color: var(--accent);
	}

	.source-selection-button--primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
