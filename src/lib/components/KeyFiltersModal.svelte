<script lang="ts">
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import type { KeyFilterKind } from '$lib/filterSummaries';

	interface Props {
		open: boolean;
		kind: KeyFilterKind | null;
		onClose: () => void;
	}

	let { open, kind, onClose }: Props = $props();

	const title = $derived(
		kind === 'and'
			? 'Include keys (AND)'
			: kind === 'or'
				? 'Include keys (OR)'
				: kind === 'exclude'
					? 'Exclude keys'
					: 'Key filters'
	);

	const intro = $derived(
		kind === 'and'
			? 'Every filled position must match. Multiple keys in a cell match any of them at that position.'
			: kind === 'or'
				? 'At least one filled position must match. Multiple keys in a cell match any of them at that position.'
				: kind === 'exclude'
					? 'Exclude layouts that match any filled position. Multiple keys in a cell exclude any of them at that position.'
					: ''
	);

	const hasActiveFilters = $derived.by(() => {
		if (kind === 'and') {
			return (
				filterStore.includeGrid.some((row) => row.some((cell) => cell !== '')) ||
				filterStore.includeLeftThumbKeys.some((key) => key !== '') ||
				filterStore.includeRightThumbKeys.some((key) => key !== '')
			);
		}
		if (kind === 'or') {
			return (
				filterStore.includeOrGrid.some((row) => row.some((cell) => cell !== '')) ||
				filterStore.includeOrLeftThumbKeys.some((key) => key !== '') ||
				filterStore.includeOrRightThumbKeys.some((key) => key !== '')
			);
		}
		if (kind === 'exclude') {
			return (
				filterStore.excludeGrid.some((row) => row.some((cell) => cell !== '')) ||
				filterStore.excludeLeftThumbKeys.some((key) => key !== '') ||
				filterStore.excludeRightThumbKeys.some((key) => key !== '')
			);
		}
		return false;
	});

	function clearActiveKind() {
		if (kind === 'and') filterStore.clearInclude();
		else if (kind === 'or') filterStore.clearIncludeOr();
		else if (kind === 'exclude') filterStore.clearExclude();
	}

	const hideThumbKeys = $derived(filterStore.thumbKeyFilter === 'excluded');
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="key-filters-modal-title"
	panelClass="max-h-[min(92vh,900px)] !w-fit max-w-[calc(100vw-2rem)]"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-3 py-3"
		style="border-color: var(--border);"
	>
		<div class="flex min-w-0 items-center gap-2">
			<h2
				id="key-filters-modal-title"
				class="text-lg font-semibold shrink-0"
				style="color: var(--text-primary);"
			>
				{title}
			</h2>
			{#if hasActiveFilters}
				<button type="button" class="filter-reset-button" onclick={clearActiveKind}>
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

	<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
		{#if intro}
			<p class="key-filters-modal-intro" style="color: var(--text-secondary);">{intro}</p>
		{/if}

		{#if kind === 'and'}
			<KeyPositionFilter
				grid={filterStore.includeGrid}
				leftThumbKeys={filterStore.includeLeftThumbKeys}
				rightThumbKeys={filterStore.includeRightThumbKeys}
				{hideThumbKeys}
				accentColor="#4ade80"
				nested
				onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
				onLeftThumbKeyChange={(index, value) => filterStore.setIncludeLeftThumbKey(index, value)}
				onRightThumbKeyChange={(index, value) => filterStore.setIncludeRightThumbKey(index, value)}
			/>
		{:else if kind === 'or'}
			<KeyPositionFilter
				grid={filterStore.includeOrGrid}
				leftThumbKeys={filterStore.includeOrLeftThumbKeys}
				rightThumbKeys={filterStore.includeOrRightThumbKeys}
				{hideThumbKeys}
				accentColor="#60a5fa"
				nested
				onCellChange={(row, col, value) => filterStore.setIncludeOrCell(row, col, value)}
				onLeftThumbKeyChange={(index, value) => filterStore.setIncludeOrLeftThumbKey(index, value)}
				onRightThumbKeyChange={(index, value) => filterStore.setIncludeOrRightThumbKey(index, value)}
			/>
		{:else if kind === 'exclude'}
			<KeyPositionFilter
				grid={filterStore.excludeGrid}
				leftThumbKeys={filterStore.excludeLeftThumbKeys}
				rightThumbKeys={filterStore.excludeRightThumbKeys}
				{hideThumbKeys}
				accentColor="#f87171"
				nested
				onCellChange={(row, col, value) => filterStore.setExcludeCell(row, col, value)}
				onLeftThumbKeyChange={(index, value) => filterStore.setExcludeLeftThumbKey(index, value)}
				onRightThumbKeyChange={(index, value) => filterStore.setExcludeRightThumbKey(index, value)}
			/>
		{/if}
	</div>
</ModalShell>

<style>
	.key-filters-modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		line-height: 1.4;
	}
</style>
