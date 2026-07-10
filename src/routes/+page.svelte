<script lang="ts">
	import LayoutCardList from '$lib/components/LayoutCardList.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
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
	import { buildSimilarityPercentMap, isSimilarLayoutMatch, matchesSimilarityPercentFilter, sortLayoutsBySimilarity } from '$lib/layoutSimilarity';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);
	/** `null` = not loaded yet; `{}` = loaded but empty/unavailable. */
	let likesData: LayoutLikesMap | null = $state(null);
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
			filterStore.setSortOrder('desc');
		}
	});

	$effect(() => {
		if (!filterStore.hasSimilarReference && filterStore.sortBy === 'similarity') {
			filterStore.setSortBy('date');
			filterStore.setSortOrder('desc');
		}
	});

	// Drop stale ?similar= from URL when the layout no longer exists
	$effect(() => {
		const name = filterStore.similarReferenceName;
		if (!name || layouts.length === 0) return;
		if (!layouts.some((layout) => layout.name === name)) {
			filterStore.clearSimilarReference();
		}
	});

	// Create reverse lookup: user_id -> author_name
	const authorById = $derived(
		new Map<number, string>(Object.entries(authorsData).map(([name, id]) => [id as number, name]))
	);

	// Create sorted list of unique authors for the select
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
			? layouts.find((layout) => layout.name === filterStore.similarReferenceName) ?? null
			: null
	);

	const similarityPercents = $derived.by(() => {
		if (!similarReferenceLayout) return new Map<string, number>();
		return buildSimilarityPercentMap(similarReferenceLayout, layouts);
	});

	const filteredLayouts = $derived.by(() => {
		let result = filterStore.filterLayouts(layouts, statsMaps, statsReady, resolvedLikesData);

		if (filterStore.similarReferenceName) {
			result = result.filter((layout) => {
				if (
					!isSimilarLayoutMatch(
						filterStore.similarReferenceName,
						layout.name,
						similarityPercents
					)
				) {
					return false;
				}
				const percent = similarityPercents.get(layout.name);
				if (percent === undefined) return false;
				return matchesSimilarityPercentFilter(
					percent,
					filterStore.similarityFilterOperator,
					filterStore.similarityFilterValue
				);
			});
		}

		if (filterStore.sortBy === 'similarity') {
			return sortLayoutsBySimilarity(result, similarityPercents, filterStore.sortOrder);
		}

		return filterStore.sortLayouts(result, statsMaps, resolvedLikesData);
	});

	const filteredCount = $derived(filteredLayouts.length);
</script>

<div class="max-w-7xl mx-auto">
	<LayoutFilters
		{authorList}
		{filteredCount}
		{likesSortAvailable}
		{similarReferenceLayout}
		{getAuthorName}
		likesData={resolvedLikesData}
		{statsMaps}
	/>
	<LayoutCardList
		layouts={filteredLayouts}
		{getAuthorName}
		likesData={resolvedLikesData}
		{statsMaps}
		{similarityPercents}
	/>
</div>
