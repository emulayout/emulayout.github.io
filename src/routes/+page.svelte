<script lang="ts">
	import CompareLayoutsModal from '$lib/components/CompareLayoutsModal.svelte';
	import DeleteSavedFilterModal from '$lib/components/DeleteSavedFilterModal.svelte';
	import DisplaySettingsMenu from '$lib/components/DisplaySettingsMenu.svelte';
	import FiltersSidebar from '$lib/components/FiltersSidebar.svelte';
	import LayoutCardList from '$lib/components/LayoutCardList.svelte';
	import LayoutResultsToolbar from '$lib/components/LayoutResultsToolbar.svelte';
	import SharedViewModal from '$lib/components/SharedViewModal.svelte';
	import type { LayoutLikesMap } from '$lib/layout';
	import { filterStore } from '$lib/filterStore.svelte';
	import { analyzersNeededForLoad, isAnalyzerStatsReady } from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import {
		buildMirroredPositionMap,
		buildSimilarityMatchMap,
		isSimilarLayoutMatch,
		matchesSimilarityPercentFilter,
		sortLayoutsBySimilarity,
		withSimilarReferenceAnglemod
	} from '$lib/layoutSimilarity';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);
	/** `null` = not loaded yet; `{}` = loaded but empty/unavailable. */
	let likesData: LayoutLikesMap | null = $state(null);
	let showCompareModal = $state(false);
	/** How to seed the compare modal on the next open/session bump. */
	let compareSeedMode = $state<'restore' | 'selection' | 'reset'>('restore');
	let compareSession = $state(0);
	let deleteSavedFilterId = $state<string | null>(null);
	let deleteSavedFilterName = $state('');
	let showSharedViewModal = $state(false);
	const statsMaps = $derived({ ...data.statsMaps, ...layoutStatsStore.maps });
	let likesLoading = $state(false);
	const statsReady = $derived(
		filterStore.analyzersNeededForStatLimits.every((analyzer) =>
			isAnalyzerStatsReady(statsMaps, analyzer)
		)
	);
	const resultsPending = $derived(filterStore.statFiltersAwaitingStats(statsMaps, statsReady));
	const resolvedLikesData = $derived(likesData ?? {});
	const likesLoaded = $derived(likesData !== null);
	const likesSortAvailable = $derived(
		filterStore.showLayoutLikes && likesLoaded && Object.keys(resolvedLikesData).length > 0
	);

	$effect(() => {
		layoutsCatalog.hydrate(layouts, authorsData);
	});

	const analyzersToLoad = $derived(
		analyzersNeededForLoad({
			showStats: filterStore.showLayoutStats,
			displayMode: filterStore.statsAnalyzer,
			limits: filterStore.appliedStatLimits,
			sortBy: filterStore.sortBy
		})
	);

	$effect(() => {
		void layoutStatsStore.loadAnalyzers(analyzersToLoad);
	});

	// Page load already fetched likes when likes were not hidden (`likes !== 0`).
	$effect(() => {
		if (likesData !== null) return;
		if (data.likesAttempted) {
			likesData = data.likesData ?? {};
		}
	});

	$effect(() => {
		filterStore.setLikesDataAvailable(likesLoaded && Object.keys(resolvedLikesData).length > 0);
	});

	// Lazy-load when likes become visible. Track loaded vs empty separately so an empty/404
	// response never restarts the fetch (that loop only showed up in prod with missing file).
	$effect(() => {
		if (!filterStore.showLayoutLikes) return;
		if (likesLoaded || likesLoading) return;

		likesLoading = true;
		void fetch('/layout-likes.json')
			.then((response) => (response.ok ? response.json() : {}))
			.then((fetched: LayoutLikesMap) => {
				likesData = fetched ?? {};
			})
			.catch(() => {
				likesData = {};
			})
			.finally(() => {
				likesLoading = false;
			});
	});

	$effect(() => {
		if (!likesSortAvailable && filterStore.sortBy === 'likes') {
			filterStore.setSortBy('date');
		}
	});

	$effect(() => {
		if (!filterStore.hasSimilarReference && filterStore.sortBy === 'similarity') {
			filterStore.setSortBy('date');
		}
	});

	// Drop stale ?similar= / ?compare= when those layouts no longer exist
	$effect(() => {
		const name = filterStore.similarReferenceName;
		if (!name || layouts.length === 0) return;
		if (!layouts.some((layout) => layout.name === name)) {
			filterStore.clearSimilarReference();
		}
	});

	$effect(() => {
		if (layouts.length === 0 || filterStore.compareSelectedNames.size === 0) return;
		filterStore.pruneCompareLayouts(new Set(layouts.map((layout) => layout.name)));
	});

	const authorById = $derived(
		new Map<number, string>(Object.entries(authorsData).map(([name, id]) => [id as number, name]))
	);

	const authorList = $derived(
		Array.from(authorById.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	function getAuthorName(userId: number): string {
		return authorById.get(userId) ?? 'Unknown';
	}

	const similarReferenceLayout = $derived(
		filterStore.similarReferenceName
			? (layouts.find((layout) => layout.name === filterStore.similarReferenceName) ?? null)
			: null
	);

	/** Reference positions after the selected card's anglemod toggle (drives match + diffs). */
	const similarReferenceForCompare = $derived(
		similarReferenceLayout
			? withSimilarReferenceAnglemod(similarReferenceLayout, filterStore.similarReferenceAnglemod)
			: null
	);

	const similarityMatches = $derived.by(() => {
		if (!similarReferenceForCompare) return new Map();
		return buildSimilarityMatchMap(similarReferenceForCompare, layouts, {
			weightHomeKeys: filterStore.similarityWeightHomeKeys,
			mirrorMode: filterStore.similarityMirrorMode
		});
	});

	const mirroredReferencePositions = $derived.by(() => {
		if (!similarReferenceForCompare || filterStore.similarityMirrorMode === 'excluded') {
			return null;
		}
		return buildMirroredPositionMap(similarReferenceForCompare.positionBySlot);
	});

	const filteredResult = $derived.by(() => {
		if (resultsPending) {
			return {
				layouts: [] as typeof layouts,
				forceIncludedNames: new Set<string>(),
				hiddenSelectedCount: 0
			};
		}

		let result = filterStore.filterLayouts(layouts, statsMaps, statsReady, resolvedLikesData);

		if (filterStore.similarReferenceName) {
			result = result.filter((layout) => {
				if (
					!isSimilarLayoutMatch(filterStore.similarReferenceName, layout.name, similarityMatches)
				) {
					return false;
				}
				const info = similarityMatches.get(layout.name);
				if (info === undefined) return false;
				return matchesSimilarityPercentFilter(
					info.percent,
					filterStore.similarityFilterOperator,
					filterStore.appliedSimilarityFilterValue
				);
			});
		}

		const forceIncluded = new Set<string>();
		let hiddenSelectedCount = 0;

		// Count (and optionally inject) selected layouts that fail current filters.
		if (filterStore.layoutSource === 'all' && filterStore.compareSelectedNames.size > 0) {
			const present = new Set(result.map((layout) => layout.name));
			for (const layout of layouts) {
				if (
					!filterStore.compareSelectedNames.has(layout.name) ||
					layout.name === filterStore.similarReferenceName ||
					present.has(layout.name)
				) {
					continue;
				}
				hiddenSelectedCount += 1;
				if (filterStore.includeSelectedInResults) {
					result.push(layout);
					present.add(layout.name);
					forceIncluded.add(layout.name);
				}
			}
		}

		const sorted =
			filterStore.sortBy === 'similarity'
				? sortLayoutsBySimilarity(result, similarityMatches, filterStore.sortOrder)
				: filterStore.sortLayouts(result, statsMaps, resolvedLikesData);

		// Keep the similarity reference out of the match list — it's shown pinned
		// (sticky column at lg+, or first card below that).
		const referenceName = filterStore.similarReferenceName;
		const layoutsForList = referenceName
			? sorted.filter((layout) => layout.name !== referenceName)
			: sorted;

		return {
			layouts: layoutsForList,
			forceIncludedNames: forceIncluded,
			hiddenSelectedCount
		};
	});

	const filteredLayouts = $derived(filteredResult.layouts);
	const forceIncludedNames = $derived(filteredResult.forceIncludedNames);
	const hiddenSelectedCount = $derived(filteredResult.hiddenSelectedCount);
	const filteredCount = $derived(filteredLayouts.length);
	const compareSelectedCount = $derived(filterStore.compareSelectedNames.size);
	const allTabSelected = $derived(
		filterStore.layoutSource === 'all' && !filterStore.activeSavedFilterId
	);
	const selectedTabSelected = $derived(
		filterStore.layoutSource === 'selected' && !filterStore.activeSavedFilterId
	);
	const resultsViewKey = $derived(
		`${filterStore.layoutSource}:${filterStore.activeSavedFilterId ?? ''}`
	);

	function requestDeleteSavedFilter(id: string, name: string) {
		deleteSavedFilterId = id;
		deleteSavedFilterName = name;
	}

	function closeDeleteSavedFilterModal() {
		deleteSavedFilterId = null;
		deleteSavedFilterName = '';
	}

	$effect(() => {
		if (filterStore.pendingSharedView) {
			showSharedViewModal = true;
		}
	});

	$effect(() => {
		function handleOpenCompare(event: Event) {
			const detail = (event as CustomEvent<{ mode?: 'restore' | 'selection' | 'hotkey' }>).detail;
			const mode = detail?.mode ?? 'restore';

			if (mode === 'hotkey' && showCompareModal) {
				compareSeedMode = 'reset';
				compareSession += 1;
				return;
			}

			compareSeedMode = mode === 'selection' ? 'selection' : 'restore';
			compareSession += 1;
			showCompareModal = true;
		}

		window.addEventListener('emulayout:open-compare', handleOpenCompare);
		return () => window.removeEventListener('emulayout:open-compare', handleOpenCompare);
	});
</script>

<div class="page-root">
	<div class="layout-source-bar">
		<div class="layout-source-tabs" role="tablist" aria-label="Layout source">
			<button
				type="button"
				role="tab"
				id="layout-source-tab-all"
				aria-selected={allTabSelected}
				tabindex={allTabSelected ? 0 : -1}
				class="layout-source-tab"
				class:layout-source-tab--selected={allTabSelected}
				onclick={() => filterStore.setLayoutSource('all')}
			>
				All layouts
			</button>
			<button
				type="button"
				role="tab"
				id="layout-source-tab-selected"
				aria-selected={selectedTabSelected}
				tabindex={selectedTabSelected ? 0 : -1}
				class="layout-source-tab"
				class:layout-source-tab--selected={selectedTabSelected}
				onclick={() => filterStore.setLayoutSource('selected')}
			>
				Selected layouts ({compareSelectedCount})
			</button>
			{#each filterStore.savedFilters as saved (saved.id)}
				{@const savedSelected = filterStore.activeSavedFilterId === saved.id}
				<div class="layout-source-saved" class:layout-source-saved--selected={savedSelected}>
					<button
						type="button"
						role="tab"
						id={`layout-source-tab-saved-${saved.id}`}
						aria-selected={savedSelected}
						tabindex={savedSelected ? 0 : -1}
						class="layout-source-tab layout-source-tab--saved"
						class:layout-source-tab--selected={savedSelected}
						onclick={() => filterStore.applySavedFilter(saved.id)}
					>
						<span class="layout-source-tab-label">{saved.name}</span>
					</button>
					<button
						type="button"
						class="layout-source-tab-delete"
						aria-label={`Delete view ${saved.name}`}
						onclick={() => requestDeleteSavedFilter(saved.id, saved.name)}
					>
						<svg
							class="layout-source-tab-delete-icon"
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
		<DisplaySettingsMenu />
	</div>

	{#key resultsViewKey}
		<div class="results-layout">
			<aside class="results-sidebar">
				<FiltersSidebar {authorList} {layouts} />
			</aside>
			<div class="results-main min-w-0">
				<div class="results-toolbar">
					<LayoutResultsToolbar {filteredCount} {likesSortAvailable} />
				</div>
				<div class="results-list">
					{#if filterStore.layoutSource === 'selected' && compareSelectedCount === 0}
						<div class="results-empty" style="color: var(--text-secondary);">
							<p class="results-empty-title" style="color: var(--text-primary);">
								No layouts selected
							</p>
							<p>
								Switch to All layouts and use the checkbox on a layout card to add layouts here.
								Filters on this page only apply to your selection.
							</p>
						</div>
					{:else if !resultsPending}
						<LayoutCardList
							layouts={filteredLayouts}
							similarReference={similarReferenceLayout}
							{forceIncludedNames}
							{getAuthorName}
							likesData={resolvedLikesData}
							{statsMaps}
							{similarityMatches}
							similarDiffPositions={similarReferenceForCompare?.positionBySlot}
							similarMirrorDiffPositions={mirroredReferencePositions}
						/>
					{/if}
				</div>
				{#if filterStore.layoutSource === 'all' && compareSelectedCount > 0 && (filterStore.includeSelectedInResults || hiddenSelectedCount > 0)}
					<div class="compare-fab" role="presentation">
						<div class="compare-fab-group">
							<button
								type="button"
								class="compare-fab-button"
								class:compare-fab-button--active={filterStore.includeSelectedInResults}
								aria-pressed={filterStore.includeSelectedInResults}
								aria-label={filterStore.includeSelectedInResults
									? 'Always showing selected'
									: `Show (${hiddenSelectedCount}) non-matching selected`}
								onclick={() => filterStore.toggleIncludeSelectedInResults()}
							>
								{#if filterStore.includeSelectedInResults}
									Always showing selected layouts
								{:else}
									Show ({hiddenSelectedCount}) non-matching selected layout{hiddenSelectedCount ===
									1
										? ''
										: 's'}
								{/if}
							</button>
						</div>
					</div>
				{:else if filterStore.layoutSource === 'selected' && compareSelectedCount > 0}
					<div class="compare-fab" role="presentation">
						<div class="compare-fab-group">
							<button
								type="button"
								class="compare-fab-button compare-fab-button--with-icon"
								aria-label="Clear selected layouts"
								onclick={() => filterStore.clearCompareLayouts()}
							>
								Clear selected layouts
								<svg
									class="size-4 shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
									aria-hidden="true"
								>
									<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
								</svg>
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/key}
</div>

<CompareLayoutsModal
	open={showCompareModal}
	onClose={() => (showCompareModal = false)}
	seedMode={compareSeedMode}
	session={compareSession}
	{layouts}
	{getAuthorName}
	likesData={resolvedLikesData}
	{statsMaps}
/>

<DeleteSavedFilterModal
	open={deleteSavedFilterId !== null}
	filterId={deleteSavedFilterId}
	filterName={deleteSavedFilterName}
	onClose={closeDeleteSavedFilterModal}
/>

<SharedViewModal
	open={showSharedViewModal}
	onClose={() => {
		showSharedViewModal = false;
		filterStore.clearPendingSharedView();
	}}
/>

<style>
	.results-main {
		position: relative;
		min-width: 0;
	}

	.layout-source-bar {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
		width: 100%;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
		/* Room for the settings button focus ring / open border (page-root clips overflow). */
		padding: 0.125rem 0.25rem 0;
		box-sizing: border-box;
	}

	.layout-source-tabs {
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

	.layout-source-tabs::-webkit-scrollbar {
		display: none;
	}

	.layout-source-tab {
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

	.layout-source-tab--saved {
		padding-right: 0.25rem;
	}

	.layout-source-saved {
		display: inline-flex;
		align-items: center;
		margin-bottom: -1px;
		border-bottom: 2px solid transparent;
		min-width: 0;
	}

	.layout-source-saved--selected {
		border-bottom-color: var(--accent);
	}

	.layout-source-saved .layout-source-tab {
		margin-bottom: 0;
		border-bottom: none;
	}

	.layout-source-saved--selected .layout-source-tab {
		border-bottom: none;
	}

	.layout-source-tab-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 10rem;
	}

	.layout-source-tab-delete {
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

	.layout-source-tab-delete:hover {
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 10%, transparent);
	}

	.layout-source-tab-delete:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.layout-source-tab-delete-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	.layout-source-tab:hover {
		color: var(--text-primary);
	}

	.layout-source-tab:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
		border-radius: 0.25rem;
	}

	.layout-source-tab--selected {
		color: var(--text-primary);
		font-weight: 600;
		border-bottom-color: var(--accent);
	}

	.layout-source-bar :global(.display-settings-menu) {
		align-self: center;
		margin-bottom: 0.25rem;
	}

	.results-empty {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem 0.75rem;
		font-size: 0.875rem;
		line-height: 1.45;
		max-width: 28rem;
	}

	.results-empty-title {
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.compare-fab {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 1.25rem;
		z-index: 40;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.compare-fab {
			/* Center within the results column, not the full viewport. */
			position: absolute;
		}
	}

	.compare-fab-group {
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.compare-fab-button {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		color: var(--text-primary);
		background-color: var(--bg-secondary);
		border: 1px solid var(--border);
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--accent) 45%, transparent);
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.compare-fab-button--with-icon {
		gap: 0.375rem;
		padding-right: 0.625rem;
	}

	.compare-fab-button:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.compare-fab-button--active {
		color: var(--accent);
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, var(--bg-secondary));
		box-shadow: 0 4px 16px color-mix(in srgb, var(--text-primary) 8%, transparent);
	}

	.page-root {
		display: flex;
		flex-direction: column;
		min-height: 0;
		width: 100%;
	}

	.results-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		align-items: start;
		min-width: 0;
		min-height: 0;
	}

	.results-toolbar {
		flex-shrink: 0;
		/* Room for focus rings clipped by results-main overflow:hidden. */
		padding: 0.25rem;
	}

	.results-list {
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--text-caption) 70%, transparent) transparent;
	}

	.results-list::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.results-list::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--text-caption) 70%, transparent);
		border-radius: 999px;
	}

	.results-list::-webkit-scrollbar-track {
		background: transparent;
	}

	@media (min-width: 768px) {
		.page-root {
			flex: 1 1 0;
			min-height: 0;
			overflow: hidden;
		}

		.results-layout {
			flex: 1 1 0;
			min-height: 0;
			overflow: hidden;
			align-items: stretch;
			/* Fixed filter rail + flexible results (not 1fr+Nfr — that made the rail huge). */
			grid-template-columns: 20.25rem minmax(0, 1fr);
			gap: 0 1rem;
		}

		.results-sidebar {
			display: flex;
			flex-direction: column;
			min-height: 0;
			overflow: hidden;
			/* Room for focus rings — overflow-x:hidden otherwise clips the left edge. */
			padding-left: 0.25rem;
			padding-right: 0.25rem;
		}

		.results-main {
			position: relative;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			/* border-left: 1px solid var(--border); */
			/* padding-left: 1rem; */
			min-width: 0;
		}

		.results-list {
			flex: 1 1 0;
			min-height: 0;
			overflow: hidden;
		}
	}
</style>
