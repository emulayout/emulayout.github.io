<script lang="ts">
	import { page } from '$app/state';
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		CompactMana2Stats,
		LayoutData
	} from '$lib/layout';
	import { filterStore, type StatLimitOperator } from '$lib/filterStore.svelte';
	import { uiPrefs, type LayoutCardStatsMode } from '$lib/uiPrefs.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { isNewSinceLastSync } from '$lib/recentLayouts';
	import { getLayoutCardHeight } from '$lib/constants';
	import {
		CYANOPHAGE_ANALYZER,
		CYANOPHAGE_UNSUPPORTED_LABEL,
		CMINI_ANALYZER,
		MANA2_ANALYZER,
		showsCyanophageStats,
		showsMana2Stats,
		showsCminiStats
	} from '$lib/statsAnalyzers';
	import { getStatCardHighlightState } from '$lib/statsUsage';
	import { getStatMetricFilterTarget } from '$lib/statsFiltering';
	import LayoutCardActions from '$lib/components/LayoutCardActions.svelte';
	import LayoutCardHeader from '$lib/components/LayoutCardHeader.svelte';
	import LayoutCardStatsPanel from '$lib/components/LayoutCardStatsPanel.svelte';
	import LayoutInputMappingsIndicator from '$lib/components/LayoutInputMappingsIndicator.svelte';
	import LayoutKeyDisplay from '$lib/components/LayoutKeyDisplay.svelte';
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import {
		applyAnglemodToDisplayRows,
		computeDisplayRows,
		displayRowsToString,
		removeAnglemodFromDisplayRows,
		type DisplayCell
	} from '$lib/layoutDisplay';
	import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import { buildLayoutStatsBlockModel, type LayoutCardMetric } from '$lib/layoutStatsBlockModel';
	import {
		getStatSortField,
		getStatSortFieldsForAnalyzer,
		type SortBy,
		type SortOrder
	} from '$lib/statsSorting';
	import {
		inputMappingsLabel,
		inputProfileMappingsLabel,
		type LayoutInputProfile
	} from '$lib/layoutInputBehaviors';
	import {
		adaptiveProfileMappingIds,
		magicProfileMappingIds,
		repeatKeyMappingId
	} from '$lib/inputMappingControls';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		/** Compact cmini stats when that analyzer is shown. */
		compactCminiStats?: CompactLayoutStats;
		/** Compact cyanophage stats when that analyzer is shown. */
		compactCyanophageStats?: CompactCyanophageStats;
		/** Compact mana2 stats when that analyzer is shown. */
		compactMana2Stats?: CompactMana2Stats;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		inputMappingsWindowOpen?: boolean;
		onToggleInputMappingsWindow?: () => void;
		/** Injected into results despite failing filters (Include selected). */
		forceIncluded?: boolean;
		similarMatchPercent?: number;
		/** Best similarity score came from a mirrored (left/right flipped) comparison. */
		similarMirrored?: boolean;
		/** When set, keys that differ from this reference layout are highlighted. */
		similarDiffPositions?: Map<string, string>;
		/** Shared filter/sort highlights; omit to compute from the filter store. */
		statHighlights?: ReturnType<typeof getStatCardHighlightState>;
		/** Quick Find applies filters without navigating to the covered sidebar. */
		statFilterInteraction?: 'focus' | 'apply-only';
		statsMode?: LayoutCardStatsMode;
		allowStatSorting?: boolean;
		onStatFilterChanged?: (
			metric: LayoutCardMetric,
			operator: StatLimitOperator,
			value: string,
			enabled: boolean
		) => void;
		/** Catalog cards link to details and may render stats/test UI; summaries stay compact. */
		variant?: 'catalog' | 'summary';
	}

	const {
		layout,
		authorName,
		likeCount,
		compactCminiStats,
		compactCyanophageStats,
		compactMana2Stats,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		inputMappingsWindowOpen = false,
		onToggleInputMappingsWindow,
		forceIncluded = false,
		similarMatchPercent,
		similarMirrored = false,
		similarDiffPositions,
		statHighlights,
		statFilterInteraction = 'focus',
		statsMode = 'focused',
		allowStatSorting = true,
		onStatFilterChanged,
		variant = 'catalog'
	}: Props = $props();

	let localAnglemod = $state(false);

	const inputMappingsAvailable = $derived(
		Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps)
	);
	const mappingsLabel = $derived(
		inputProfile
			? inputProfileMappingsLabel(inputProfile)
			: inputMappingsLabel({
					magicKeys: layout.hasMagicKeyMappings,
					adaptiveSwaps: layout.hasAdaptiveSwapMappings
				})
	);
	const repeatMappingId = $derived(
		inputProfile?.repeatKey ? repeatKeyMappingId(inputProfile.repeatKey.trigger) : undefined
	);
	const repeatKeyEnabled = $derived(
		repeatMappingId === undefined || !disabledMappingIds.includes(repeatMappingId)
	);
	const adaptiveMappingIds = $derived(adaptiveProfileMappingIds(inputProfile?.adaptiveSwaps));
	const adaptiveMappingsEnabled = $derived(
		adaptiveMappingIds.length === 0 ||
			adaptiveMappingIds.some((id) => !disabledMappingIds.includes(id))
	);
	const magicMappingIds = $derived(magicProfileMappingIds(inputProfile?.magicKeys));
	const magicMappingsEnabled = $derived(
		magicMappingIds.length === 0 || magicMappingIds.some((id) => !disabledMappingIds.includes(id))
	);
	const isSimilarActive = $derived(filterStore.similarReferenceName === layout.name);
	const isSelected = $derived(filterStore.selectedLayoutNames.has(layout.name));

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

	const showCminiStats = $derived(showsCminiStats(filterStore.statsAnalyzer));
	const showCyanophageStats = $derived(showsCyanophageStats(filterStore.statsAnalyzer));
	const showMana2Stats = $derived(showsMana2Stats(filterStore.statsAnalyzer));
	const cyanophageLinkTitle = $derived(
		layout.cyanophageCompatible ? 'View on Cyanophage' : CYANOPHAGE_UNSUPPORTED_LABEL
	);

	const cminiLoading = $derived(showCminiStats && layoutStatsStore.isLoading(CMINI_ANALYZER));
	const cyanophageLoading = $derived(
		showCyanophageStats && layoutStatsStore.isLoading(CYANOPHAGE_ANALYZER)
	);
	const mana2Loading = $derived(showMana2Stats && layoutStatsStore.isLoading(MANA2_ANALYZER));

	const sortFieldHighlight = $derived(
		statHighlights ?? getStatCardHighlightState(filterStore.appliedStatLimits, filterStore.sortBy)
	);
	const selectedSortMetric = $derived.by(() => {
		const sortField = getStatSortField(filterStore.sortBy);
		if (!sortField) return null;

		const compactStats =
			sortField.analyzer === CYANOPHAGE_ANALYZER
				? compactCyanophageStats
				: sortField.analyzer === MANA2_ANALYZER
					? compactMana2Stats
					: compactCminiStats;
		const sourceModel = buildLayoutStatsBlockModel(sortField.analyzer, compactStats, {
			loading: layoutStatsStore.isLoading(sortField.analyzer),
			cyanophageCompatible: layout.cyanophageCompatible,
			highlights: sortFieldHighlight,
			sortOrder: filterStore.sortOrder
		});
		return (
			sourceModel.cardMetrics?.find(
				(metric) => metric.analyzer === sortField.analyzer && metric.key === sortField.key
			) ?? null
		);
	});
	const cminiStatsModel = $derived(
		showCminiStats
			? buildLayoutStatsBlockModel(CMINI_ANALYZER, compactCminiStats, {
					loading: cminiLoading,
					highlights: sortFieldHighlight,
					sortOrder: filterStore.sortOrder
				})
			: null
	);
	const cyanophageStatsModel = $derived(
		showCyanophageStats
			? buildLayoutStatsBlockModel(CYANOPHAGE_ANALYZER, compactCyanophageStats, {
					loading: cyanophageLoading,
					cyanophageCompatible: layout.cyanophageCompatible,
					highlights: sortFieldHighlight,
					sortOrder: filterStore.sortOrder
				})
			: null
	);
	const mana2StatsModel = $derived(
		showMana2Stats
			? buildLayoutStatsBlockModel(MANA2_ANALYZER, compactMana2Stats, {
					loading: mana2Loading,
					highlights: sortFieldHighlight,
					sortOrder: filterStore.sortOrder
				})
			: null
	);

	function handleSortMetric(metric: LayoutCardMetric, order: SortOrder) {
		const field = getStatSortFieldsForAnalyzer(metric.analyzer).find(
			(candidate) => candidate.key === metric.key
		);
		if (!field) return;
		filterStore.setSort(field.value as SortBy, order);
	}

	function handleFilterMetric(metric: LayoutCardMetric, useMetricValue: boolean) {
		const target = getStatMetricFilterTarget(metric.analyzer, metric.key);
		if (!target) return;
		if (useMetricValue) {
			const operator: StatLimitOperator = metric.preferredSortOrder === 'desc' ? 'gt' : 'lt';
			const value = metric.value.replace(/%$/, '');
			if (statFilterInteraction === 'apply-only') {
				const current = filterStore.statLimits[target.key];
				const alreadySet = current.operator === operator && current.value.trim() === value;
				if (alreadySet) {
					filterStore.clearStatLimit(target.key);
				} else {
					filterStore.setStatLimitOperator(target.key, operator);
					filterStore.setStatLimitValue(target.key, value);
				}
				onStatFilterChanged?.(metric, operator, value, !alreadySet);
				return;
			}
			filterStore.setStatLimitOperator(target.key, operator);
			filterStore.setStatLimitValue(target.key, value);
		}
		filterStore.requestFilterFocus({ target: 'stats', analyzer: metric.analyzer, ...target });
	}

	const cardHeight = $derived(
		getLayoutCardHeight(
			filterStore.showLayoutStats,
			filterStore.showLayoutTestArea,
			filterStore.statsAnalyzer,
			statsMode
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

	function handleToggleSelection() {
		filterStore.toggleSelectedLayout(layout.name);
	}

	function handleSelectAuthor() {
		filterStore.clearAuthors();
		filterStore.toggleAuthor(layout.user);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function toggleInputMappings() {
		if (!inputMappingsAvailable) return;
		onToggleInputMappingsWindow?.();
	}

	function toggleRepeatKey() {
		if (!repeatMappingId || !onDisabledMappingIdsChange) return;
		const retained = disabledMappingIds.filter((id) => id !== repeatMappingId);
		onDisabledMappingIdsChange(repeatKeyEnabled ? [...retained, repeatMappingId] : retained);
	}
</script>

{#snippet layoutCardMain(markFirstAction: boolean, catalogCard = true)}
	<LayoutCardHeader
		{layout}
		{authorName}
		{likeCount}
		selected={isSelected}
		showLikes={filterStore.showLayoutLikes}
		showNewIndicator={isNewLayout}
		showSimilarityMatch={filterStore.hasSimilarReference && !isSimilarActive}
		{similarMatchPercent}
		{similarMirrored}
		onToggleSelection={handleToggleSelection}
		onSelectAuthor={handleSelectAuthor}
	/>

	<div class="layout-keyboard-row min-w-0" class:flex-1={catalogCard}>
		<LayoutKeyDisplay
			rows={transformedDisplayRows}
			value={transformedDisplayValue}
			highlightDifferences={showSimilarDiffs}
			referencePositions={similarDiffPositions}
			fillAvailableSpace={catalogCard}
		/>
		<LayoutInputMappingsIndicator
			{layout}
			{mappingsLabel}
			{inputProfile}
			active={catalogCard && inputMappingsWindowOpen}
			{repeatKeyEnabled}
			{adaptiveMappingsEnabled}
			{magicMappingsEnabled}
			onToggleRepeat={inputProfile?.repeatKey ? toggleRepeatKey : undefined}
			onToggleMappings={catalogCard && inputMappingsAvailable ? toggleInputMappings : undefined}
		/>
	</div>

	<LayoutCardActions
		{markFirstAction}
		similarActive={isSimilarActive}
		hasSimilarReference={filterStore.hasSimilarReference}
		anglemodActive={anglemod}
		angleBoard={isAngleBoard}
		cyanophageCompatible={layout.cyanophageCompatible}
		cyanophageTitle={cyanophageLinkTitle}
		expandLayoutName={catalogCard ? layout.name : undefined}
		expandSearch={page.url.search}
		{forceIncluded}
		onFindSimilar={handleFindSimilarClick}
		onToggleAnglemod={toggleAnglemod}
		onPractice={handleColemakCampClick}
		onOpenPlayground={handlePlaygroundClick}
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
		height: {variant === 'catalog' ? `${cardHeight}px` : 'auto'};
	"
>
	{#if forceIncluded}
		<svg class="layout-card-force-border" aria-hidden="true">
			<rect pathLength="100" />
		</svg>
	{/if}
	{@render layoutCardMain(variant === 'catalog', variant === 'catalog')}

	{#if variant === 'catalog' && (filterStore.showLayoutStats || filterStore.showLayoutTestArea)}
		<div class="card-footer shrink-0 pt-1 flex flex-col gap-3">
			{#if filterStore.showLayoutStats}
				<LayoutCardStatsPanel
					cmini={cminiStatsModel}
					cyanophage={cyanophageStatsModel}
					mana2={mana2StatsModel}
					sortMetric={selectedSortMetric}
					filterValueOnClick={statFilterInteraction === 'apply-only'}
					onFilterMetric={handleFilterMetric}
					onSortMetric={allowStatSorting ? handleSortMetric : undefined}
					showFingerDistanceBars={uiPrefs.fingerDistanceBars}
					mode={statsMode}
				/>
			{/if}
			{#if filterStore.showLayoutTestArea}
				<LayoutTestArea {layout} keyMaps={layoutTestKeyMaps} {inputProfile} {disabledMappingIds} />
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

	.layout-keyboard-row {
		display: flex;
		align-items: center;
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
</style>
