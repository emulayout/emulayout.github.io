<script lang="ts">
	import LayoutCardList from '$lib/components/LayoutCardList.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { isStatSortBy } from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { buildSimilarityPercentMap, isSimilarLayoutMatch, sortLayoutsBySimilarity } from '$lib/layoutSimilarity';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);
	const layoutStats = $derived(layoutStatsStore.map);
	const needsStatsForSort = $derived(isStatSortBy(filterStore.sortBy));
	const needsStatsForFilter = $derived(filterStore.hasActiveStatLimits);

	$effect(() => {
		void layoutStatsStore.loadWhenVisible(
			filterStore.showLayoutStats,
			needsStatsForSort || needsStatsForFilter
		);
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
		let result = filterStore.filterLayouts(layouts, layoutStats, layoutStatsStore.loaded);

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
			result = filterStore.sortLayouts(result, layoutStats);
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
	<LayoutFilters {authorList} {filteredCount} />
	<LayoutCardList
		layouts={filteredLayouts}
		{getAuthorName}
		{layoutStats}
		{similarityPercents}
	/>
</div>
