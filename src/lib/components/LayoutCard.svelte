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
	import { getLayoutCardHeight } from '$lib/constants';
	import {
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
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/layoutStats';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import LayoutCardActions from '$lib/components/LayoutCardActions.svelte';
	import LayoutCardHeader from '$lib/components/LayoutCardHeader.svelte';
	import LayoutExpandUniqueStats from '$lib/components/LayoutExpandUniqueStats.svelte';
	import LayoutKeyDisplay from '$lib/components/LayoutKeyDisplay.svelte';
	import LayoutStatsBlock from '$lib/components/LayoutStatsBlock.svelte';
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
	import {
		applyAnglemodToDisplayRows,
		computeDisplayRows,
		displayRowsToString,
		removeAnglemodFromDisplayRows,
		type DisplayCell
	} from '$lib/layoutDisplay';
	import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';

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
	let localAnglemod = $state(false);
	let expanded = $state(false);
	/** Which analyzers are visible in the expand modal (driven by Show analyzers). */
	let expandShowMonkey = $state(false);
	let expandShowCyanophage = $state(false);
	let expandShowMana2 = $state(false);

	const expandTitleId = $derived(
		`layout-expand-title-${layout.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`
	);
	const expandAnalyzersTitleId = $derived(`${expandTitleId}-analyzers`);
	const expandAnalyzerCount = $derived(
		(expandShowMonkey ? 1 : 0) + (expandShowCyanophage ? 1 : 0) + (expandShowMana2 ? 1 : 0)
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
	const layoutTestKeyMaps = $derived(createLayoutTestKeyMaps(transformedDisplayValue));

	const showSimilarDiffs = $derived(
		Boolean(similarDiffPositions && similarDiffPositions.size > 0 && !isSimilarActive)
	);

	const isNewLayout = $derived(
		filterStore.showNewLayoutIndicator &&
			isNewSinceLastSync(layout, layoutsCatalog.latestLayoutDayKey)
	);

	const showMonkeyStats = $derived(showsMonkeyracerStats(filterStore.statsAnalyzer));
	const showCyanophageStats = $derived(showsCyanophageStats(filterStore.statsAnalyzer));
	const showMana2Stats = $derived(showsMana2Stats(filterStore.statsAnalyzer));
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

	const expandMonkeyLoading = $derived(
		expandShowMonkey && layoutStatsStore.isLoading(DEFAULT_STATS_ANALYZER)
	);
	const expandCyanophageLoading = $derived(
		expandShowCyanophage && layoutStatsStore.isLoading(CYANOPHAGE_ANALYZER)
	);
	const expandMana2Loading = $derived(
		expandShowMana2 && layoutStatsStore.isLoading(MANA2_ANALYZER)
	);

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
		const pair = (a: number, b: number) => `${formatStatPercent(a)} | ${formatStatPercent(b)}`;
		const monkeyPair = (
			getA: (stats: NonNullable<typeof expandBotStats>) => number,
			getB: (stats: NonNullable<typeof expandBotStats>) => number
		): Cell => {
			if (expandMonkeyLoading) return loading;
			if (!expandBotStats) return dash;
			return pair(getA(expandBotStats), getB(expandBotStats));
		};
		const mana2Pair = (
			getA: (stats: NonNullable<typeof expandMana2Stats>) => number,
			getB: (stats: NonNullable<typeof expandMana2Stats>) => number
		): Cell => {
			if (expandMana2Loading) return loading;
			if (!expandMana2Stats) return dash;
			return pair(getA(expandMana2Stats), getB(expandMana2Stats));
		};

		return { dash, monkeyCell, cyanoCell, mana2Cell, mana2Raw, monkeyPair, mana2Pair };
	});

	const expandSharedStatRows = $derived.by(() => {
		const { dash, monkeyCell, cyanoCell, mana2Cell, mana2Raw, monkeyPair, mana2Pair } =
			expandSharedCells;

		return [
			{
				label: 'Same-finger bigrams',
				monkey: monkeyCell((s) => s.sfb),
				cyanophage: cyanoCell((s) => s.sfb),
				mana2: mana2Cell((s) => s.sfb)
			},
			{
				// Skipgram SFB — cmini’s “SFS” is trigram end-same-finger, not this.
				label: 'Same-finger skip',
				monkey: dash,
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
				label: 'Alt & SFS',
				monkey: monkeyCell((s) => s.dsfbAlt),
				cyanophage: dash,
				mana2: mana2Cell((s) => s.altSfs)
			},
			{
				// cmini rtl (= roll + one-hand) matches Mana2 roll total; cmini roll is 2-key only.
				label: 'Roll total',
				monkey: monkeyCell((s) => s.rtl),
				cyanophage: cyanoCell((s) => s.roll),
				mana2: mana2Cell((s) => s.roll)
			},
			{
				label: 'Roll in / out (2)',
				monkey: monkeyPair((s) => s.rollIn, (s) => s.rollOut),
				cyanophage: dash,
				mana2: mana2Pair((s) => s.inroll2, (s) => s.outroll2)
			},
			{
				label: 'One-hand in / out (3)',
				monkey: monkeyPair((s) => s.oneIn, (s) => s.oneOut),
				cyanophage: dash,
				mana2: mana2Pair((s) => s.inroll3, (s) => s.outroll3)
			},
			{
				label: 'Redirect',
				monkey: monkeyCell((s) => s.red),
				cyanophage: cyanoCell((s) => s.redirect),
				mana2: mana2Cell((s) => s.redirect)
			},
			{
				label: 'Weak / bad redirect',
				monkey: monkeyCell((s) => s.badRedirect),
				cyanophage: dash,
				mana2: mana2Cell((s) => s.redirectWeak)
			},
			{
				label: 'Redirect & SFS',
				monkey: monkeyCell((s) => s.dsfbRed),
				cyanophage: dash,
				mana2: mana2Cell((s) => s.redirectSfs)
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
		const { monkeyCell, cyanoCell, mana2Cell } = expandSharedCells;
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

	function hasExpandAnalyzerData(analyzer: StatsAnalyzer): boolean {
		if (analyzer === DEFAULT_STATS_ANALYZER) {
			return Boolean(layoutStatsStore.maps.monkeyracer?.[layout.name] ?? compactMonkeyStats);
		}
		if (analyzer === CYANOPHAGE_ANALYZER) {
			if (!layout.cyanophageCompatible) return false;
			return Boolean(layoutStatsStore.maps.cyanophage?.[layout.name] ?? compactCyanophageStats);
		}
		return Boolean(layoutStatsStore.maps.mana2?.[layout.name] ?? compactMana2Stats);
	}

	$effect(() => {
		if (!expanded) return;
		if (expandShowMonkey) void layoutStatsStore.ensureLoaded(DEFAULT_STATS_ANALYZER);
		if (expandShowCyanophage) void layoutStatsStore.ensureLoaded(CYANOPHAGE_ANALYZER);
		if (expandShowMana2) void layoutStatsStore.ensureLoaded(MANA2_ANALYZER);
	});

	function setExpandAnalyzer(analyzer: StatsAnalyzer, checked: boolean) {
		if (analyzer === DEFAULT_STATS_ANALYZER) expandShowMonkey = checked;
		else if (analyzer === CYANOPHAGE_ANALYZER) expandShowCyanophage = checked;
		else expandShowMana2 = checked;
		if (checked) void layoutStatsStore.ensureLoaded(analyzer);
	}

	function openExpanded() {
		expandShowMonkey = hasExpandAnalyzerData(DEFAULT_STATS_ANALYZER);
		expandShowCyanophage = hasExpandAnalyzerData(CYANOPHAGE_ANALYZER);
		expandShowMana2 = hasExpandAnalyzerData(MANA2_ANALYZER);
		expanded = true;
	}

	function closeExpanded() {
		expanded = false;
	}

	const cardHeight = $derived(
		getLayoutCardHeight(
			filterStore.showLayoutStats,
			filterStore.showLayoutTestArea,
			showMana2Stats
		)
	);

	async function handleColemakCampClick() {
		const { createColemakCampURLFromKeyMap } = await import('$lib/colemakCamp');
		const url = createColemakCampURLFromKeyMap(layoutTestKeyMaps.keyMap, layout.board);
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	async function handlePlaygroundClick() {
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

	function handleToggleCompare() {
		filterStore.toggleCompareLayout(layout.name);
	}

	function handleSelectAuthor() {
		filterStore.clearAuthors();
		filterStore.toggleAuthor(layout.user);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

{#snippet layoutCardMain(markFirstAction: boolean, showExpand = true)}
	<LayoutCardHeader
		{layout}
		{authorName}
		{likeCount}
		compareSelected={isCompareSelected}
		showLikes={filterStore.showLayoutLikes}
		showNewIndicator={isNewLayout}
		showSimilarityMatch={filterStore.hasSimilarReference && !isSimilarActive}
		{similarMatchPercent}
		{similarMirrored}
		onToggleCompare={handleToggleCompare}
		onSelectAuthor={handleSelectAuthor}
	/>

	<LayoutKeyDisplay
		rows={transformedDisplayRows}
		value={transformedDisplayValue}
		highlightDifferences={showSimilarDiffs}
		referencePositions={similarDiffPositions}
		fillAvailableSpace={showExpand}
	/>

	<LayoutCardActions
		{markFirstAction}
		similarActive={isSimilarActive}
		hasSimilarReference={filterStore.hasSimilarReference}
		anglemodActive={anglemod}
		angleBoard={isAngleBoard}
		cyanophageCompatible={layout.cyanophageCompatible}
		cyanophageTitle={cyanophageLinkTitle}
		{showExpand}
		{forceIncluded}
		onFindSimilar={handleFindSimilarClick}
		onToggleAnglemod={toggleAnglemod}
		onPractice={handleColemakCampClick}
		onOpenPlayground={handlePlaygroundClick}
		onExpand={openExpanded}
	/>
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
				<div class="stats-stack">
					{#if showMonkeyStats}
						<div class="stats-stack-item">
							<LayoutStatsBlock
								lines={monkeyStatsBlockLines}
								fallback={monkeyStatsPlaceholder}
								unavailable={!monkeyLoading}
								shrink
							/>
						</div>
					{/if}
					{#if showCyanophageStats}
						<div class="stats-stack-item">
							<LayoutStatsBlock
								lines={cyanophageStatsBlockLines}
								fallback={cyanophageStatsPlaceholder}
								unavailable={!cyanophageLoading}
								shrink
							/>
						</div>
					{/if}
					{#if showMana2Stats}
						<div class="stats-stack-item">
							<LayoutStatsBlock
								lines={mana2StatsBlockLines}
								fallback={mana2StatsPlaceholder}
								unavailable={!mana2Loading}
								mana2
								shrink
							/>
						</div>
					{/if}
				</div>
			{/if}
			{#if filterStore.showLayoutTestArea}
				<LayoutTestArea {layout} keyMaps={layoutTestKeyMaps} />
			{/if}
		</div>
	{/if}
</div>

{#snippet expandAnalyzerToggle(
	analyzer: StatsAnalyzer,
	label: string,
	checked: boolean,
	accent: string
)}
	<label class="flex items-center gap-2 min-w-0 cursor-pointer">
		<span class="relative size-4 shrink-0">
			<input
				type="checkbox"
				{checked}
				onchange={(event) => setExpandAnalyzer(analyzer, event.currentTarget.checked)}
				class="size-4 rounded appearance-none cursor-pointer absolute inset-0 m-0"
				style="
					background-color: {checked ? accent : 'var(--bg-primary)'};
					border: 1px solid {checked ? accent : 'var(--border)'};
				"
			/>
			{#if checked}
				<svg
					class="absolute inset-0 m-auto size-3 pointer-events-none"
					style="color: white;"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="3"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{/if}
		</span>
		<span class="text-sm font-semibold min-w-0 truncate" style="color: {accent};">{label}</span>
	</label>
{/snippet}

{#snippet expandSharedHeaders()}
	{#if expandShowMonkey}
		<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--cmini"
			>{cminiTableLabel}</th
		>
	{/if}
	{#if expandShowCyanophage}
		<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--cyanophage"
			>{cyanophageLabel}</th
		>
	{/if}
	{#if expandShowMana2}
		<th scope="col" class="expand-shared-stats-col expand-shared-stats-col--mana2">{mana2Label}</th>
	{/if}
{/snippet}

{#snippet expandSharedCellsRow(row: { monkey: string; cyanophage: string; mana2: string })}
	{#if expandShowMonkey}
		<td class="expand-shared-stats-col expand-shared-stats-col--cmini">{row.monkey}</td>
	{/if}
	{#if expandShowCyanophage}
		<td class="expand-shared-stats-col expand-shared-stats-col--cyanophage">{row.cyanophage}</td>
	{/if}
	{#if expandShowMana2}
		<td class="expand-shared-stats-col expand-shared-stats-col--mana2">{row.mana2}</td>
	{/if}
{/snippet}

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

				<section
					class="expand-analyzers flex min-w-0 flex-col gap-2 rounded-xl px-3 py-3"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-labelledby={expandAnalyzersTitleId}
				>
					<h3
						id={expandAnalyzersTitleId}
						class="text-sm font-semibold m-0"
						style="color: var(--text-primary);"
					>
						Show analyzers
					</h3>
					<div class="flex flex-col gap-2 min-w-0">
						{@render expandAnalyzerToggle(
							DEFAULT_STATS_ANALYZER,
							monkeyLabel,
							expandShowMonkey,
							'var(--analyzer-cmini)'
						)}
						{@render expandAnalyzerToggle(
							CYANOPHAGE_ANALYZER,
							cyanophageLabel,
							expandShowCyanophage,
							'var(--analyzer-cyanophage)'
						)}
						{@render expandAnalyzerToggle(
							MANA2_ANALYZER,
							mana2Label,
							expandShowMana2,
							'var(--analyzer-mana2)'
						)}
					</div>
				</section>
			</div>

			<div class="expand-modal-main">
				{#if expandAnalyzerCount > 0}
					<div
						class="expand-unique-columns"
						style="--expand-unique-cols: {expandAnalyzerCount};"
					>
						{#if expandShowMonkey}
							<LayoutExpandUniqueStats
								analyzer={DEFAULT_STATS_ANALYZER}
								label={monkeyLabel}
								stats={expandBotStats}
								loading={expandMonkeyLoading}
							/>
						{/if}
						{#if expandShowCyanophage}
							<LayoutExpandUniqueStats
								analyzer={CYANOPHAGE_ANALYZER}
								label={cyanophageLabel}
								stats={expandCyanophageStats}
								loading={expandCyanophageLoading}
								cyanophageUnsupported={!layout.cyanophageCompatible}
							/>
						{/if}
						{#if expandShowMana2}
							<LayoutExpandUniqueStats
								analyzer={MANA2_ANALYZER}
								label={mana2Label}
								stats={expandMana2Stats}
								loading={expandMana2Loading}
							/>
						{/if}
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
							Metrics present in at least two analyzers. Values use each analyzer’s own definition
							and units — not always directly comparable.
						</p>
						<div class="expand-shared-stats-scroll">
							<table class="expand-shared-stats-table">
								<thead>
									<tr>
										<th scope="col" class="expand-shared-stats-metric">Stat</th>
										{@render expandSharedHeaders()}
									</tr>
								</thead>
								<tbody>
									{#each expandSharedStatRows as row (row.label)}
										<tr>
											<th scope="row" class="expand-shared-stats-metric">{row.label}</th>
											{@render expandSharedCellsRow(row)}
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
												{@render expandSharedHeaders()}
											</tr>
										</thead>
										<tbody>
											{#each expandSharedLeftHandRows as row (row.label)}
												<tr>
													<th scope="row" class="expand-shared-stats-metric">{row.label}</th>
													{@render expandSharedCellsRow(row)}
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
												{@render expandSharedHeaders()}
											</tr>
										</thead>
										<tbody>
											{#each expandSharedRightHandRows as row (row.label)}
												<tr>
													<th scope="row" class="expand-shared-stats-metric">{row.label}</th>
													{@render expandSharedCellsRow(row)}
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</section>
				{:else}
					<p class="m-0 text-sm" style="color: var(--text-secondary);">
						Select one or more analyzers to show stats.
					</p>
				{/if}
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

	.stats-stack {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stats-stack-item {
		min-width: 0;
	}

	.expand-modal-columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.expand-modal-side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
		--expand-unique-cols: 1;
	}

	@media (min-width: 720px) {
		.expand-unique-columns {
			grid-template-columns: repeat(var(--expand-unique-cols), minmax(0, 1fr));
			align-items: stretch;
		}
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
