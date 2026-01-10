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

	// Reactive media queries to recalculate columns on resize
	// Only necessary because WindowVirtualizer doesn't support responsive layouts
	const TAILWIND_SM_MEDIA_QUERY = '(min-width: 640px)';
	const TAILWIND_XL_MEDIA_QUERY = '(min-width: 1280px)';
	const smMediaQuery = window.matchMedia(TAILWIND_SM_MEDIA_QUERY);
	const mdMediaQuery = window.matchMedia(TAILWIND_MD_MEDIA_QUERY);
	const xlMediaQuery = window.matchMedia(TAILWIND_XL_MEDIA_QUERY);

	let isSmOrLarger = $state(smMediaQuery.matches);
	let isMdOrLarger = $state(mdMediaQuery.matches);
	let isXlOrLarger = $state(xlMediaQuery.matches);

	useEventListener(smMediaQuery, 'change', (event) => {
		isSmOrLarger = event.matches;
	});
	useEventListener(mdMediaQuery, 'change', (event) => {
		isMdOrLarger = event.matches;
	});
	useEventListener(xlMediaQuery, 'change', (event) => {
		isXlOrLarger = event.matches;
	});

	// Below sm: 1 column, sm to md: 2 columns, md to xl: 3 columns, xl and up: 4 columns
	const columns = $derived(isXlOrLarger ? 4 : isMdOrLarger ? 3 : isSmOrLarger ? 2 : 1);

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
