<script lang="ts">
	import ActiveFiltersAdjust from '$lib/components/ActiveFiltersAdjust.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import FiltersSidebarFooter from '$lib/components/FiltersSidebarFooter.svelte';
	import KeyFilters from '$lib/components/KeyFilters.svelte';
	import KeyboardFilters from '$lib/components/KeyboardFilters.svelte';
	import LayoutNameFilter from '$lib/components/LayoutNameFilter.svelte';
	import SimilarityFilters from '$lib/components/SimilarityFilters.svelte';
	import StatFilters from '$lib/components/StatFilters.svelte';
	import { buildActiveFiltersSnapshot, type ActiveFiltersSnapshot } from '$lib/activeFiltersAdjust';
	import { filterStore } from '$lib/filterStore.svelte';
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

	function exitAdjustMode() {
		adjustActive = false;
		adjustSnapshot = null;
	}

	function showAllFilters() {
		exitAdjustMode();
	}

	function hideInactiveFilters() {
		if (adjustActive || !filterStore.hasActiveFilters) return;
		adjustSnapshot = buildActiveFiltersSnapshot(filterStore);
		adjustActive = true;
	}

	function toggleInactiveFilters() {
		if (adjustActive) showAllFilters();
		else hideInactiveFilters();
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
		if (sidebarReq.field === 'similarity') return;

		afterPaint(() => {
			if (sidebarReq.field === 'name') {
				focusFilterControl(document.getElementById('name-filter'));
			} else if (sidebarReq.field === 'authors') {
				authorOpenSeq = sidebarReq.seq;
				document
					.getElementById('author-filter-trigger')
					?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
	<div class="filters-sidebar-panel">
		{#if adjustActive && adjustSnapshot}
			<div class="filters-sidebar-adjust">
				<ActiveFiltersAdjust snapshot={adjustSnapshot} {layouts} {authorList} {authorOpenSeq} />
			</div>
		{:else}
			<div class="filters-sidebar-search">
				<LayoutNameFilter />

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
				<SimilarityFilters {layouts} />
			</div>

			<div class="filters-sidebar-actions">
				<StatFilters />
			</div>
		{/if}
	</div>

	<FiltersSidebarFooter {adjustActive} onToggleInactiveFilters={toggleInactiveFilters} />
</div>

<style>
	.filters-sidebar {
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
			padding: 0.125rem 0.125rem var(--results-scroll-end-space, 4rem);
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
