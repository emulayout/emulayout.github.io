<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);

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

	const filteredLayouts = $derived(filterStore.filterLayouts(layouts));
</script>

<div class="max-w-5xl mx-auto">
	<LayoutFilters {authorList} filteredCount={filteredLayouts.length} />

	<div class="grid gap-4 grid-cols-2 md:grid-cols-3">
		{#each filteredLayouts as layout (layout.name)}
			<LayoutCard {layout} authorName={getAuthorName(layout.user)} />
		{/each}
	</div>
</div>
