<script lang="ts">
	import { untrack } from 'svelte';
	import DisplaySettingsMenu from '$lib/components/DisplaySettingsMenu.svelte';
	import FiltersSidebar from '$lib/components/FiltersSidebar.svelte';
	import LayoutCardList from '$lib/components/LayoutCardList.svelte';
	import LayoutResultsToolbar from '$lib/components/LayoutResultsToolbar.svelte';
	import LayoutViewTabs from '$lib/components/LayoutViewTabs.svelte';
	import SelectedLayoutActions from '$lib/components/SelectedLayoutActions.svelte';
	import SharedViewModal from '$lib/components/SharedViewModal.svelte';
	import type { LayoutLikesMap } from '$lib/layout';
	import { filterStore } from '$lib/filterStore.svelte';
	import { analyzerShortLabel, type StatsAnalyzer } from '$lib/statsAnalyzers';
	import { isAnalyzerStatsReady } from '$lib/layoutStatsAccess';
	import { buildLayoutResults, createEmptyLayoutResults } from '$lib/layoutResults';
	import { analyzersNeededForLoad } from '$lib/statsUsage';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import {
		buildMirroredPositionMap,
		buildSimilarityMatchMap,
		withSimilarReferenceAnglemod
	} from '$lib/layoutSimilarity';
	import { compileLayoutInputRegistry } from '$lib/layoutInputBehaviors';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);
	const inputProfiles = $derived(compileLayoutInputRegistry(data.supplemental, layouts));
	/** `null` = not loaded yet; `{}` = loaded but empty/unavailable. */
	let lazyLikesData: LayoutLikesMap | null = $state(null);
	const pageLikesData = $derived(data.likesAttempted ? (data.likesData ?? {}) : null);
	const likesData = $derived(lazyLikesData ?? pageLikesData);
	const showSharedViewModal = $derived(Boolean(filterStore.pendingSharedView));
	const statsMaps = $derived(layoutStatsStore.maps);
	let likesLoading = $state(false);
	const statsReady = $derived(
		filterStore.analyzersNeededForStatLimits.every((analyzer) =>
			isAnalyzerStatsReady(statsMaps, analyzer)
		)
	);
	const resolvedLikesData = $derived(likesData ?? {});
	const likesLoaded = $derived(likesData !== null);
	const likesSortAvailable = $derived(
		filterStore.showLayoutLikes && likesLoaded && Object.keys(resolvedLikesData).length > 0
	);

	$effect(() => {
		layoutsCatalog.hydrate(layouts, authorsData, resolvedLikesData, inputProfiles);
	});

	const analyzersToLoad = $derived(
		analyzersNeededForLoad({
			showStats: filterStore.showLayoutStats,
			displayMode: filterStore.statsAnalyzer,
			limits: filterStore.appliedStatLimits,
			fingerWorkload: filterStore.appliedFingerWorkload,
			sortBy: filterStore.sortBy
		})
	);
	const statsLoadErrors = $derived.by(() =>
		analyzersToLoad.flatMap((analyzer) => {
			const error = layoutStatsStore.getLoadError(analyzer);
			return error ? [{ analyzer, error }] : [];
		})
	);
	const failedStatFilterAnalyzers = $derived(
		filterStore.analyzersNeededForStatLimits.filter((analyzer) =>
			Boolean(layoutStatsStore.getLoadError(analyzer))
		)
	);
	const resultsBlockedByStatsError = $derived(failedStatFilterAnalyzers.length > 0);
	const resultsPending = $derived(
		!resultsBlockedByStatsError && filterStore.statFiltersAwaitingStats(statsMaps, statsReady)
	);

	$effect(() => {
		void layoutStatsStore.activeCorpus;
		const analyzers = analyzersToLoad;

		untrack(() => {
			void layoutStatsStore.loadAnalyzers(analyzers);
		});
	});

	function retryStatsLoads(analyzers: Iterable<StatsAnalyzer>) {
		void layoutStatsStore.retryAnalyzers(analyzers);
	}

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
				lazyLikesData = fetched ?? {};
			})
			.catch(() => {
				lazyLikesData = {};
			})
			.finally(() => {
				likesLoading = false;
			});
	});

	// Drop stale ?similar= / ?selected= entries when those layouts no longer exist.
	$effect(() => {
		const name = filterStore.similarReferenceName;
		if (!name || layouts.length === 0) return;
		if (!layouts.some((layout) => layout.name === name)) {
			filterStore.clearSimilarReference();
		}
	});

	$effect(() => {
		if (layouts.length === 0 || filterStore.selectedLayoutNames.size === 0) return;
		filterStore.pruneSelectedLayouts(new Set(layouts.map((layout) => layout.name)));
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
			return createEmptyLayoutResults();
		}

		return buildLayoutResults({
			catalogLayouts: layouts,
			filteredLayouts: filterStore.filterLayouts(layouts, statsMaps, statsReady, resolvedLikesData),
			layoutSource: filterStore.layoutSource,
			selectedLayoutNames: filterStore.selectedLayoutNames,
			includeSelectedInResults: filterStore.includeSelectedInResults,
			sourceLayoutNames: filterStore.activeSourceLayoutNames,
			similarReferenceName: filterStore.similarReferenceName,
			similarityMatches,
			similarityFilterOperator: filterStore.similarityFilterOperator,
			similarityFilterValue: filterStore.appliedSimilarityFilterValue,
			sortBy: filterStore.sortBy,
			sortOrder: filterStore.sortOrder,
			sortFilteredLayouts: (result) => filterStore.sortLayouts(result, statsMaps, resolvedLikesData)
		});
	});

	const filteredItems = $derived(filteredResult.items);
	const forceIncludedNames = $derived(filteredResult.forceIncludedNames);
	const hiddenSelectedCount = $derived(filteredResult.hiddenSelectedCount);
	const filteredCount = $derived(filteredItems.length);
	const selectedLayoutCount = $derived(filterStore.selectedLayoutNames.size);
	const resultsViewKey = $derived(
		`${filterStore.layoutSource}:${filterStore.activeSavedFilterId ?? ''}`
	);
