<script lang="ts">
	import LayoutCard from './LayoutCard.svelte';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { getLayoutCardItemSize, TAILWIND_BREAKPOINTS } from '$lib/constants';
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		LayoutData,
		LayoutLikesMap,
		StatsMaps
	} from '$lib/layout';
	import { MediaQuery } from 'svelte/reactivity';
	import { filterStore } from '$lib/filterStore.svelte';
	import { CYANOPHAGE_ANALYZER } from '$lib/layoutStats';

	interface Props {
		layouts: LayoutData[];
		getAuthorName: (userId: number) => string;
		likesData: LayoutLikesMap;
		statsMaps: StatsMaps;
		similarityPercents?: Map<string, number>;
	}

	const {
		layouts,
		getAuthorName,
		likesData,
		statsMaps,
		similarityPercents = new Map()
	}: Props = $props();

	let virtualizer = $state<{
		scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => void;
	}>();

	const smUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`);
	const lgUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.lg}px)`);
	const xlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`);

	const columns = $derived(xlUp.current ? 4 : lgUp.current ? 3 : smUp.current ? 2 : 1);

	const cardItemSize = $derived(
		getLayoutCardItemSize(filterStore.showLayoutStats, filterStore.showLayoutTestArea)
	);

	const activeStatsMap = $derived(
		filterStore.statsAnalyzer === CYANOPHAGE_ANALYZER
			? statsMaps.cyanophage
			: statsMaps.monkeyracer
	);

	// Remount when similar mode toggles so virtua doesn't keep the old list height /
	// scroll-jump state (which fights window.scrollTo when the result set shrinks).
	const virtualizerKey = $derived(filterStore.similarReferenceName ?? '');

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
		void cardItemSize;
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

	function compactStatsFor(layout: LayoutData): CompactLayoutStats | CompactCyanophageStats | undefined {
		return activeStatsMap?.[layout.name];
	}

	// Include the first layout name so sort/filter reorders change keys. Index-only keys
	// leave virtua's rows mounted with stale cards (highlights update, order does not).
	function rowKey(startIndex: number): string {
		return `${columns}:${cardItemSize}:${startIndex}:${layouts[startIndex]?.name ?? ''}`;
	}
</script>

{#key virtualizerKey}
	<WindowVirtualizer
		bind:this={virtualizer}
		data={rows}
		bufferSize={120}
		itemSize={cardItemSize}
		getKey={rowKey}
	>
		{#snippet children(startIndex)}
			{@const end = Math.min(startIndex + columns, layouts.length)}
			{@const rowItems = layouts.slice(startIndex, end)}

			<div class="layout-card-row grid gap-4 mb-4" style="grid-template-columns: repeat({columns}, 1fr);">
				{#each rowItems as layout (layout.name)}
					<LayoutCard
						{layout}
						authorName={getAuthorName(layout.user)}
						likeCount={likesData[layout.name] ?? 0}
						compactStats={compactStatsFor(layout)}
						similarMatchPercent={similarityPercents.get(layout.name)}
					/>
				{/each}
			</div>
		{/snippet}
	</WindowVirtualizer>
{/key}

<style>
	/* Help Safari paint row contents while virtua translates the row. */
	.layout-card-row {
		transform: translateZ(0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}
</style>
