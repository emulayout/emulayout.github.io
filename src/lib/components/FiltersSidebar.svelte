<script lang="ts">
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import KeyFilters from '$lib/components/KeyFilters.svelte';
	import KeyboardFiltersModal from '$lib/components/KeyboardFiltersModal.svelte';
	import SimilarityFilters from '$lib/components/SimilarityFilters.svelte';
	import StatFilters from '$lib/components/StatFilters.svelte';
	import { getKeyboardFiltersSummary } from '$lib/filterSummaries';
	import { filterStore } from '$lib/filterStore.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { Snippet } from 'svelte';

	interface Props {
		authorList: Array<{ id: number; name: string }>;
		layouts: LayoutData[];
		children?: Snippet;
	}

	let { authorList, layouts, children }: Props = $props();

	let showKeyboardFiltersModal = $state(false);
	const keyboardFiltersSummary = $derived(getKeyboardFiltersSummary(filterStore));
</script>

<div class="filters-sidebar">
	<div class="filters-sidebar-search">
		<label class="filters-field">
			<span class="filters-label" style="color: var(--text-secondary);">
				Layout name
				<span class="filters-hint" style="color: var(--text-caption);">
					(commas for multiple)
				</span>
			</span>
			<input
				id="name-filter"
				type="text"
				value={filterStore.nameFilterInput}
				oninput={(e) => filterStore.setNameFilter(e.currentTarget.value)}
				class="filters-input"
				style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
					--tw-ring-color: var(--accent);
				"
				placeholder="All layouts"
			/>
		</label>

		<div class="filters-field">
			<div class="filters-label" style="color: var(--text-secondary);">Author</div>
			<AuthorSelect
				authors={authorList}
				selectedIds={filterStore.selectedAuthors}
				onToggle={(id) => filterStore.toggleAuthor(id)}
				onClear={() => filterStore.clearAuthors()}
			/>
		</div>
	</div>

	<button
		type="button"
		class="filter-open-button"
		onclick={() => (showKeyboardFiltersModal = true)}
	>
		<span class="filter-open-button-text">
			<span class="filter-open-button-title">Keyboard filters</span>
				{#if keyboardFiltersSummary}
					<span class="filter-open-button-summary" title={keyboardFiltersSummary}
						>{keyboardFiltersSummary}</span
					>
				{/if}
		</span>
		<svg
			class="filter-open-button-chevron"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	</button>

	<div class="filters-sidebar-actions">
		<KeyFilters />
	</div>

	<div class="filters-sidebar-actions">
		<StatFilters />
	</div>

	<div class="filters-sidebar-actions">
		<SimilarityFilters {layouts} />
	</div>

	{#if children}
		<div class="filters-sidebar-extra">
			{@render children()}
		</div>
	{/if}

	{#if filterStore.hasActiveFilters}
		<div class="filters-sidebar-reset">
			<button
				type="button"
				class="filter-reset-button filters-sidebar-reset-button"
				onclick={() => filterStore.clearAll()}
			>
				Reset all
			</button>
		</div>
	{/if}
</div>

<KeyboardFiltersModal
	open={showKeyboardFiltersModal}
	onClose={() => (showKeyboardFiltersModal = false)}
/>

<style>
	.filters-sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-height: 100%;
	}

	.filters-sidebar-search,
	.filters-sidebar-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filters-sidebar-reset {
		margin-top: auto;
		padding-top: 0.75rem;
	}

	.filters-sidebar-reset-button {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.filters-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}

	.filters-label {
		font-size: 0.875rem;
		line-height: 1.25;
	}

	.filters-hint {
		font-size: 0.625rem;
		font-style: italic;
	}

	.filters-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
	}

	.filters-input:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.filters-sidebar-extra {
		min-width: 0;
	}
</style>
