<script lang="ts">
	import LayoutCardList from '$lib/components/LayoutCardList.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { isStatSortBy } from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);
	const layoutStats = $derived(layoutStatsStore.map);
	const needsStatsForSort = $derived(isStatSortBy(filterStore.sortBy));

	$effect(() => {
		void layoutStatsStore.loadWhenVisible(filterStore.showLayoutStats, needsStatsForSort);
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

	const filteredLayouts = $derived(
		filterStore.sortLayouts(filterStore.filterLayouts(layouts), layoutStats)
	);
</script>

<div class="max-w-7xl mx-auto">
	<LayoutFilters {authorList} filteredCount={filteredLayouts.length} />
	<LayoutCardList layouts={filteredLayouts} {getAuthorName} {layoutStats} />
</div>
