<script lang="ts">
	import LayoutCard from './LayoutCard.svelte';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { getLayoutCardItemSize, TAILWIND_BREAKPOINTS } from '$lib/constants';
	import type { LayoutData, LayoutStatsMap } from '$lib/layout';
	import { MediaQuery } from 'svelte/reactivity';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		layouts: LayoutData[];
		getAuthorName: (userId: number) => string;
		layoutStats: LayoutStatsMap;
	}

	const { layouts, getAuthorName, layoutStats }: Props = $props();

	let virtualizer = $state<{
		scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => void;
	}>();

	const smUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`);
	// md tier reserved for future column breakpoints between sm (2 cols) and lg (3 cols).
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentional placeholder
	const mdUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.md}px)`);
	const lgUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.lg}px)`);
	const xlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`);

	const columns = $derived(xlUp.current ? 4 : lgUp.current ? 3 : smUp.current ? 2 : 1);

	const cardItemSize = $derived(
		getLayoutCardItemSize(filterStore.showLayoutStats, filterStore.showLayoutTestArea)
	);

	// Group layouts into rows for grid virtualization
	// Store row start indices as integers to avoid object allocation
	const rows = $derived.by(() => {
		const result: number[] = [];
		for (let i = 0; i < layouts.length; i += columns) {
			result.push(i);
		}
		return result;
	});

	// Force virtualizer to recalculate when columns or card height change
	$effect(() => {
		void columns;
		void filterStore.showLayoutStats;
		void filterStore.showLayoutTestArea;
		requestAnimationFrame(() => {
			window.dispatchEvent(new Event('scroll'));
		});
	});

	$effect(() => {
		const name = filterStore.focusLayoutName;
		if (!name) return;

		const layoutIndex = layouts.findIndex((layout) => layout.name === name);
		if (layoutIndex === -1) return;

		const rowIndex = Math.floor(layoutIndex / columns);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				virtualizer?.scrollToIndex(rowIndex, { align: 'start' });
				filterStore.clearFocusLayout();
			});
		});
	});
</script>

<WindowVirtualizer
	bind:this={virtualizer}
	data={rows}
	bufferSize={300}
	itemSize={cardItemSize}
	getKey={(startIndex) =>
		`${columns}:${cardItemSize}:${filterStore.showLayoutStats}:${filterStore.showLayoutTestArea}:${startIndex}`}
>
	{#snippet children(startIndex)}
		{@const end = Math.min(startIndex + columns, layouts.length)}
		{@const rowItems = layouts.slice(startIndex, end)}

		<div class="grid gap-4 mb-4" style="grid-template-columns: repeat({columns}, 1fr);">
			{#each rowItems as layout (layout.name)}
				<LayoutCard {layout} authorName={getAuthorName(layout.user)} {layoutStats} />
			{/each}
		</div>
	{/snippet}
</WindowVirtualizer>
