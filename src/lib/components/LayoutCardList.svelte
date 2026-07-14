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

	// Similarity mode reserves one column for the sticky reference panel (sm+).
	const columns = $derived.by(() => {
		if (filterStore.hasSimilarReference) {
			if (xlUp.current) return 3;
			if (lgUp.current) return 2;
			return 1;
		}
		if (xlUp.current) return 4;
		if (lgUp.current) return 3;
		if (smUp.current) return 2;
		return 1;
	});

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

	// WindowVirtualizer only recomputes its visible range on scroll. Entering similarity
	// mode remounts it (via virtualizerKey) while scrollY may still be deep in the old
	// list — if we fire scroll before onMount attaches the listener, the list stays blank
	// until the user scrolls. Depend on `virtualizer` so this runs after mount.
	$effect(() => {
		void virtualizer;
		void virtualizerKey;
		void columns;
		void cardItemSize;
		void rows.length;
		if (!virtualizer) return;

		let cancelled = false;
		const wake = () => {
			if (cancelled) return;
			// scroll updates visible range; resize covers a 0-height viewport on first paint
			window.dispatchEvent(new Event('scroll'));
			window.dispatchEvent(new Event('resize'));
		};

		requestAnimationFrame(() => {
			wake();
			requestAnimationFrame(wake);
		});
		// Fallback if layout/scroll-to-selected shifts after the rAF pair.
		const timeoutId = window.setTimeout(wake, 50);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
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

			<div class="layout-card-row grid gap-3 mb-3" style="grid-template-columns: repeat({columns}, 1fr);">
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
