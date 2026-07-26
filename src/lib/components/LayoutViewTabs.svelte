<script lang="ts">
	import DeleteSavedFilterModal from '$lib/components/DeleteSavedFilterModal.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	let deleteSavedFilterId = $state<string | null>(null);
	let deleteSavedFilterName = $state('');

	const selectedLayoutCount = $derived(filterStore.selectedLayoutNames.size);
	const allTabSelected = $derived(
		filterStore.layoutSource === 'all' && !filterStore.activeSavedFilterId
	);
	const selectedTabSelected = $derived(
		filterStore.layoutSource === 'selected' && !filterStore.activeSavedFilterId
	);

	function requestDeleteSavedFilter(id: string, name: string) {
		deleteSavedFilterId = id;
		deleteSavedFilterName = name;
	}

	function closeDeleteSavedFilterModal() {
		deleteSavedFilterId = null;
		deleteSavedFilterName = '';
	}
</script>

<div class="layout-view-tabs" role="tablist" aria-label="Layout view">
	<button
		type="button"
		role="tab"
		id="layout-view-tab-all"
		aria-selected={allTabSelected}
		tabindex={allTabSelected ? 0 : -1}
		class="layout-view-tab"
		class:layout-view-tab--selected={allTabSelected}
		onclick={() => filterStore.setLayoutSource('all')}
	>
		All layouts
	</button>
	<button
		type="button"
		role="tab"
		id="layout-view-tab-selected"
		aria-selected={selectedTabSelected}
		tabindex={selectedTabSelected ? 0 : -1}
		class="layout-view-tab"
		class:layout-view-tab--selected={selectedTabSelected}
		onclick={() => filterStore.setLayoutSource('selected')}
	>
		Selected layouts ({selectedLayoutCount})
	</button>
	{#each filterStore.savedFilters as saved (saved.id)}
		{@const savedSelected = filterStore.activeSavedFilterId === saved.id}
		<div class="layout-view-saved" class:layout-view-saved--selected={savedSelected}>
			<button
				type="button"
				role="tab"
				id={`layout-view-tab-saved-${saved.id}`}
				aria-selected={savedSelected}
				tabindex={savedSelected ? 0 : -1}
				class="layout-view-tab layout-view-tab--saved"
				class:layout-view-tab--selected={savedSelected}
				onclick={() => filterStore.applySavedFilter(saved.id)}
			>
				<span class="layout-view-tab-label">{saved.name}</span>
			</button>
			<button
				type="button"
				class="layout-view-tab-delete"
				aria-label={`Delete view ${saved.name}`}
				onclick={() => requestDeleteSavedFilter(saved.id, saved.name)}
			>
				<svg
					class="layout-view-tab-delete-icon"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<DeleteSavedFilterModal
	open={deleteSavedFilterId !== null}
	filterId={deleteSavedFilterId}
	filterName={deleteSavedFilterName}
	onClose={closeDeleteSavedFilterModal}
/>

<style>
	.layout-view-tabs {
		display: inline-flex;
		align-items: stretch;
		gap: 0.25rem;
		min-width: 0;
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.layout-view-tabs::-webkit-scrollbar {
		display: none;
	}

	.layout-view-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		margin-bottom: -1px;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25;
		white-space: nowrap;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.layout-view-tab--saved {
		padding-right: 0.25rem;
	}

	.layout-view-saved {
		display: inline-flex;
		align-items: center;
		margin-bottom: -1px;
		border-bottom: 2px solid transparent;
		min-width: 0;
	}

	.layout-view-saved--selected {
		border-bottom-color: var(--accent);
	}

	.layout-view-saved .layout-view-tab {
		margin-bottom: 0;
		border-bottom: none;
	}

	.layout-view-saved--selected .layout-view-tab {
		border-bottom: none;
	}

	.layout-view-tab-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 10rem;
	}

	.layout-view-tab-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-right: 0.25rem;
		padding: 0;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.layout-view-tab-delete:hover {
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 10%, transparent);
	}

	.layout-view-tab-delete:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.layout-view-tab-delete-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	.layout-view-tab:hover {
		color: var(--text-primary);
	}

	.layout-view-tab:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
		border-radius: 0.25rem;
	}

	.layout-view-tab--selected {
		color: var(--text-primary);
		font-weight: 600;
		border-bottom-color: var(--accent);
	}
</style>
