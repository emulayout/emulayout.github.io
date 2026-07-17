<script lang="ts">
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		CyanophageStats,
		MonkeyracerStats,
		LayoutData
	} from '$lib/layout';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { getLayoutCardHeight, LAYOUT_CARD_TEST_AREA_HEIGHT } from '$lib/constants';
	import {
		buildBotStatsBlockLines,
		buildCyanophageStatsBlockLines,
		CYANOPHAGE_ANALYZER,
		decodeCyanophageStats,
		decodeMonkeyracerStats,
		deriveBotStats,
		deriveCyanophageStats,
		formatCyanophageStatsLoadingBlock,
		formatCyanophageStatsUnavailableBlock,
		formatStatsLoadingBlock,
		formatStatsUnavailableBlock,
		getStatSortHighlightKey,
		type CyanophageStatSortKey,
		type StatSortKey
	} from '$lib/layoutStats';
	import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
	import { buildKeyMap, buildShiftKeyMap, type KeyMap } from '$lib/cmini/keyboard';
	import {
		applyAnglemodToDisplayRows,
		computeDisplayRows,
		displayRowsToString,
		isSimilarDiffSlot,
		removeAnglemodFromDisplayRows,
		type DisplayCell
	} from '$lib/layoutDisplay';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		/** Compact stats for the active analyzer only (avoids full statsMaps fan-out). */
		compactStats?: CompactLayoutStats | CompactCyanophageStats;
		/** Injected into results despite failing filters (Include selected). */
		forceIncluded?: boolean;
		similarMatchPercent?: number;
		/** Best similarity score came from a mirrored (left/right flipped) comparison. */
		similarMirrored?: boolean;
		/** When set, keys that differ from this reference layout are highlighted. */
		similarDiffPositions?: Map<string, string>;
	}

	const {
		layout,
		authorName,
		likeCount,
		compactStats,
		forceIncluded = false,
		similarMatchPercent,
		similarMirrored = false,
		similarDiffPositions
	}: Props = $props();

	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let localAnglemod = $state(false);
	let keyMapCache: KeyMap | null = null;
	let shiftKeyMapCache: KeyMap | null = null;
	let keyMapSource = '';

	const isSimilarActive = $derived(filterStore.similarReferenceName === layout.name);
	const isCompareSelected = $derived(filterStore.compareSelectedNames.has(layout.name));

	const isAngleBoard = $derived(layout.board === 'angle');

	// Similarity reference card shares anglemod with scoring; other cards keep local toggle state.
	const anglemod = $derived(isSimilarActive ? filterStore.similarReferenceAnglemod : localAnglemod);

	function toggleAnglemod() {
		if (isSimilarActive) {
			filterStore.setSimilarReferenceAnglemod(!filterStore.similarReferenceAnglemod);
			return;
		}
		localAnglemod = !localAnglemod;
	}

	const baseDisplayRows = $derived(computeDisplayRows(layout));
	const baseDisplayValue = $derived(displayRowsToString(baseDisplayRows));

	// Angle boards are stored in anglemod order; toggling unswaps. Others swap on toggle.
	const transformedDisplayRows = $derived.by((): DisplayCell[][] => {
		if (!anglemod) return baseDisplayRows;
		return isAngleBoard
			? removeAnglemodFromDisplayRows(baseDisplayRows)
			: applyAnglemodToDisplayRows(baseDisplayRows);
	});

	const transformedDisplayValue = $derived(displayRowsToString(transformedDisplayRows));

	const showSimilarDiffs = $derived(
		Boolean(similarDiffPositions && similarDiffPositions.size > 0 && !isSimilarActive)
	);

	const updatedLabel = $derived(
		new Date(layout.updatedAt).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);

	const isCyanophageAnalyzer = $derived(filterStore.statsAnalyzer === CYANOPHAGE_ANALYZER);
	const cyanophageLinkTitle = $derived(
		layout.cyanophageCompatible ? 'View on Cyanophage' : CYANOPHAGE_UNSUPPORTED_LABEL
	);

	const analyzerStats = $derived.by(() => {
		if (!compactStats) return undefined;
		if (isCyanophageAnalyzer) {
			if (!layout.cyanophageCompatible) return undefined;
			return decodeCyanophageStats(compactStats as CompactCyanophageStats);
		}
		return decodeMonkeyracerStats(compactStats as CompactLayoutStats);
	});

	const botStats = $derived(
		analyzerStats && !isCyanophageAnalyzer
			? deriveBotStats(analyzerStats as MonkeyracerStats)
			: null
	);
	const cyanophageStats = $derived(
		analyzerStats && isCyanophageAnalyzer
			? deriveCyanophageStats(analyzerStats as CyanophageStats)
			: null
	);
	const statsLoading = $derived(layoutStatsStore.isLoading(filterStore.statsAnalyzer));
	const highlightStatKey = $derived(
		getStatSortHighlightKey(filterStore.sortBy, filterStore.statsAnalyzer)
	);
	const botHighlightKey = $derived(
		!isCyanophageAnalyzer ? (highlightStatKey as StatSortKey | undefined) : undefined
	);
	const cyanophageHighlightKey = $derived(
		isCyanophageAnalyzer ? (highlightStatKey as CyanophageStatSortKey | undefined) : undefined
	);
	const statsBlockLines = $derived(
		isCyanophageAnalyzer
			? cyanophageStats
				? buildCyanophageStatsBlockLines(cyanophageStats, cyanophageHighlightKey)
				: null
			: botStats
				? buildBotStatsBlockLines(botStats, botHighlightKey)
				: null
	);
	const statsBlock = $derived(
		statsLoading
			? isCyanophageAnalyzer
				? formatCyanophageStatsLoadingBlock()
				: formatStatsLoadingBlock()
			: isCyanophageAnalyzer
				? !cyanophageStats
					? formatCyanophageStatsUnavailableBlock(
							!layout.cyanophageCompatible ? CYANOPHAGE_UNSUPPORTED_LABEL : undefined
						)
					: null
				: !botStats
					? formatStatsUnavailableBlock()
					: null
	);

	const cardHeight = $derived(
		getLayoutCardHeight(filterStore.showLayoutStats, filterStore.showLayoutTestArea)
	);

	function getKeyMaps(): { keyMap: KeyMap; shiftKeyMap: KeyMap } {
		const source = transformedDisplayValue;
		if (keyMapCache && shiftKeyMapCache && keyMapSource === source) {
			return { keyMap: keyMapCache, shiftKeyMap: shiftKeyMapCache };
		}
		keyMapSource = source;
		keyMapCache = buildKeyMap(source);
		shiftKeyMapCache = buildShiftKeyMap(keyMapCache);
		return { keyMap: keyMapCache, shiftKeyMap: shiftKeyMapCache };
	}

	async function handleColemakCampClick(event: MouseEvent) {
		event.preventDefault();
		const { keyMap } = getKeyMaps();
		const { createColemakCampURLFromKeyMap } = await import('$lib/colemakCamp');
		const url = createColemakCampURLFromKeyMap(keyMap, layout.board);
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	async function handlePlaygroundClick(event: MouseEvent) {
		event.preventDefault();
		if (!layout.cyanophageCompatible) return;
		const { buildCyanophagePlaygroundUrl } = await import('$lib/cyanophage');
		const url = buildCyanophagePlaygroundUrl(
			layout.keys,
			layout.board,
			baseDisplayValue,
			layout.cyanophageThumb ?? 'l'
		);
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function handleFindSimilarClick() {
		filterStore.toggleSimilarReference(layout.name, anglemod);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			if (textareaElement) {
				textareaElement.value = '';
			}
			return;
		}

		// Don't remap if meta, ctrl, or alt are pressed
		if (event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}

		const { keyMap, shiftKeyMap } = getKeyMaps();

		// Check if this is a remappable key
		if (event.code in keyMap) {
			event.preventDefault();
			let mappedChar: string | undefined;

			// Use shift map if shift is pressed
			if (event.shiftKey) {
				if (event.code in shiftKeyMap) {
					mappedChar = shiftKeyMap[event.code];
				}
			} else {
				mappedChar = keyMap[event.code];
			}

			if (textareaElement && mappedChar) {
				const start = textareaElement.selectionStart;
				const end = textareaElement.selectionEnd;
				const value = textareaElement.value;
				const newValue = value.slice(0, start) + mappedChar + value.slice(end);

				textareaElement.value = newValue;
				const nextCursor = start + mappedChar.length;
				textareaElement.setSelectionRange(nextCursor, nextCursor);
			}
		}
	}
</script>

<div
	data-layout-name={layout.name}
	class="layout-card px-3 pt-3 pb-2 rounded-xl min-w-0 flex flex-col gap-2"
	class:layout-card--force-included={forceIncluded}
	style="
		background-color: {forceIncluded ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
		border: 1px solid {forceIncluded
			? 'transparent'
			: isSimilarActive
				? 'var(--similar-diff)'
				: 'var(--border)'};
		--force-border-color: {isSimilarActive ? 'var(--similar-diff)' : 'var(--border)'};
		height: {cardHeight}px;
	"
>
	{#if forceIncluded}
		<svg class="layout-card-force-border" aria-hidden="true">
			<rect pathLength="100" />
		</svg>
	{/if}
	<div class="shrink-0 flex flex-col gap-1">
		<div class="flex items-center gap-2 min-w-0">
			<label class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
				<span class="relative shrink-0 flex items-center">
					<input
						type="checkbox"
						checked={isCompareSelected}
						onchange={() => filterStore.toggleCompareLayout(layout.name)}
						class="size-4 rounded appearance-none cursor-pointer relative"
						style="
							background-color: {isCompareSelected ? 'var(--accent)' : 'var(--bg-primary)'};
							border: 1px solid var(--border);
						"
						aria-label={`Select ${layout.name} for comparison`}
					/>
					{#if isCompareSelected}
						<svg
							class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
							style="color: white;"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<h2
					class="text-lg font-semibold truncate min-w-0"
					style="color: var(--text-primary);"
					title={layout.name}
				>
					{layout.name}
				</h2>
			</label>
			{#if filterStore.showLayoutLikes}
				<span
					class="inline-flex items-center gap-1 text-xs tabular-nums shrink-0"
					style="color: var(--text-secondary);"
					title="Likes"
					aria-label={`${likeCount} likes`}
				>
					<svg
						class="size-3.5 shrink-0"
						viewBox="0 0 24 24"
						fill={likeCount > 1 ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
						/>
					</svg>
					{likeCount}
				</span>
			{/if}
			{#if filterStore.hasSimilarReference && !isSimilarActive && similarMatchPercent !== undefined}
				<span
					class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium tabular-nums shrink-0"
					style="color: var(--similar-diff); background-color: var(--bg-primary); border: 1px solid var(--border);"
					title={similarMirrored ? 'Position match (mirrored)' : 'Position match'}
					aria-label={similarMirrored
						? `${similarMatchPercent}% mirrored match`
						: `${similarMatchPercent}% match`}
				>
					{similarMatchPercent}%
					{#if similarMirrored}
						<svg
							class="size-3.5 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<!-- Lucide flip-horizontal style (inline; no icon pack dep) -->
							<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
							<path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
							<path d="M12 20v2" />
							<path d="M12 14v2" />
							<path d="M12 8v2" />
							<path d="M12 2v2" />
						</svg>
					{/if}
				</span>
			{/if}
		</div>
		<p
			class="text-xs layout-meta flex items-center gap-1 min-w-0"
			style="color: var(--text-secondary);"
		>
			<span class="shrink-0">{layout.board} · by</span>
			<button
				type="button"
				onclick={() => {
					filterStore.clearAuthors();
					filterStore.toggleAuthor(layout.user);
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}}
				class="hover:underline cursor-pointer truncate min-w-0"
				style="color: var(--text-secondary);"
				title={authorName}
			>
				{authorName}
			</button>
			<span class="shrink-0" title={layout.updatedAt}>· {updatedLabel}</span>
		</p>
	</div>

	<div class="layout-display-area flex-1 min-w-0 overflow-x-auto flex flex-col justify-center px-2">
		{#if showSimilarDiffs}
			<div
				class="layout-display layout-display--diff font-mono whitespace-pre m-0"
				style="color: var(--text-primary);"
				aria-label="Layout keys; green marks differences from the selected layout"
			>
				{#each transformedDisplayRows as row, rowIndex (rowIndex)}
					<div class="layout-display-row">
						{#each row as cell, cellIndex (`${rowIndex}:${cellIndex}`)}
							{#if isSimilarDiffSlot(cell.slot, cell.char, similarDiffPositions)}
								<span class="layout-key-diff">{cell.char}</span>
							{:else}{cell.char}{/if}
						{/each}
					</div>
				{/each}
			</div>
		{:else}
			<pre
				class="layout-display font-mono whitespace-pre m-0"
				style="color: var(--text-primary);">{transformedDisplayValue}</pre>
		{/if}
	</div>

	<div class="card-action-divider shrink-0" aria-label="Layout actions">
		<div class="card-action-toolbar">
			<button
				type="button"
				onclick={handleFindSimilarClick}
				data-layout-card-first-action
				class="card-action-button"
				style="
					background-color: {isSimilarActive ? 'var(--similar-diff)' : 'var(--bg-primary)'};
					color: {isSimilarActive ? 'var(--similar-active-fg)' : 'var(--text-primary)'};
					border: 1px solid {isSimilarActive ? 'var(--similar-diff)' : 'var(--border)'};
				"
				title={isSimilarActive
					? 'Stop showing similar layouts'
					: filterStore.hasSimilarReference
						? 'Show layouts similar to this one'
						: 'Find similar layouts'}
				aria-label={isSimilarActive
					? 'Stop showing similar layouts'
					: filterStore.hasSimilarReference
						? 'Show layouts similar to this one'
						: 'Find similar layouts'}
				aria-pressed={isSimilarActive}
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
			</button>
			<button
				type="button"
				onclick={toggleAnglemod}
				class="card-action-button"
				style="
					background-color: {anglemod ? 'var(--accent)' : 'var(--bg-primary)'};
					color: {anglemod ? 'white' : 'var(--text-primary)'};
					border: 1px solid {anglemod ? 'var(--accent)' : 'var(--border)'};
				"
				title={isAngleBoard ? 'Remove anglemod' : 'Anglemod'}
				aria-label={isAngleBoard ? 'Remove anglemod' : 'Anglemod'}
				aria-pressed={anglemod}
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
					<path d="M21 3v5h-5" />
					<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
					<path d="M3 21v-5h5" />
				</svg>
			</button>
			<button
				type="button"
				onclick={handleColemakCampClick}
				class="card-action-button"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
				"
				title="Practice on Colemak Camp"
				aria-label="Practice on Colemak Camp"
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<rect x="2" y="4" width="20" height="16" rx="2" />
					<path stroke-linecap="round" d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8" />
				</svg>
			</button>
			<button
				type="button"
				onclick={handlePlaygroundClick}
				disabled={!layout.cyanophageCompatible}
				class="card-action-button disabled:opacity-40 disabled:cursor-not-allowed"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
				"
				title={cyanophageLinkTitle}
				aria-label={cyanophageLinkTitle}
				aria-disabled={!layout.cyanophageCompatible}
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
			</button>
		</div>
	</div>

	{#if filterStore.showLayoutStats || filterStore.showLayoutTestArea}
		<div class="card-footer shrink-0 pt-1 flex flex-col gap-3">
			{#if filterStore.showLayoutStats}
				{#if statsBlockLines}
					<div class="stats-block shrink-0">
						{#each statsBlockLines as line, lineIndex (lineIndex)}
							<div class="stats-block-line">
								{#each line as segment, segmentIndex (segmentIndex)}
									<span class:stats-block-highlight={segment.highlight}>{segment.text}</span>
								{/each}
							</div>
						{/each}
					</div>
				{:else}
					<pre
						class="stats-block shrink-0"
						class:stats-block--unavailable={!statsLoading}>{statsBlock}</pre>
				{/if}
			{/if}
			{#if filterStore.showLayoutTestArea}
				<!--
					Wrapper paints the background: iOS Safari often under-paints
					<textarea> backgrounds inside virtua-transformed rows until focus.
				-->
				<div
					class="layout-test-area"
					style="
						height: {LAYOUT_CARD_TEST_AREA_HEIGHT}px;
						background-color: var(--input-bg);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<textarea
						bind:this={textareaElement}
						class="layout-test-area-input"
						style="color: var(--text-primary);"
						rows="2"
						placeholder="Layout test area"
						onkeydown={handleKeyDown}></textarea>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/*
	 * iOS Safari + virtua: parent transform + overflow:hidden/border-radius often
	 * fails to paint the card background while children still paint. Force a
	 * compositor layer and avoid overflow:hidden on the transformed ancestor.
	 */
	.layout-card {
		position: relative;
		isolation: isolate;
		transform: translateZ(0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}

	.card-action-divider {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.25rem 0;
	}

	.card-action-divider::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid var(--border);
		pointer-events: none;
	}

	.card-action-toolbar {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.375rem;
		background-color: var(--bg-secondary);
	}

	.layout-card--force-included .card-action-toolbar {
		background-color: var(--bg-primary);
	}

	/*
	 * Native border-style:dashed ties stroke thickness to border-width.
	 * SVG draws the dashed outline independently of the 1px layout border.
	 */
	.layout-card-force-border {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
		z-index: 2;
	}

	.layout-card-force-border rect {
		fill: none;
		stroke: var(--force-border-color, var(--border));
		stroke-width: 2;
		stroke-dasharray: 0.5 0.5;
		stroke-linecap: butt;
		vector-effect: non-scaling-stroke;
		x: 0.5px;
		y: 0.5px;
		width: calc(100% - 1px);
		height: calc(100% - 1px);
		/* Match Tailwind rounded-xl (12px), inset by half the layout border */
		rx: 11.5px;
		ry: 11.5px;
	}

	.card-action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		transition: all 0.15s ease;
	}

	.layout-test-area {
		width: 100%;
		border-radius: 0.5rem;
		overflow: hidden;
		transform: translateZ(0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}

	.layout-test-area:focus-within {
		outline: 2px solid var(--tw-ring-color, var(--accent));
		outline-offset: 0;
	}

	.layout-test-area-input {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0.4rem;
		margin: 0;
		border: 0;
		border-radius: 0;
		resize: none;
		outline: none;
		background: transparent;
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.layout-display--diff {
		line-height: 1.25;
	}

	.layout-display-row {
		white-space: pre;
	}

	.layout-key-diff {
		color: var(--similar-diff);
	}
</style>
