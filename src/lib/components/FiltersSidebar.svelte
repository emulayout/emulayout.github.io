<script lang="ts">
	import ActiveFiltersAdjust from '$lib/components/ActiveFiltersAdjust.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import KeyFilters from '$lib/components/KeyFilters.svelte';
	import KeyboardFilters from '$lib/components/KeyboardFilters.svelte';
	import SimilarityFilters from '$lib/components/SimilarityFilters.svelte';
	import StatFilters from '$lib/components/StatFilters.svelte';
	import { buildActiveFiltersSnapshot, type ActiveFiltersSnapshot } from '$lib/activeFiltersAdjust';
	import { getActiveFilterChips } from '$lib/filterSummaries';
	import { filterStore, type LayoutSource } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		authorList: Array<{ id: number; name: string }>;
		layouts: LayoutData[];
	}

	let { authorList, layouts }: Props = $props();

	let authorOpenSeq = $state(0);
	let adjustActive = $state(false);
	let adjustSnapshot = $state<ActiveFiltersSnapshot | null>(null);
	const canShowActive = $derived(filterStore.hasActiveFilters);
	const activeFilterCount = $derived.by(() => {
		void filterStore.appliedFiltersRevision;
		return getActiveFilterChips(filterStore).length;
	});
	const activeTabLabel = $derived(
		activeFilterCount > 0 ? `Active (${activeFilterCount})` : 'Active'
	);

	function exitAdjustMode() {
		adjustActive = false;
		adjustSnapshot = null;
	}

	function showAllFilters() {
		exitAdjustMode();
	}

	function showActiveFilters() {
		if (adjustActive || !filterStore.hasActiveFilters) return;
		adjustSnapshot = buildActiveFiltersSnapshot(filterStore);
		adjustActive = true;
	}

	$effect(() => {
		if (adjustActive && !filterStore.hasActiveFilters) {
			exitAdjustMode();
		}
	});

	$effect(() => {
		const sidebarReq = takeFilterFocusRequest('sidebar');
		if (!sidebarReq) return;

		exitAdjustMode();
		afterPaint(() => {
			if (sidebarReq.field === 'source') {
				focusFilterControl(document.getElementById('layout-source-filter'));
			} else if (sidebarReq.field === 'name') {
				focusFilterControl(document.getElementById('name-filter'));
			} else if (sidebarReq.field === 'authors') {
				authorOpenSeq = sidebarReq.seq;
				document
					.getElementById('author-filter-trigger')
					?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			} else if (sidebarReq.field === 'similarity') {
				const el =
					document.getElementById('similarity-match-value') ??
					document.getElementById('similarity-layout-search');
				focusFilterControl(el);
			}
		});
	});

	// Chip focus opens section components; exit adjust so controls can show.
	$effect(() => {
		const keyboardReq = takeFilterFocusRequest('keyboard');
		if (keyboardReq) {
			exitAdjustMode();
			return;
		}
		const keysReq = takeFilterFocusRequest('keys');
		if (keysReq) {
			exitAdjustMode();
			return;
		}
		const statsReq = takeFilterFocusRequest('stats');
		if (statsReq) exitAdjustMode();
	});
</script>

