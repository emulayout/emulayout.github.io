<script lang="ts">
	import LayoutCard from './LayoutCard.svelte';
	import { VList, WindowVirtualizer } from 'virtua/svelte';
	import { getLayoutCardItemSize, LAYOUT_SPLIT_MIN_WIDTH, TAILWIND_BREAKPOINTS } from '$lib/constants';
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
	import type { SimilarityMatchInfo } from '$lib/layoutSimilarity';

	interface Props {
		layouts: LayoutData[];
		/** Layouts injected into results despite failing filters. */
		forceIncludedNames?: ReadonlySet<string>;
		getAuthorName: (userId: number) => string;
		likesData: LayoutLikesMap;
		statsMaps: StatsMaps;
		similarityMatches?: Map<string, SimilarityMatchInfo>;
		/** Direct reference slots for per-key diff highlighting. */
		similarDiffPositions?: Map<string, string>;
		/** Mirrored reference slots when a result's best match is mirrored. */
		similarMirrorDiffPositions?: Map<string, string> | null;
	}

	const {
		layouts,
		forceIncludedNames = new Set(),
		getAuthorName,
		likesData,
		statsMaps,
		similarityMatches = new Map(),
		similarDiffPositions,
		similarMirrorDiffPositions = null
	}: Props = $props();

	let virtualizer = $state<{
		scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => void;
		scrollTo?: (offset: number) => void;
	}>();

	const splitUp = new MediaQuery(`(min-width: ${LAYOUT_SPLIT_MIN_WIDTH}px)`);
	const smUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`);
	const xlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`);
	const xxlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS['2xl']}px)`);
	const xxxlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS['3xl']}px)`);

	// Stacked sidebar below lg gets full width → 2 columns from sm. Split layout starts at lg.
	const columns = $derived.by(() => {
		if (xxxlUp.current) return 5;
		if (xxlUp.current) return 4;
		if (xlUp.current) return 3;
		if (splitUp.current || smUp.current) return 2;
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
	// scroll-jump state (which fights scroll restoration when the result set shrinks).
	const virtualizerKey = $derived(
		`${filterStore.similarReferenceName ?? ''}:${splitUp.current ? 'pane' : 'window'}`
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

	// Virtualizers only recompute their visible range on scroll/resize. Entering similarity
	// mode remounts them (via virtualizerKey) — wake after mount so the list isn't blank.
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
			window.dispatchEvent(new Event('scroll'));
			window.dispatchEvent(new Event('resize'));
		};

		requestAnimationFrame(() => {
			wake();
			requestAnimationFrame(wake);
		});
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

{#snippet row(startIndex: number)}
	{@const end = Math.min(startIndex + columns, layouts.length)}
	{@const rowItems = layouts.slice(startIndex, end)}

	<div class="layout-card-row grid gap-3 mb-3" style="grid-template-columns: repeat({columns}, 1fr);">
		{#each rowItems as layout (layout.name)}
			{@const matchInfo = similarityMatches.get(layout.name)}
			<LayoutCard
				{layout}
				authorName={getAuthorName(layout.user)}
				likeCount={likesData[layout.name] ?? 0}
				compactStats={compactStatsFor(layout)}
				forceIncluded={forceIncludedNames.has(layout.name)}
				similarMatchPercent={matchInfo?.percent}
				similarMirrored={matchInfo?.mirrored ?? false}
				similarDiffPositions={matchInfo?.mirrored
					? (similarMirrorDiffPositions ?? similarDiffPositions)
					: similarDiffPositions}
			/>
		{/each}
	</div>
{/snippet}

{#key virtualizerKey}
	{#if splitUp.current}
		<VList
			bind:this={virtualizer}
			data={rows}
			bufferSize={120}
			itemSize={cardItemSize}
			getKey={rowKey}
			style="height: 100%;"
		>
			{#snippet children(startIndex)}
				{@render row(startIndex)}
			{/snippet}
		</VList>
	{:else}
		<WindowVirtualizer
			bind:this={virtualizer}
			data={rows}
			bufferSize={120}
			itemSize={cardItemSize}
			getKey={rowKey}
		>
			{#snippet children(startIndex)}
				{@render row(startIndex)}
			{/snippet}
		</WindowVirtualizer>
	{/if}
{/key}

<style>
	/* Help Safari paint row contents while virtua translates the row. */
	.layout-card-row {
		transform: translateZ(0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}
</style>
