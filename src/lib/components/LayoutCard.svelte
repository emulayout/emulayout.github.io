<script lang="ts">
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		CompactMana2Stats,
		LayoutData
	} from '$lib/layout';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { isNewSinceLastSync } from '$lib/recentLayouts';
	import { getLayoutCardHeight, LAYOUT_CARD_TEST_AREA_HEIGHT } from '$lib/constants';
	import {
		ALL_STATS_ANALYZERS_MODE,
		buildBotStatsBlockLines,
		buildCyanophageStatsBlockLines,
		buildMana2StatsBlockLines,
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		decodeCyanophageStats,
		decodeMana2Stats,
		decodeMonkeyracerStats,
		deriveBotStats,
		deriveCyanophageStats,
		deriveMana2Stats,
		formatCyanophageStatsLoadingBlock,
		formatCyanophageStatsUnavailableBlock,
		formatMana2StatsLoadingBlock,
		formatMana2StatsUnavailableBlock,
		formatStatsLoadingBlock,
		formatStatsUnavailableBlock,
		formatStatPercent,
		getStatCardHighlightState,
		MANA2_ANALYZER,
		showsCyanophageStats,
		showsMana2Stats,
		showsMonkeyracerStats,
		STAT_ANALYZERS
	} from '$lib/layoutStats';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import LayoutExpandUniqueStats from '$lib/components/LayoutExpandUniqueStats.svelte';
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
		/** Compact monkeyracer stats when that analyzer is shown. */
		compactMonkeyStats?: CompactLayoutStats;
		/** Compact cyanophage stats when that analyzer is shown. */
		compactCyanophageStats?: CompactCyanophageStats;
		/** Compact mana2 stats when that analyzer is shown. */
		compactMana2Stats?: CompactMana2Stats;
		/** Injected into results despite failing filters (Include selected). */
		forceIncluded?: boolean;
		similarMatchPercent?: number;
		/** Best similarity score came from a mirrored (left/right flipped) comparison. */
		similarMirrored?: boolean;
		/** When set, keys that differ from this reference layout are highlighted. */
		similarDiffPositions?: Map<string, string>;
		/** Shared filter/sort highlights; omit to compute from the filter store. */
		statHighlights?: ReturnType<typeof getStatCardHighlightState>;
	}

	const {
		layout,
		authorName,
		likeCount,
		compactMonkeyStats,
		compactCyanophageStats,
		compactMana2Stats,
		forceIncluded = false,
		similarMatchPercent,
		similarMirrored = false,
		similarDiffPositions,
		statHighlights
	}: Props = $props();

	const monkeyLabel =
		STAT_ANALYZERS.find((a) => a.value === DEFAULT_STATS_ANALYZER)?.label ?? 'cmini';
	/** Short label for shared stats table headers (omit monkeyracer parenthetical). */
	const cminiTableLabel = 'cmini';
	const cyanophageLabel =
		STAT_ANALYZERS.find((a) => a.value === CYANOPHAGE_ANALYZER)?.label ?? 'Cyanophage';
	const mana2Label = STAT_ANALYZERS.find((a) => a.value === MANA2_ANALYZER)?.label ?? 'Mana2';
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let localAnglemod = $state(false);
	let expanded = $state(false);
	let keyMapCache: KeyMap | null = null;
	let shiftKeyMapCache: KeyMap | null = null;
	let keyMapSource = '';

	const expandTitleId = $derived(
		`layout-expand-title-${layout.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`
	);

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

	const isNewLayout = $derived(
		filterStore.showNewLayoutIndicator &&
			isNewSinceLastSync(layout, layoutsCatalog.latestLayoutDayKey)
	);

	const showMonkeyStats = $derived(showsMonkeyracerStats(filterStore.statsAnalyzer));
	const showCyanophageStats = $derived(showsCyanophageStats(filterStore.statsAnalyzer));
	const showMana2Stats = $derived(showsMana2Stats(filterStore.statsAnalyzer));
	const dualStats = $derived(filterStore.statsAnalyzer === ALL_STATS_ANALYZERS_MODE);
	const cyanophageLinkTitle = $derived(
		layout.cyanophageCompatible ? 'View on Cyanophage' : CYANOPHAGE_UNSUPPORTED_LABEL
	);

	const botStats = $derived.by(() => {
		if (!showMonkeyStats || !compactMonkeyStats) return null;
		const decoded = decodeMonkeyracerStats(compactMonkeyStats);
		return decoded ? deriveBotStats(decoded) : null;
	});
	const cyanophageStats = $derived.by(() => {
		if (!showCyanophageStats || !compactCyanophageStats || !layout.cyanophageCompatible) {
			return null;
		}
		const decoded = decodeCyanophageStats(compactCyanophageStats);
		return decoded ? deriveCyanophageStats(decoded) : null;
	});
	const mana2Stats = $derived.by(() => {
		if (!showMana2Stats || !compactMana2Stats) return null;
		const decoded = decodeMana2Stats(compactMana2Stats);
		return decoded ? deriveMana2Stats(decoded) : null;
	});

	const monkeyLoading = $derived(
		showMonkeyStats && layoutStatsStore.isLoading(DEFAULT_STATS_ANALYZER)
	);
	const cyanophageLoading = $derived(
		showCyanophageStats && layoutStatsStore.isLoading(CYANOPHAGE_ANALYZER)
	);
	const mana2Loading = $derived(showMana2Stats && layoutStatsStore.isLoading(MANA2_ANALYZER));

	const sortFieldHighlight = $derived(
		statHighlights ?? getStatCardHighlightState(filterStore.appliedStatLimits, filterStore.sortBy)
	);
	const botFilterHighlightKeys = $derived(sortFieldHighlight.botFilterHighlightKeys);
	const cyanophageFilterHighlightKeys = $derived(sortFieldHighlight.cyanophageFilterHighlightKeys);
	const mana2FilterHighlightKeys = $derived(sortFieldHighlight.mana2FilterHighlightKeys);
	const botSortHighlightKey = $derived(sortFieldHighlight.botSortHighlightKey);
	const cyanophageSortHighlightKey = $derived(sortFieldHighlight.cyanophageSortHighlightKey);
	const mana2SortHighlightKey = $derived(sortFieldHighlight.mana2SortHighlightKey);

	const sortOrder = $derived(filterStore.sortOrder);

	const monkeyStatsBlockLines = $derived(
		botStats
			? buildBotStatsBlockLines(botStats, botFilterHighlightKeys, botSortHighlightKey, sortOrder)
			: null
	);
	const cyanophageStatsBlockLines = $derived(
		cyanophageStats
			? buildCyanophageStatsBlockLines(
					cyanophageStats,
					cyanophageFilterHighlightKeys,
					cyanophageSortHighlightKey,
					sortOrder
				)
			: null
	);
	const mana2StatsBlockLines = $derived(
		mana2Stats
			? buildMana2StatsBlockLines(
					mana2Stats,
					mana2FilterHighlightKeys,
					mana2SortHighlightKey,
					sortOrder
				)
			: null
	);

	const monkeyStatsPlaceholder = $derived(
		monkeyLoading ? formatStatsLoadingBlock() : !botStats ? formatStatsUnavailableBlock() : null
	);
	const cyanophageStatsPlaceholder = $derived(
		cyanophageLoading
			? formatCyanophageStatsLoadingBlock()
			: !cyanophageStats
				? formatCyanophageStatsUnavailableBlock(
						!layout.cyanophageCompatible ? CYANOPHAGE_UNSUPPORTED_LABEL : undefined
					)
				: null
	);
	const mana2StatsPlaceholder = $derived(
		mana2Loading
			? formatMana2StatsLoadingBlock()
			: !mana2Stats
				? formatMana2StatsUnavailableBlock()
				: null
	);

	// Expand modal always shows all three analyzers; prefer store maps so lazy loads update live.
	const expandMonkeyCompact = $derived(
		layoutStatsStore.maps.monkeyracer?.[layout.name] ?? compactMonkeyStats
	);
	const expandCyanophageCompact = $derived(
		layoutStatsStore.maps.cyanophage?.[layout.name] ?? compactCyanophageStats
	);
	const expandMana2Compact = $derived(
		layoutStatsStore.maps.mana2?.[layout.name] ?? compactMana2Stats
	);

	const expandMonkeyLoading = $derived(layoutStatsStore.isLoading(DEFAULT_STATS_ANALYZER));
	const expandCyanophageLoading = $derived(layoutStatsStore.isLoading(CYANOPHAGE_ANALYZER));
	const expandMana2Loading = $derived(layoutStatsStore.isLoading(MANA2_ANALYZER));

	const expandBotStats = $derived.by(() => {
		if (!expandMonkeyCompact) return null;
		const decoded = decodeMonkeyracerStats(expandMonkeyCompact);
		return decoded ? deriveBotStats(decoded) : null;
	});
	const expandCyanophageStats = $derived.by(() => {
		if (!expandCyanophageCompact || !layout.cyanophageCompatible) return null;
		const decoded = decodeCyanophageStats(expandCyanophageCompact);
		return decoded ? deriveCyanophageStats(decoded) : null;
	});
	const expandMana2Stats = $derived.by(() => {
		if (!expandMana2Compact) return null;
		const decoded = decodeMana2Stats(expandMana2Compact);
		return decoded ? deriveMana2Stats(decoded) : null;
	});

	/** Stats shared by ≥2 analyzers — expand modal comparison tables. */
	const expandSharedCells = $derived.by(() => {
		type Cell = string;
		const dash = '—';
		const loading = '…';

		const monkeyCell = (
			get: (stats: NonNullable<typeof expandBotStats>) => number,
			format: (value: number) => string = formatStatPercent
		): Cell => {
			if (expandMonkeyLoading) return loading;
			if (!expandBotStats) return dash;
			return format(get(expandBotStats));
		};
		const cyanoCell = (
			get: (stats: NonNullable<typeof expandCyanophageStats>) => number,
			format: (value: number) => string = formatStatPercent
		): Cell => {
			if (expandCyanophageLoading) return loading;
			if (!expandCyanophageStats) return dash;
			return format(get(expandCyanophageStats));
		};
		const mana2Cell = (
			get: (stats: NonNullable<typeof expandMana2Stats>) => number,
			format: (value: number) => string = formatStatPercent
		): Cell => {
			if (expandMana2Loading) return loading;
			if (!expandMana2Stats) return dash;
			return format(get(expandMana2Stats));
		};
		const mana2Raw = (value: number) => value.toFixed(3);

		return { dash, monkeyCell, cyanoCell, mana2Cell, mana2Raw };
	});

	const expandSharedStatRows = $derived.by(() => {
		const { dash, monkeyCell, cyanoCell, mana2Cell, mana2Raw } = expandSharedCells;

		return [
			{
				label: 'Same-finger bigrams',
				monkey: monkeyCell((s) => s.sfb),
				cyanophage: cyanoCell((s) => s.sfb),
				mana2: mana2Cell((s) => s.sfb)
			},
			{
				label: 'Same-finger skip',
				monkey: monkeyCell((s) => s.sfs),
				cyanophage: cyanoCell((s) => s.sfs),
				mana2: mana2Cell((s) => s.sfs)
			},
			{
				label: 'Alternation',
				monkey: monkeyCell((s) => s.alternate),
				cyanophage: cyanoCell((s) => s.alternate),
				mana2: mana2Cell((s) => s.alt)
			},
			{
				label: 'Roll',
				monkey: monkeyCell((s) => s.roll),
				cyanophage: cyanoCell((s) => s.roll),
				mana2: mana2Cell((s) => s.roll)
			},
			{
				label: 'Redirect',
				monkey: monkeyCell((s) => s.red),
				cyanophage: cyanoCell((s) => s.redirect),
				mana2: mana2Cell((s) => s.redirect)
			},
			{
				label: 'Lat stretch bigrams',
				monkey: dash,
				cyanophage: cyanoCell((s) => s.lsb),
				mana2: mana2Cell((s) => s.lsb, mana2Raw)
			},
			{
				label: 'Scissors',
				monkey: dash,
				cyanophage: cyanoCell((s) => s.scissors),
				mana2: mana2Cell((s) => s.vsb, mana2Raw)
			}
		] as const;
	});

	const expandSharedLeftHandRows = $derived.by(() => {
		const { dash, monkeyCell, cyanoCell, mana2Cell } = expandSharedCells;
		const fingers = [
			{ key: 'LI' as const, label: 'Index' },
			{ key: 'LM' as const, label: 'Middle' },
			{ key: 'LR' as const, label: 'Ring' },
			{ key: 'LP' as const, label: 'Pinky' },
			{ key: 'LT' as const, label: 'Thumb' }
		];

		return [
			{
				label: 'Hand',
				monkey: monkeyCell((s) => s.lh),
				cyanophage: cyanoCell((s) => s.lh),
				mana2: mana2Cell((s) => s.lh)
			},
			...fingers.map(({ key, label }) => ({
				label,
				monkey: monkeyCell((s) => s[key]),
				cyanophage: cyanoCell((s) => s[key]),
				mana2: mana2Cell((s) => s[key])
			}))
		];
	});

	const expandSharedRightHandRows = $derived.by(() => {
		const { monkeyCell, cyanoCell, mana2Cell } = expandSharedCells;
		const fingers = [
			{ key: 'RI' as const, label: 'Index' },
			{ key: 'RM' as const, label: 'Middle' },
			{ key: 'RR' as const, label: 'Ring' },
			{ key: 'RP' as const, label: 'Pinky' },
			{ key: 'RT' as const, label: 'Thumb' }
		];

		return [
			{
				label: 'Hand',
				monkey: monkeyCell((s) => s.rh),
				cyanophage: cyanoCell((s) => s.rh),
				mana2: mana2Cell((s) => s.rh)
			},
			...fingers.map(({ key, label }) => ({
				label,
				monkey: monkeyCell((s) => s[key]),
				cyanophage: cyanoCell((s) => s[key]),
				mana2: mana2Cell((s) => s[key])
			}))
		];
	});

	$effect(() => {
		if (!expanded) return;
		void Promise.all([
			layoutStatsStore.ensureLoaded(DEFAULT_STATS_ANALYZER),
			layoutStatsStore.ensureLoaded(CYANOPHAGE_ANALYZER),
			layoutStatsStore.ensureLoaded(MANA2_ANALYZER)
		]);
	});

	function openExpanded() {
		expanded = true;
	}

	function closeExpanded() {
		expanded = false;
	}

	const cardHeight = $derived(
		getLayoutCardHeight(
			filterStore.showLayoutStats,
			filterStore.showLayoutTestArea,
			dualStats,
			showMana2Stats
		)
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
			transformedDisplayValue,
			layout.cyanophageThumb ?? 'l',
			{ preferDisplay: anglemod }
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

{#snippet layoutCardMain(markFirstAction: boolean, showExpand = true)}
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
				{#if isNewLayout}
					<span class="new-layout-dot shrink-0" title="New layout" aria-label="New layout"></span>
				{/if}
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
				data-layout-card-first-action={markFirstAction ? true : undefined}
				class="card-action-button"
				class:card-action-button--similar={isSimilarActive}
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
				class:card-action-button--accent={anglemod}
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
				class="card-action-button"
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
			{#if showExpand}
				<button
					type="button"
					onclick={openExpanded}
					class="card-action-button"
					title="Expand layout"
					aria-label="Expand layout"
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
						<path d="M15 3h6v6" />
						<path d="M9 21H3v-6" />
						<path d="M21 3l-7 7" />
						<path d="M3 21l7-7" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
{/snippet}

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
	{@render layoutCardMain(true)}

	{#if filterStore.showLayoutStats || filterStore.showLayoutTestArea}
		<div class="card-footer shrink-0 pt-1 flex flex-col gap-3">
			{#if filterStore.showLayoutStats}
				<div class="stats-stack" class:stats-stack--dual={dualStats}>
					{#if showMonkeyStats}
						<div class="stats-stack-item">
							{#if dualStats}
								<div class="stats-analyzer-label">
									{monkeyLabel}
								</div>
							{/if}
							{#if monkeyStatsBlockLines}
								<div class="stats-block shrink-0">
									{#each monkeyStatsBlockLines as line, lineIndex (lineIndex)}
										<div class="stats-block-line">
											{#each line as segment, segmentIndex (segmentIndex)}
												<span
													class:stats-block-highlight={Boolean(segment.highlight)}
													class:stats-block-highlight--cmini={segment.highlight === 'cmini'}
													class:stats-block-highlight--cyanophage={segment.highlight ===
														'cyanophage'}
													class:stats-block-highlight--mana2={segment.highlight === 'mana2'}
													class:stats-block-highlight--sort={segment.highlight === 'sort'}
													>{segment.text}</span
												>
											{/each}
										</div>
									{/each}
								</div>
							{:else}
								<pre
									class="stats-block shrink-0"
									class:stats-block--unavailable={!monkeyLoading}>{monkeyStatsPlaceholder}</pre>
							{/if}
						</div>
					{/if}
					{#if showCyanophageStats}
						<div class="stats-stack-item">
							{#if dualStats}
								<div class="stats-analyzer-label">
									{cyanophageLabel}
								</div>
							{/if}
							{#if cyanophageStatsBlockLines}
								<div class="stats-block shrink-0">
									{#each cyanophageStatsBlockLines as line, lineIndex (lineIndex)}
										<div class="stats-block-line">
											{#each line as segment, segmentIndex (segmentIndex)}
												<span
													class:stats-block-highlight={Boolean(segment.highlight)}
													class:stats-block-highlight--cmini={segment.highlight === 'cmini'}
													class:stats-block-highlight--cyanophage={segment.highlight ===
														'cyanophage'}
													class:stats-block-highlight--mana2={segment.highlight === 'mana2'}
													class:stats-block-highlight--sort={segment.highlight === 'sort'}
													>{segment.text}</span
												>
											{/each}
										</div>
									{/each}
								</div>
							{:else}
								<pre
									class="stats-block shrink-0"
									class:stats-block--unavailable={!cyanophageLoading}>{cyanophageStatsPlaceholder}</pre>
							{/if}
						</div>
					{/if}
					{#if showMana2Stats}
						<div class="stats-stack-item">
							{#if mana2StatsBlockLines}
								<div class="stats-block stats-block--mana2 shrink-0">
									{#each mana2StatsBlockLines as line, lineIndex (lineIndex)}
										<div class="stats-block-line">
											{#each line as segment, segmentIndex (segmentIndex)}
												<span
													class:stats-block-highlight={Boolean(segment.highlight)}
													class:stats-block-highlight--cmini={segment.highlight === 'cmini'}
													class:stats-block-highlight--cyanophage={segment.highlight ===
														'cyanophage'}
													class:stats-block-highlight--mana2={segment.highlight === 'mana2'}
													class:stats-block-highlight--sort={segment.highlight === 'sort'}
													>{segment.text}</span
												>
											{/each}
										</div>
									{/each}
								</div>
							{:else}
								<pre
									class="stats-block stats-block--mana2 shrink-0"
									class:stats-block--unavailable={!mana2Loading}>{mana2StatsPlaceholder}</pre>
							{/if}
						</div>
					{/if}
				</div>
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

<ModalShell
	open={expanded}
	onClose={closeExpanded}
	labelledBy={expandTitleId}
	panelClass="max-h-[min(94vh,980px)] max-w-[min(1480px,98vw)]"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4 shrink-0"
		style="border-color: var(--border);"
	>
		<h2
			id={expandTitleId}
			class="text-lg font-semibold truncate min-w-0"
			style="color: var(--text-primary);"
			title={layout.name}
		>
			{layout.name}
		</h2>
		<button
			type="button"
			onclick={closeExpanded}
			class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="expand-modal-body min-h-0 flex-1 overflow-y-auto px-5 py-4">
		<div class="expand-modal-columns">
			<div class="expand-modal-side">
				<div
					class="expand-layout-col flex min-w-0 flex-col gap-2 rounded-xl px-3 pt-3 pb-2"
					class:layout-card--force-included={forceIncluded}
					style="
						background-color: {forceIncluded ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
						border: 1px solid {isSimilarActive ? 'var(--similar-diff)' : 'var(--border)'};
					"
				>
					{@render layoutCardMain(false, false)}
				</div>
			</div>

			<div class="expand-modal-main">
				<div class="expand-unique-columns">
					<LayoutExpandUniqueStats
						analyzer={DEFAULT_STATS_ANALYZER}
						label={monkeyLabel}
						stats={expandBotStats}
						loading={expandMonkeyLoading}
					/>
					<LayoutExpandUniqueStats
						analyzer={CYANOPHAGE_ANALYZER}
						label={cyanophageLabel}
						stats={expandCyanophageStats}
						loading={expandCyanophageLoading}
						cyanophageUnsupported={!layout.cyanophageCompatible}
					/>
					<LayoutExpandUniqueStats
						analyzer={MANA2_ANALYZER}
						label={mana2Label}
						stats={expandMana2Stats}
						loading={expandMana2Loading}
					/>
				</div>

				<section class="expand-shared-stats" aria-labelledby={`${expandTitleId}-shared`}>
					<h3
						id={`${expandTitleId}-shared`}
						class="expand-shared-stats-title"
						style="color: var(--text-primary);"
					>
						Shared stats
					</h3>
					<p class="expand-shared-stats-note" style="color: var(--text-secondary);">
						Metrics present in at least two analyzers. Values use each analyzer’s own definition and
						units — not always directly comparable.
					</p>
				<div class="expand-shared-stats-scroll">
					<table class="expand-shared-stats-table">
						<thead>
							<tr>
								<th scope="col" class="expand-shared-stats-metric">Stat</th>
								<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--cmini"
									>{cminiTableLabel}</th
								>
								<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
									>{cyanophageLabel}</th
								>
								<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--mana2"
									>{mana2Label}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each expandSharedStatRows as row (row.label)}
								<tr>
									<th scope="row" class="expand-shared-stats-metric">{row.label}</th>
									<td class="expand-shared-stats-col expand-shared-stats-col--cmini"
										>{row.monkey}</td
									>
									<td class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
										>{row.cyanophage}</td
									>
									<td class="expand-shared-stats-col expand-shared-stats-col--mana2">{row.mana2}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="expand-shared-hand-grid">
					<div>
						<h3
							id={`${expandTitleId}-left-hand`}
							class="expand-shared-stats-title expand-shared-stats-title--secondary"
							style="color: var(--text-primary);"
						>
							Left hand
						</h3>
						<p class="expand-shared-stats-note" style="color: var(--text-secondary);">
							Left-hand balance and per-finger load.
						</p>
						<div class="expand-shared-stats-scroll">
							<table class="expand-shared-stats-table">
								<thead>
									<tr>
										<th scope="col" class="expand-shared-stats-metric">Stat</th>
										<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--cmini"
											>{cminiTableLabel}</th
										>
										<th
											scope="col"
											class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
											>{cyanophageLabel}</th
										>
										<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--mana2"
											>{mana2Label}</th
										>
									</tr>
								</thead>
								<tbody>
									{#each expandSharedLeftHandRows as row (row.label)}
										<tr>
											<th scope="row" class="expand-shared-stats-metric">{row.label}</th>
											<td class="expand-shared-stats-col expand-shared-stats-col--cmini"
												>{row.monkey}</td
											>
											<td class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
												>{row.cyanophage}</td
											>
											<td class="expand-shared-stats-col expand-shared-stats-col--mana2"
												>{row.mana2}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div>
						<h3
							id={`${expandTitleId}-right-hand`}
							class="expand-shared-stats-title expand-shared-stats-title--secondary"
							style="color: var(--text-primary);"
						>
							Right hand
						</h3>
						<p class="expand-shared-stats-note" style="color: var(--text-secondary);">
							Right-hand balance and per-finger load.
						</p>
						<div class="expand-shared-stats-scroll">
							<table class="expand-shared-stats-table">
								<thead>
									<tr>
										<th scope="col" class="expand-shared-stats-metric">Stat</th>
										<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--cmini"
											>{cminiTableLabel}</th
										>
										<th
											scope="col"
											class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
											>{cyanophageLabel}</th
										>
										<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--mana2"
											>{mana2Label}</th
										>
									</tr>
								</thead>
								<tbody>
									{#each expandSharedRightHandRows as row (row.label)}
										<tr>
											<th scope="row" class="expand-shared-stats-metric">{row.label}</th>
											<td class="expand-shared-stats-col expand-shared-stats-col--cmini"
												>{row.monkey}</td
											>
											<td class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
												>{row.cyanophage}</td
											>
											<td class="expand-shared-stats-col expand-shared-stats-col--mana2"
												>{row.mana2}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</section>
			</div>
		</div>
	</div>
</ModalShell>

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
		cursor: pointer;
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
		transition:
			background-color 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease,
			box-shadow 0.12s ease,
			transform 0.08s ease;
	}

	.card-action-button:hover:not(:disabled) {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	.card-action-button:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: none;
		background-color: color-mix(in srgb, var(--accent) 26%, var(--bg-primary));
		border-color: var(--accent);
	}

	.card-action-button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.card-action-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}

	.card-action-button--accent {
		color: white;
		background-color: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 18%, transparent);
	}

	.card-action-button--accent:hover:not(:disabled) {
		color: white;
		background-color: color-mix(in srgb, var(--accent) 88%, black);
		border-color: color-mix(in srgb, var(--accent) 88%, black);
	}

	.card-action-button--accent:active:not(:disabled) {
		background-color: color-mix(in srgb, var(--accent) 78%, black);
		border-color: color-mix(in srgb, var(--accent) 78%, black);
	}

	.card-action-button--similar {
		color: var(--similar-active-fg);
		background-color: var(--similar-diff);
		border-color: var(--similar-diff);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 18%, transparent);
	}

	.card-action-button--similar:hover:not(:disabled) {
		color: var(--similar-active-fg);
		background-color: color-mix(in srgb, var(--similar-diff) 88%, black);
		border-color: color-mix(in srgb, var(--similar-diff) 88%, black);
	}

	.card-action-button--similar:active:not(:disabled) {
		background-color: color-mix(in srgb, var(--similar-diff) 78%, black);
		border-color: color-mix(in srgb, var(--similar-diff) 78%, black);
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

	.new-layout-dot {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 9999px;
		background-color: var(--new-layout-dot);
	}

	.stats-stack {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stats-stack--dual {
		gap: 0.75rem;
	}

	.stats-stack-item {
		min-width: 0;
	}

	.stats-analyzer-label {
		margin-bottom: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1rem;
		letter-spacing: 0.01em;
		color: var(--text-primary);
	}

	.expand-modal-columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.expand-modal-side {
		min-width: 0;
	}

	.expand-modal-main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.expand-unique-columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		min-width: 0;
		align-items: start;
	}

	@media (min-width: 720px) {
		.expand-unique-columns {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.expand-layout-col .layout-display-area {
		flex: 0 0 auto;
	}

	@media (min-width: 960px) {
		.expand-modal-columns {
			grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
			gap: 1.5rem;
		}

		/* Stick within .expand-modal-body’s overflow; disabled when columns stack. */
		.expand-modal-side {
			position: sticky;
			top: 0;
			align-self: start;
			z-index: 1;
		}
	}

	.expand-shared-stats {
		min-width: 0;
	}

	.expand-shared-stats-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.25rem;
	}

	.expand-shared-stats-title--secondary {
		margin-top: 0;
	}

	.expand-shared-hand-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	@media (min-width: 768px) {
		.expand-shared-hand-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.expand-shared-stats-note {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.75rem;
		line-height: 1.2rem;
	}

	.expand-shared-stats-scroll {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background-color: var(--bg-secondary);
	}

	.expand-shared-stats-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
		line-height: 1.25rem;
		font-variant-numeric: tabular-nums;
	}

	.expand-shared-stats-table th,
	.expand-shared-stats-table td {
		padding: 0.45rem 0.75rem;
		text-align: right;
		border-bottom: 1px solid var(--border);
		color: var(--text-primary);
		white-space: nowrap;
	}

	.expand-shared-stats-table tbody tr:last-child th,
	.expand-shared-stats-table tbody tr:last-child td {
		border-bottom: 0;
	}

	.expand-shared-stats-metric {
		text-align: left !important;
		font-weight: 500;
		color: var(--text-secondary) !important;
	}

	.expand-shared-stats-table thead th {
		font-weight: 600;
		background-color: color-mix(in srgb, var(--bg-primary) 55%, var(--bg-secondary));
	}

	.expand-shared-stats-col--cmini {
		color: var(--analyzer-cmini);
	}

	.expand-shared-stats-col--cyanophage {
		color: var(--analyzer-cyanophage);
	}

	.expand-shared-stats-col--mana2 {
		color: var(--analyzer-mana2);
	}

	.expand-shared-stats-table tbody td.expand-shared-stats-col--cmini,
	.expand-shared-stats-table tbody td.expand-shared-stats-col--cyanophage,
	.expand-shared-stats-table tbody td.expand-shared-stats-col--mana2 {
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
</style>
