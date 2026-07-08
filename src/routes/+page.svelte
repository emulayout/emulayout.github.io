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
	import { buildSimilarityPercentMap, isSimilarLayoutMatch, sortLayoutsBySimilarity } from '$lib/layoutSimilarity';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);
	let likesData: LayoutLikesMap = $state({});
	const statsMaps = $derived(layoutStatsStore.maps);
	const needsStatsForSort = $derived(isStatSortBy(filterStore.sortBy));
	const needsStatsForFilter = $derived(filterStore.hasActiveStatLimits);
	let likesLoading = $state(false);
	const statsReady = $derived(isAnalyzerStatsReady(statsMaps, filterStore.statsAnalyzer));
	const likesSortAvailable = $derived(
		filterStore.showLayoutLikes && Object.keys(likesData).length > 0
	);

	const analyzersToLoad = $derived.by(() => {
		const analyzers = new Set<typeof DEFAULT_STATS_ANALYZER | typeof CYANOPHAGE_ANALYZER>();

		if (needsStatsForFilter) {
			analyzers.add(filterStore.statsAnalyzer);
		}

		if (needsStatsForSort) {
			const sortAnalyzer = getStatSortAnalyzer(filterStore.sortBy);
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

	$effect(() => {
		if (Object.keys(likesData).length === 0 && Object.keys(data.likesData).length > 0) {
			likesData = data.likesData;
		}
	});

	$effect(() => {
		filterStore.setLikesDataAvailable(Object.keys(likesData).length > 0);
	});

	$effect(() => {
		if (!filterStore.showLayoutLikes) return;
		if (likesLoading || Object.keys(likesData).length > 0) return;

		likesLoading = true;
		void fetch('/layout-likes.json')
			.then((response) => (response.ok ? response.json() : {}))
			.then((data) => {
				likesData = data;
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
		let result = filterStore.filterLayouts(layouts, statsMaps, statsReady, likesData);

		if (filterStore.similarReferenceName) {
			result = result.filter((layout) =>
				isSimilarLayoutMatch(
					filterStore.similarReferenceName,
					layout.name,
					similarityPercents
				)
			);
			result = sortLayoutsBySimilarity(result, similarityPercents);
		} else {
			result = filterStore.sortLayouts(result, statsMaps, likesData);
		}

		if (similarReferenceLayout) {
			return [similarReferenceLayout, ...result];
		}

		return result;
	});

	const filteredCount = $derived(
		filterStore.similarReferenceName ? filteredLayouts.length - 1 : filteredLayouts.length
	);
</script>

<div class="max-w-7xl mx-auto">
	<LayoutFilters {authorList} {filteredCount} {likesSortAvailable} />
	<LayoutCardList
		layouts={filteredLayouts}
		{getAuthorName}
		{likesData}
		{statsMaps}
		{similarityPercents}
	/>
</div>
