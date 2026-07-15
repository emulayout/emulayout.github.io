<script lang="ts">
	import CompareLayoutsModal from '$lib/components/CompareLayoutsModal.svelte';
	import LayoutCardList from '$lib/components/LayoutCardList.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import LayoutResultsToolbar from '$lib/components/LayoutResultsToolbar.svelte';
	import SimilarReferencePanel from '$lib/components/SimilarReferencePanel.svelte';
	import type { LayoutLikesMap } from '$lib/layout';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		getStatSortAnalyzer,
		isAnalyzerStatsReady,
		isStatSortBy
	} from '$lib/layoutStats';
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
	const statsMaps = $derived({ ...data.statsMaps, ...layoutStatsStore.maps });
	const needsStatsForSort = $derived(isStatSortBy(filterStore.sortBy));
	const needsStatsForFilter = $derived(filterStore.hasAppliedStatLimits);
	let likesLoading = $state(false);
	const statsReady = $derived(isAnalyzerStatsReady(statsMaps, filterStore.statsAnalyzer));
	const resolvedLikesData = $derived(likesData ?? {});
	const likesLoaded = $derived(likesData !== null);
	const likesSortAvailable = $derived(
		filterStore.showLayoutLikes && likesLoaded && Object.keys(resolvedLikesData).length > 0
	);

	$effect(() => {
		layoutsCatalog.hydrate(layouts, authorsData);
	});

	const analyzersToLoad = $derived.by(() => {
		const analyzers = new Set<typeof DEFAULT_STATS_ANALYZER | typeof CYANOPHAGE_ANALYZER>();

		if (needsStatsForFilter) {
			analyzers.add(filterStore.statsAnalyzer);
		}

		if (needsStatsForSort) {
			const sortAnalyzer = getStatSortAnalyzer(filterStore.sortBy, filterStore.statsAnalyzer);
			if (sortAnalyzer) analyzers.add(sortAnalyzer);
		}

		return analyzers;
	});

	$effect(() => {
		void layoutStatsStore.loadWhenVisible(
			filterStore.showLayoutStats,
			filterStore.statsAnalyzer,
			analyzersToLoad
		);
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
			? withSimilarReferenceAnglemod(
					similarReferenceLayout,
					filterStore.similarReferenceAnglemod
				)
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

	const filteredLayouts = $derived.by(() => {
		let result = filterStore.filterLayouts(layouts, statsMaps, statsReady, resolvedLikesData);

		if (filterStore.similarReferenceName) {
			result = result.filter((layout) => {
				if (
					!isSimilarLayoutMatch(
						filterStore.similarReferenceName,
						layout.name,
						similarityMatches
					)
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

		if (filterStore.sortBy === 'similarity') {
			return sortLayoutsBySimilarity(result, similarityMatches, filterStore.sortOrder);
		}

		return filterStore.sortLayouts(result, statsMaps, resolvedLikesData);
	});

	const filteredCount = $derived(filteredLayouts.length);
	const compareSelectedCount = $derived(filterStore.compareSelectedNames.size);

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

<div class="max-w-screen-2xl mx-auto">
	<LayoutFilters {authorList} {filteredCount} {likesSortAvailable} />

	{#if similarReferenceLayout}
		<div class="similar-results-layout">
			<aside class="similar-sidebar">
				<SimilarReferencePanel
					layout={similarReferenceLayout}
					authorName={getAuthorName(similarReferenceLayout.user)}
					likesData={resolvedLikesData}
					{statsMaps}
				/>
			</aside>
			<div class="similar-results min-w-0">
				<LayoutResultsToolbar {filteredCount} {likesSortAvailable} />
				<LayoutCardList
					layouts={filteredLayouts}
					{getAuthorName}
					likesData={resolvedLikesData}
					{statsMaps}
					{similarityMatches}
					similarDiffPositions={similarReferenceForCompare?.positionBySlot}
					similarMirrorDiffPositions={mirroredReferencePositions}
				/>
			</div>
		</div>
	{:else}
		<LayoutCardList
			layouts={filteredLayouts}
			{getAuthorName}
			likesData={resolvedLikesData}
			{statsMaps}
		/>
	{/if}
</div>

{#if compareSelectedCount > 0}
	<div class="compare-fab" role="presentation">
		<div class="compare-fab-group">
			<button
				type="button"
				class="compare-fab-button"
				class:compare-fab-button--active={filterStore.showSelectedOnly}
				aria-pressed={filterStore.showSelectedOnly}
				aria-label={`${filterStore.showSelectedOnly ? 'Showing' : 'Show'} (${compareSelectedCount}) selected`}
				onclick={() => filterStore.toggleShowSelectedOnly()}
			>
				{filterStore.showSelectedOnly ? 'Showing' : 'Show'} ({compareSelectedCount}) selected
			</button>
			<button
				type="button"
				class="compare-fab-clear"
				aria-label="Clear selection"
				onclick={() => filterStore.clearCompareLayouts()}
			>
				<svg
					class="size-4"
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

<style>
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
		transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease,
			box-shadow 0.15s ease;
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

	.compare-fab-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 9999px;
		cursor: pointer;
		color: var(--text-primary);
		background-color: var(--bg-secondary);
		border: 1px solid var(--border);
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--text-primary) 18%, transparent);
		transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
	}

	.compare-fab-clear:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.similar-results-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		align-items: start;
	}

	@media (min-width: 640px) {
		.similar-results-layout {
			/* Sticky reference (1) + one results column (1) */
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 0.75rem 1rem;
		}

		.similar-sidebar {
			position: sticky;
			top: 0.75rem;
			align-self: start;
			max-height: calc(100vh - 1.5rem);
			overflow-y: auto;
		}

		.similar-results {
			border-left: 1px solid var(--border);
			padding-left: 1rem;
		}
	}

	@media (min-width: 1024px) {
		.similar-results-layout {
			/* Sticky reference (1) + two results columns (2) */
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		}
	}

	@media (min-width: 1280px) {
		.similar-results-layout {
			/* Sticky reference (1) + three results columns (3) */
			grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
		}
	}

	@media (min-width: 1536px) {
		.similar-results-layout {
			/* Sticky reference (1) + four results columns (4) */
			grid-template-columns: minmax(0, 1fr) minmax(0, 4fr);
		}
	}
</style>
