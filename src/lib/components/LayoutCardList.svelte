<script lang="ts">
	import LayoutCard from './LayoutCard.svelte';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { LAYOUT_CARD_ITEM_SIZE, TAILWIND_MD_MEDIA_QUERY } from '$lib/constants';
	import { useEventListener } from 'runed';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layouts: LayoutData[];
		getAuthorName: (userId: number) => string;
	}

	const { layouts, getAuthorName }: Props = $props();

	// Reactive media query to recalculate columns on resize
	// Only necessary because WindowVirtualizer doesn't support responsive layouts
	const mdMediaQuery = window.matchMedia(TAILWIND_MD_MEDIA_QUERY);
	let isMdOrLarger = $state(mdMediaQuery.matches);
	useEventListener(mdMediaQuery, 'change', (event) => {
		isMdOrLarger = event.matches;
	});
	const columns = $derived(isMdOrLarger ? 3 : 2);

	// Group layouts into rows for grid virtualization
	// Store row start indices as integers to avoid object allocation
	const rows = $derived.by(() => {
		const result: number[] = [];
		for (let i = 0; i < layouts.length; i += columns) {
			result.push(i);
		}
		return result;
	});
</script>

<WindowVirtualizer
	data={rows}
	bufferSize={300}
	itemSize={LAYOUT_CARD_ITEM_SIZE}
	getKey={(startIndex) => `${columns}:${startIndex}`}
>
	{#snippet children(startIndex)}
		{@const end = Math.min(startIndex + columns, layouts.length)}
		{@const rowItems = layouts.slice(startIndex, end)}

		<div class="grid gap-4 mb-4" style="grid-template-columns: repeat({columns}, 1fr);">
			{#each rowItems as layout (layout.name)}
				<LayoutCard {layout} authorName={getAuthorName(layout.user)} />
			{/each}
		</div>
	{/snippet}
</WindowVirtualizer>