<div class="filters-sidebar">
	<div
		class="filters-sidebar-tabs"
		style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		role="tablist"
		aria-label="Filter views"
	>
		<button
			type="button"
			role="tab"
			id="filters-view-tab-all"
			aria-selected={!adjustActive}
			aria-controls="filters-view-panel"
			tabindex={adjustActive ? -1 : 0}
			class="filters-sidebar-tab"
			class:filters-sidebar-tab--selected={!adjustActive}
			onclick={showAllFilters}
		>
			All filters
		</button>
		<button
			type="button"
			role="tab"
			id="filters-view-tab-active"
			aria-selected={adjustActive}
			aria-controls="filters-view-panel"
			aria-disabled={!canShowActive}
			disabled={!canShowActive}
			tabindex={adjustActive ? 0 : -1}
			class="filters-sidebar-tab"
			class:filters-sidebar-tab--selected={adjustActive}
			class:filters-sidebar-tab--disabled={!canShowActive}
			onclick={showActiveFilters}
		>
			{activeTabLabel}
		</button>
	</div>

	<div
		id="filters-view-panel"
		class="filters-sidebar-panel"
		role="tabpanel"
		aria-labelledby={adjustActive ? 'filters-view-tab-active' : 'filters-view-tab-all'}
	>
		{#if adjustActive && adjustSnapshot}
			<div class="filters-sidebar-adjust">
				<ActiveFiltersAdjust snapshot={adjustSnapshot} {layouts} {authorList} {authorOpenSeq} />
			</div>
		{:else}
			<div class="filters-sidebar-search">
				<label class="filters-field">
					<span class="filters-label" style="color: var(--text-secondary);">Source</span>
					<select
						id="layout-source-filter"
						value={filterStore.layoutSource}
						onchange={(e) => filterStore.setLayoutSource(e.currentTarget.value as LayoutSource)}
						class="filters-select"
						style="
							background-color: var(--input-bg);
							color: var(--text-primary);
							border: 1px solid var(--border);
							--tw-ring-color: var(--accent);
						"
						aria-label="Layout source"
					>
						<option value="all">All layouts</option>
						<option value="selected" disabled={filterStore.compareSelectedNames.size === 0}>
							Selected layouts only
						</option>
					</select>
				</label>

				<label class="filters-field">
					<span class="filters-label" style="color: var(--text-secondary);">Layout name</span>
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
						placeholder="Use commas for multiple results"
					/>
				</label>

				<div class="filters-field">
					<div class="filters-label" style="color: var(--text-secondary);">Author</div>
					<AuthorSelect
						authors={authorList}
						selectedIds={filterStore.selectedAuthors}
						onToggle={(id) => filterStore.toggleAuthor(id)}
						onClear={() => filterStore.clearAuthors()}
						openSeq={authorOpenSeq}
					/>
				</div>
			</div>

			<div class="filters-sidebar-actions">
				<KeyboardFilters />
			</div>

			<div class="filters-sidebar-actions">
				<KeyFilters />
			</div>

			<div class="filters-sidebar-actions">
				<StatFilters />
			</div>

			<div class="filters-sidebar-actions">
				<SimilarityFilters {layouts} />
			</div>
		{/if}
	</div>

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

<style>
	.filters-sidebar {
		--filters-chrome-gap: 0.75rem;
		--filters-chrome-edge: 0.25rem;
		--filters-reset-pad: 1rem;

		display: flex;
		flex-direction: column;
		gap: 0;
		padding-top: var(--filters-chrome-edge);
		padding-bottom: var(--filters-reset-pad);
		box-sizing: border-box;
		min-width: 0;
	}

	.filters-sidebar-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.25rem;
		padding: 0.25rem;
		border-radius: 0.75rem;
		flex-shrink: 0;
		margin-bottom: var(--filters-chrome-gap);
	}

	.filters-sidebar-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding: 0.4375rem 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.25;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.filters-sidebar-tab:hover {
		color: var(--text-primary);
	}

	.filters-sidebar-tab:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.filters-sidebar-tab--selected {
		background-color: var(--bg-primary);
		border-color: var(--border);
		color: var(--text-primary);
		font-weight: 600;
	}

	.filters-sidebar-tab--disabled,
	.filters-sidebar-tab:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.filters-sidebar-tab--disabled:hover,
	.filters-sidebar-tab:disabled:hover {
		color: var(--text-secondary);
	}

	.filters-sidebar-panel {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.filters-sidebar-search,
	.filters-sidebar-actions,
	.filters-sidebar-adjust {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filters-sidebar-reset {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		padding-top: var(--filters-reset-pad);
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

	.filters-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
	}

	.filters-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
	}

	.filters-input:focus-visible,
	.filters-select:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.filters-input:-webkit-autofill:focus-visible {
		box-shadow:
			0 0 0 1000px var(--input-bg) inset,
			0 0 0 2px var(--accent);
	}

	/* Split view: fill the rail and scroll the filter body independently. */
	@media (min-width: 768px) {
		.filters-sidebar {
			flex: 1 1 auto;
			min-height: 0;
			height: 100%;
		}

		.filters-sidebar-panel {
			flex: 1 1 0;
			min-height: 0;
			overflow-x: hidden;
			overflow-y: auto;
			overscroll-behavior: contain;
			-webkit-overflow-scrolling: touch;
			/* Room for focus rings clipped by overflow. */
			padding: 0.125rem;
			margin: -0.125rem;
			scrollbar-width: thin;
			scrollbar-color: color-mix(in srgb, var(--text-caption) 70%, transparent) transparent;
		}

		.filters-sidebar-panel::-webkit-scrollbar {
			width: 8px;
			height: 8px;
		}

		.filters-sidebar-panel::-webkit-scrollbar-thumb {
			background: color-mix(in srgb, var(--text-caption) 70%, transparent);
			border-radius: 999px;
		}

		.filters-sidebar-panel::-webkit-scrollbar-track {
			background: transparent;
		}
	}
</style>
