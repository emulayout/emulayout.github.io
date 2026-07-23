<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		chipSourceFromViewSnapshot,
		getActiveFilterChips
	} from '$lib/filterSummaries';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let viewName = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);

	const pending = $derived(filterStore.pendingSharedView);
	const canSave = $derived(viewName.trim().length > 0);

	const chips = $derived.by(() => {
		if (!pending) return [];
		return getActiveFilterChips(
			chipSourceFromViewSnapshot(pending.snapshot, {
				canUseLikes: filterStore.canUseLikes
			})
		);
	});

	$effect(() => {
		if (!open) return;
		viewName = pending?.name ?? '';
		requestAnimationFrame(() => {
			nameInput?.focus();
			nameInput?.select();
		});
	});

	function handleCancel() {
		filterStore.clearPendingSharedView();
		onClose();
	}

	function handleApply() {
		if (!pending) return;
		filterStore.applySharedViewToAll(pending.snapshot);
		onClose();
	}

	function handleSaveAsView() {
		if (!pending) return;
		const trimmed = viewName.trim();
		if (!trimmed) return;
		filterStore.saveSharedViewAsView(trimmed, pending.snapshot);
		onClose();
	}

	function handleNameKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSaveAsView();
		}
	}
</script>

<ModalShell
	{open}
	onClose={handleCancel}
	labelledBy="shared-view-title"
	panelClass="max-w-lg"
>
	<div
		class="flex items-center justify-between border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<h2 id="shared-view-title" class="text-lg font-semibold" style="color: var(--text-primary);">
			Shared view
		</h2>
		<button
			type="button"
			onclick={handleCancel}
			class="flex size-8 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="flex flex-col gap-4 px-5 py-4">
		<label class="flex flex-col gap-1.5">
			<span class="text-sm" style="color: var(--text-secondary);">View name</span>
			<input
				bind:this={nameInput}
				type="text"
				bind:value={viewName}
				onkeydown={handleNameKeyDown}
				class="w-full rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 transition-all duration-200"
				style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
					--tw-ring-color: var(--accent);
				"
			/>
		</label>

		<div class="flex flex-col gap-2">
			<span class="text-sm" style="color: var(--text-secondary);">Filters</span>
			{#if chips.length === 0}
				<p class="text-sm" style="color: var(--text-secondary);">No active filters.</p>
			{:else}
				<ul class="shared-view-chips" aria-label="Shared filters">
					{#each chips as chip (chip.id)}
						<li
							class="shared-view-chip shared-view-chip--{chip.tone}"
							title={chip.title}
						>
							{chip.label}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<div class="shared-view-actions border-t px-5 py-4" style="border-color: var(--border);">
		<button type="button" class="filter-reset-button shared-view-button" onclick={handleApply}>
			Apply filters
		</button>
		<div class="shared-view-actions-end">
			<button type="button" class="filter-reset-button shared-view-button" onclick={handleCancel}>
				Cancel
			</button>
			<button
				type="button"
				class="filter-reset-button shared-view-button shared-view-button--primary"
				disabled={!canSave}
				onclick={handleSaveAsView}
			>
				Save as view
			</button>
		</div>
	</div>
</ModalShell>

<style>
	.shared-view-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.shared-view-chip {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		padding: 0.25rem 0.55rem;
		border-radius: 9999px;
		border: 1px solid var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 6%, var(--bg-primary));
		color: var(--text-primary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shared-view-chip--monkeyracer {
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cmini) 16%, var(--bg-primary));
		color: var(--analyzer-cmini);
	}

	.shared-view-chip--cyanophage {
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cyanophage) 16%, var(--bg-primary));
		color: var(--analyzer-cyanophage);
	}

	.shared-view-chip--mana2 {
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-mana2) 16%, var(--bg-primary));
		color: var(--analyzer-mana2);
	}

	.shared-view-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.shared-view-actions-end {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-left: auto;
	}

	.shared-view-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.shared-view-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.shared-view-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.shared-view-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
