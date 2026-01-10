<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { onMount } from 'svelte';
	import type { LayoutData } from '$lib/layout';
	import { LAYOUT_CARD_ITEM_SIZE } from '$lib/constants';

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

	// Responsive column count for grid layout
	let columns = $state(window.innerWidth >= 768 ? 3 : 2);

	// Group layouts into rows for grid virtualization
	type Row = LayoutData[];
	const rows = $derived.by(() => {
		const result: Row[] = [];
		for (let i = 0; i < filteredLayouts.length; i += columns) {
			result.push(filteredLayouts.slice(i, i + columns));
		}
		return result;
	});

	onMount(() => {
		const updateColumns = () => {
			const newColumns = window.innerWidth >= 768 ? 3 : 2;
			if (newColumns !== columns) {
				columns = newColumns;
			}
		};

		updateColumns();
		window.addEventListener('resize', updateColumns);

		// Trigger scroll event after restoration so virtualizer renders items
		if (window.scrollY > 0) {
			setTimeout(() => {
				window.dispatchEvent(new Event('scroll', { bubbles: true }));
			}, 100);
		}

		return () => window.removeEventListener('resize', updateColumns);
	});
</script>

<div class="max-w-5xl mx-auto">
	<LayoutFilters {authorList} filteredCount={filteredLayouts.length} />

	<WindowVirtualizer
		data={rows}
		bufferSize={400}
		itemSize={LAYOUT_CARD_ITEM_SIZE}
		getKey={(row, index) => {
			return row[0]?.name ?? `row-${index}`;
		}}
	>
		{#snippet children(row, index)}
			<div class="grid gap-4 mb-4" style="grid-template-columns: repeat({columns}, 1fr);">
				{#each row as layout (layout.name)}
					<LayoutCard {layout} authorName={getAuthorName(layout.user)} />
				{/each}
			</div>
		{/snippet}
	</WindowVirtualizer>
</div>