</script>

<div class="page-root">
	<div class="layout-view-bar">
		<LayoutViewTabs />
		<DisplaySettingsMenu />
	</div>

	{#key resultsViewKey}
		<div id="layout-view-panel" class="results-layout" role="tabpanel" aria-label="Layout results">
			<aside class="results-sidebar">
				<FiltersSidebar {authorList} {layouts} />
			</aside>
			<div class="results-main min-w-0">
				<div class="results-toolbar">
					<LayoutResultsToolbar {filteredCount} {likesSortAvailable} />
				</div>
				<div class="results-list">
					{#if statsLoadErrors.length > 0}
						<div class="stats-load-error" role="alert">
							<div>
								<p class="stats-load-error-title">Some analyzer stats could not be loaded.</p>
								{#each statsLoadErrors as { analyzer, error } (analyzer)}
									<p>{analyzerShortLabel(analyzer)}: {error.message}</p>
								{/each}
							</div>
							<button
								type="button"
								class="stats-load-error-retry"
								onclick={() => retryStatsLoads(statsLoadErrors.map(({ analyzer }) => analyzer))}
							>
								Retry
							</button>
						</div>
					{/if}
					{#if filterStore.layoutSource === 'selected' && selectedLayoutCount === 0}
						<div class="results-empty" style="color: var(--text-secondary);">
							<p class="results-empty-title" style="color: var(--text-primary);">
								No layouts selected
							</p>
							<p>
								Switch to All layouts and use the checkbox on a layout card to add layouts here.
								Filters on this page only apply to your selection.
							</p>
						</div>
					{:else if resultsBlockedByStatsError}
						<div class="results-empty" role="status" style="color: var(--text-secondary);">
							<p class="results-empty-title" style="color: var(--text-primary);">
								Analyzer stats unavailable
							</p>
							<p>Retry the failed request to apply the active stat filters.</p>
						</div>
					{:else if resultsPending}
						<div class="results-empty" role="status" style="color: var(--text-secondary);">
							<p>Loading analyzer stats…</p>
						</div>
					{:else}
						<LayoutCardList
							items={filteredItems}
							similarReference={similarReferenceLayout}
							{forceIncludedNames}
							reserveBottomActionSpace={selectedLayoutCount > 0}
							{getAuthorName}
							likesData={resolvedLikesData}
							{statsMaps}
							{inputProfiles}
							{similarityMatches}
							similarDiffPositions={similarReferenceForCompare?.positionBySlot}
							similarMirrorDiffPositions={mirroredReferencePositions}
							onRemoveMissingLayout={(name) => filterStore.removeLayoutFromActiveSavedView(name)}
						/>
					{/if}
				</div>
				<SelectedLayoutActions {hiddenSelectedCount} />
			</div>
		</div>
	{/key}
</div>

<SharedViewModal open={showSharedViewModal} onClose={() => filterStore.clearPendingSharedView()} />

<style>
	.results-main {
		position: relative;
		min-width: 0;
	}

	.layout-view-bar {
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

	.layout-view-bar :global(.display-settings-menu) {
		align-self: center;
		flex-shrink: 0;
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

	.stats-load-error {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.25rem;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--danger, #dc2626) 55%, var(--border));
		border-radius: 0.5rem;
		color: var(--text-secondary);
		background: color-mix(in srgb, var(--danger, #dc2626) 8%, var(--bg-secondary));
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.stats-load-error-title {
		color: var(--text-primary);
		font-weight: 600;
	}

	.stats-load-error-retry {
		flex-shrink: 0;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		color: var(--text-primary);
		background: var(--bg-primary);
		cursor: pointer;
	}

	.stats-load-error-retry:hover,
	.stats-load-error-retry:focus-visible {
		border-color: var(--accent);
		color: var(--accent);
		outline: none;
	}

	.page-root {
		display: flex;
		flex-direction: column;
		min-height: 0;
		width: 100%;
	}

	.results-layout {
		--results-scroll-end-space: 4rem;
		--filters-footer-clearance: 4.5rem;

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
