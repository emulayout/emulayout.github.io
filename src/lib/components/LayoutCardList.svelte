<script lang="ts">
	import LayoutCard from './LayoutCard.svelte';
	import { VList, WindowVirtualizer } from 'virtua/svelte';
	import { getLayoutCardItemSize, LAYOUT_SPLIT_MIN_WIDTH, TAILWIND_BREAKPOINTS } from '$lib/constants';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';
	import { MediaQuery } from 'svelte/reactivity';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		ALL_STATS_ANALYZERS_MODE,
		getStatCardHighlightState,
		showsCyanophageStats,
		showsMana2Stats,
		showsMonkeyracerStats
	} from '$lib/layoutStats';
	import type { SimilarityMatchInfo } from '$lib/layoutSimilarity';

	interface Props {
		layouts: LayoutData[];
		/** Similarity reference — sticky column at lg+, else first card in the list. */
		similarReference?: LayoutData | null;
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
		similarReference = null,
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
	const lgUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.lg}px)`);
	const xlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`);
	const xxlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS['2xl']}px)`);
	const xxxlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS['3xl']}px)`);

	const stickyReference = $derived(
		Boolean(similarReference) && lgUp.current && filterStore.stickySimilarityCard
	);

	// Split starts at md (sidebar + results). md–lg results rail is narrow → 1 card column.
	// Stacked (< md) gets 2 columns from sm when filters sit above full width.
	// When the similarity reference owns a sticky column (lg+), leave one fewer grid column.
	const columns = $derived.by(() => {
		let count = 1;
		if (xxxlUp.current) count = 5;
		else if (xxlUp.current) count = 4;
		else if (xlUp.current) count = 3;
		else if (lgUp.current) count = 2;
		else if (splitUp.current) count = 1;
		else if (smUp.current) count = 2;

		if (stickyReference) count = Math.max(1, count - 1);
		return count;
	});

	const listLayouts = $derived.by(() => {
		if (!similarReference) return layouts;
		if (stickyReference) return layouts;
		return [similarReference, ...layouts];
	});

	const dualStats = $derived(filterStore.statsAnalyzer === ALL_STATS_ANALYZERS_MODE);
	const mana2Stats = $derived(showsMana2Stats(filterStore.statsAnalyzer));
	const cardItemSize = $derived(
		getLayoutCardItemSize(
			filterStore.showLayoutStats,
			filterStore.showLayoutTestArea,
			dualStats,
			mana2Stats
		)
	);
	const statHighlights = $derived(
		getStatCardHighlightState(filterStore.appliedStatLimits, filterStore.sortBy)
	);

	// Remount when similar mode toggles so virtua doesn't keep the old list height /
	// scroll-jump state (which fights scroll restoration when the result set shrinks).
	const virtualizerKey = $derived(
		`${filterStore.similarReferenceName ?? ''}:${splitUp.current ? 'pane' : 'window'}:${stickyReference ? 'pin' : 'inline'}:${filterStore.stickySimilarityCard ? '1' : '0'}`
	);

	// Group layouts into rows for grid virtualization
	// Store row start indices as integers to avoid object allocation
	const rows = $derived.by(() => {
		const result: number[] = [];
		for (let i = 0; i < listLayouts.length; i += columns) {
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

		const layoutIndex = listLayouts.findIndex((layout) => layout.name === name);
		if (layoutIndex === -1) {
			filterStore.clearFocusLayout();
			return;
		}

		const rowIndex = Math.floor(layoutIndex / columns);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				virtualizer?.scrollToIndex(rowIndex, { align: 'start' });
				filterStore.clearFocusLayout();
			});
		});
	});

	// Include the first layout name so sort/filter reorders change keys. Index-only keys
	// leave virtua's rows mounted with stale cards (highlights update, order does not).
	function rowKey(startIndex: number): string {
		return `${columns}:${cardItemSize}:${startIndex}:${listLayouts[startIndex]?.name ?? ''}`;
	}
</script>

{#snippet layoutCard(layout: LayoutData)}
	{@const matchInfo = similarityMatches.get(layout.name)}
	<LayoutCard
		{layout}
		authorName={getAuthorName(layout.user)}
		likeCount={likesData[layout.name] ?? 0}
		compactMonkeyStats={showsMonkeyracerStats(filterStore.statsAnalyzer)
			? statsMaps.monkeyracer?.[layout.name]
			: undefined}
		compactCyanophageStats={showsCyanophageStats(filterStore.statsAnalyzer)
			? statsMaps.cyanophage?.[layout.name]
			: undefined}
		compactMana2Stats={showsMana2Stats(filterStore.statsAnalyzer)
			? statsMaps.mana2?.[layout.name]
			: undefined}
		forceIncluded={forceIncludedNames.has(layout.name)}
		similarMatchPercent={matchInfo?.percent}
		similarMirrored={matchInfo?.mirrored ?? false}
		similarDiffPositions={matchInfo?.mirrored
			? (similarMirrorDiffPositions ?? similarDiffPositions)
			: similarDiffPositions}
		{statHighlights}
	/>
{/snippet}

{#snippet row(startIndex: number)}
	{@const end = Math.min(startIndex + columns, listLayouts.length)}
	{@const rowItems = listLayouts.slice(startIndex, end)}

	<div class="layout-card-row grid gap-3 mb-3" style="grid-template-columns: repeat({columns}, 1fr);">
		{#each rowItems as layout (layout.name)}
			{@render layoutCard(layout)}
		{/each}
	</div>
{/snippet}

{#snippet virtualList()}
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
{/snippet}

{#if stickyReference && similarReference}
	<div class="layout-results-with-pin">
		<div class="layout-results-pin">
			{@render layoutCard(similarReference)}
		</div>
		<div class="layout-results-scroll">
			{@render virtualList()}
		</div>
	</div>
{:else}
	{@render virtualList()}
{/if}

<style>
	/* Help Safari paint row contents while virtua translates the row. */
	.layout-card-row {
		transform: translateZ(0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}

	.layout-results-with-pin {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.75rem;
		align-items: start;
		height: 100%;
		min-height: 0;
		min-width: 0;
	}

	@media (min-width: 1280px) {
		.layout-results-with-pin {
			/* Pin stays one card-wide; matches fill the rest (2+ columns). */
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		}
	}

	@media (min-width: 1536px) {
		.layout-results-with-pin {
			grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
		}
	}

	@media (min-width: 1920px) {
		.layout-results-with-pin {
			grid-template-columns: minmax(0, 1fr) minmax(0, 4fr);
		}
	}

	.layout-results-pin {
		position: sticky;
		top: 0;
		align-self: start;
		min-width: 0;
		z-index: 1;
	}

	.layout-results-scroll {
		min-width: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}
</style>
