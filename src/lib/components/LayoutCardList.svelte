<script lang="ts">
	import LayoutCard from './LayoutCard.svelte';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { LAYOUT_CARD_ITEM_SIZE, TAILWIND_BREAKPOINTS } from '$lib/constants';
	import type { LayoutData } from '$lib/layout';
	import { MediaQuery } from 'svelte/reactivity';

	interface Props {
		layouts: LayoutData[];
		getAuthorName: (userId: number) => string;
	}

	const { layouts, getAuthorName }: Props = $props();

	const smUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`);
	const mdUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.md}px)`);
	const lgUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.lg}px)`);
	const xlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`);

	const columns = $derived(xlUp.current ? 4 : lgUp.current ? 3 : smUp.current ? 2 : 1);

	// Group layouts into rows for grid virtualization
	// Store row start indices as integers to avoid object allocation
	const rows = $derived.by(() => {
		const result: number[] = [];
		for (let i = 0; i < layouts.length; i += columns) {
			result.push(i);
		}
		return result;
	});

	// Force virtualizer to recalculate when columns change by triggering a scroll event
	$effect(() => {
		// When columns change, trigger a scroll event to force virtualizer to recalculate visibility
		columns;
		// Use requestAnimationFrame to ensure DOM is updated
		requestAnimationFrame(() => {
			window.dispatchEvent(new Event('scroll'));
		});
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
