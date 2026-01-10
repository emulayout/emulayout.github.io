<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { WindowVirtualizer } from 'virtua/svelte';
	import type { LayoutData } from '$lib/layout';
	import { LAYOUT_CARD_ITEM_SIZE, TAILWIND_MD_MEDIA_QUERY } from '$lib/constants';
	import { useEventListener } from 'runed';

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

	// Reactive media query to recalculate columns on resize
	// Only necessary because WindowVirtualizer doesn't support responsive layouts
	const mdMediaQuery = window.matchMedia(TAILWIND_MD_MEDIA_QUERY);
	let isMdOrLarger = $state(mdMediaQuery.matches);
	useEventListener(mdMediaQuery, 'change', (event) => {
		isMdOrLarger = event.matches;
	});
	const columns = $derived(isMdOrLarger ? 3 : 2);

	// Group layouts into rows for grid virtualization
	type Row = LayoutData[];
	const rows = $derived.by(() => {
		const result: Row[] = [];
		for (let i = 0; i < filteredLayouts.length; i += columns) {
			result.push(filteredLayouts.slice(i, i + columns));
		}
		return result;
	});
</script>

<div class="max-w-5xl mx-auto">
	<LayoutFilters {authorList} filteredCount={filteredLayouts.length} />

	<WindowVirtualizer
		data={rows}
		bufferSize={300}
		itemSize={LAYOUT_CARD_ITEM_SIZE}
		getKey={(row, index) => {
			return row[0]?.name ?? `row-${index}`;
		}}
	>
		{#snippet children(row)}
			<div class="grid gap-4 mb-4" style="grid-template-columns: repeat({columns}, 1fr);">
				{#each row as layout (layout.name)}
					<LayoutCard {layout} authorName={getAuthorName(layout.user)} />
				{/each}
			</div>
		{/snippet}
	</WindowVirtualizer>
</div>
