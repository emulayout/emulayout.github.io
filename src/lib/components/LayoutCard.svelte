<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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
		getCyanophageStatsUnavailableReason,
		showsCyanophageStats,
		showsMana2Stats,
		showsCminiStats,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';
	import AnalyzerTabs from '$lib/components/AnalyzerTabs.svelte';
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
	import { layoutDetailPageHref } from '$lib/layoutDetailTabs';
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
		/** Controlled analyzer for a standalone card; catalog cards use the global analyzer. */
		statsAnalyzer?: StatsAnalyzer;
		onStatsAnalyzerChange?: (analyzer: StatsAnalyzer) => void;
		allowStatSorting?: boolean;
		onStatFilterChanged?: (
			metric: LayoutCardMetric,
			operator: StatLimitOperator,
			value: string,
			enabled: boolean
		) => void;
		/** Catalog cards link to details and may render stats/test UI; summaries stay compact. */
		variant?: 'catalog' | 'summary';
		/** Controlled transform used by the detail page's persistent angle-mod option. */
		anglemodTransformActive?: boolean;
		/** Render the catalog-style anglemod action as the summary card's only action. */
		showAnglemodAction?: boolean;
		onAnglemodTransformChange?: (active: boolean) => void;
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
		statsAnalyzer,
		onStatsAnalyzerChange,
		allowStatSorting = true,
		onStatFilterChanged,
		variant = 'catalog',
		anglemodTransformActive,
		showAnglemodAction = false,
		onAnglemodTransformChange
	}: Props = $props();

	let localAnglemod = $state(false);
	let keyboardLinkPointer:
		| {
				pointerId: number;
				startX: number;
				startY: number;
				moved: boolean;
		  }
		| undefined;

	const detailTarget = '/layouts/[name]';
	const detailHref = $derived(layoutDetailPageHref(resolve(detailTarget, { name: layout.name })));
	const keyboardDragThreshold = 5;

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
	const anglemod = $derived(
		anglemodTransformActive ??
			(isSimilarActive ? filterStore.similarReferenceAnglemod : localAnglemod)
	);

	function toggleAnglemod() {
		if (anglemodTransformActive !== undefined && onAnglemodTransformChange) {
			onAnglemodTransformChange(!anglemodTransformActive);
			return;
		}
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

	const displayedStatsAnalyzer = $derived(statsAnalyzer ?? filterStore.statsAnalyzer);
	const showCminiStats = $derived(showsCminiStats(displayedStatsAnalyzer));
	const showCyanophageStats = $derived(showsCyanophageStats(displayedStatsAnalyzer));
	const showMana2Stats = $derived(showsMana2Stats(displayedStatsAnalyzer));
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
			cyanophageUnavailableReason: getCyanophageStatsUnavailableReason(layout),
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
					cyanophageUnavailableReason: getCyanophageStatsUnavailableReason(layout),
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
			displayedStatsAnalyzer,
			statsMode
		)
	);
	const renderStats = $derived(variant === 'summary' || filterStore.showLayoutStats);
	const renderTestArea = $derived(variant === 'catalog' && filterStore.showLayoutTestArea);

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

	function handleKeyboardLinkPointerDown(event: PointerEvent) {
		if (event.button !== 0 || !event.isPrimary) return;
		keyboardLinkPointer = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			moved: false
		};
	}

	function handleKeyboardLinkPointerMove(event: PointerEvent) {
		if (!keyboardLinkPointer || keyboardLinkPointer.pointerId !== event.pointerId) return;
		if (
			Math.hypot(
				event.clientX - keyboardLinkPointer.startX,
				event.clientY - keyboardLinkPointer.startY
			) >= keyboardDragThreshold
		) {
			keyboardLinkPointer.moved = true;
		}
	}

	function handleKeyboardLinkPointerCancel(event: PointerEvent) {
		if (keyboardLinkPointer?.pointerId === event.pointerId) keyboardLinkPointer = undefined;
	}

	function handleKeyboardLinkClick(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}

		const link = event.currentTarget as HTMLAnchorElement;
		const selection = window.getSelection();
		const selectionInsideLink = Boolean(
			selection &&
			!selection.isCollapsed &&
			((selection.anchorNode && link.contains(selection.anchorNode)) ||
				(selection.focusNode && link.contains(selection.focusNode)))
		);
		const dragged = event.detail > 0 && keyboardLinkPointer?.moved;
		keyboardLinkPointer = undefined;

		if (dragged || selectionInsideLink) {
			event.preventDefault();
			return;
		}

		event.preventDefault();
		// detailHref starts with route-aware resolve(); the helper appends only the canonical query.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(detailHref, {
			state: { ...page.state, fromLayoutIndex: true }
		});
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
		showSelection={catalogCard}
		authorInteractive={catalogCard}
		{similarMatchPercent}
		{similarMirrored}
		onToggleSelection={handleToggleSelection}
		onSelectAuthor={handleSelectAuthor}
	/>

	<div class="layout-keyboard-row min-w-0 flex-1">
		{#if catalogCard}
			<!-- detailHref starts with route-aware resolve(); the helper appends only the canonical query. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={detailHref}
				class="layout-keyboard-link min-w-0 flex-1"
				aria-label={`View ${layout.name} layout details`}
				title="View layout details"
				draggable="false"
				onpointerdown={handleKeyboardLinkPointerDown}
				onpointermove={handleKeyboardLinkPointerMove}
				onpointercancel={handleKeyboardLinkPointerCancel}
				onclick={handleKeyboardLinkClick}
			>
				<LayoutKeyDisplay
					rows={transformedDisplayRows}
					value={transformedDisplayValue}
					highlightDifferences={showSimilarDiffs}
					referencePositions={similarDiffPositions}
					fillAvailableSpace
				/>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<LayoutKeyDisplay
				rows={transformedDisplayRows}
				value={transformedDisplayValue}
				highlightDifferences={showSimilarDiffs}
				referencePositions={similarDiffPositions}
				fillAvailableSpace
			/>
		{/if}
		<LayoutInputMappingsIndicator
			{layout}
			{mappingsLabel}
			{inputProfile}
			active={catalogCard && inputMappingsWindowOpen}
			{repeatKeyEnabled}
			{adaptiveMappingsEnabled}
			{magicMappingsEnabled}
			onToggleRepeat={catalogCard && inputProfile?.repeatKey ? toggleRepeatKey : undefined}
			onToggleMappings={catalogCard && inputMappingsAvailable && onToggleInputMappingsWindow
				? toggleInputMappings
				: undefined}
		/>
	</div>

	{#if catalogCard || showAnglemodAction}
		<LayoutCardActions
			{markFirstAction}
			similarActive={isSimilarActive}
			hasSimilarReference={filterStore.hasSimilarReference}
			anglemodActive={anglemod}
			angleBoard={isAngleBoard}
			cyanophageCompatible={layout.cyanophageCompatible}
			cyanophageTitle={cyanophageLinkTitle}
			expandLayoutName={catalogCard ? layout.name : undefined}
			{forceIncluded}
			onFindSimilar={handleFindSimilarClick}
			onToggleAnglemod={toggleAnglemod}
			onPractice={handleColemakCampClick}
			onOpenPlayground={handlePlaygroundClick}
			angleOnly={!catalogCard}
		/>
	{/if}
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

	{#if renderStats || renderTestArea}
		<div class="card-footer shrink-0 pt-1 flex flex-col gap-3">
			{#if renderStats}
				<LayoutCardStatsPanel
					cmini={cminiStatsModel}
					cyanophage={cyanophageStatsModel}
					mana2={mana2StatsModel}
					sortMetric={selectedSortMetric}
					filterValueOnClick={statFilterInteraction === 'apply-only'}
					onFilterMetric={variant === 'catalog' ? handleFilterMetric : undefined}
					onSortMetric={variant === 'catalog' && allowStatSorting ? handleSortMetric : undefined}
					showFingerDistanceBars={uiPrefs.fingerDistanceBars}
					mode={statsMode}
				/>
				{#if variant === 'summary' && onStatsAnalyzerChange}
					<div class="layout-card-analyzer-switch">
						<AnalyzerTabs
							variant="toolbar"
							ariaLabel={`Stats analyzer for ${layout.name}`}
							value={displayedStatsAnalyzer}
							onChange={onStatsAnalyzerChange}
							class="layout-card-analyzer-tabs"
						/>
					</div>
				{/if}
			{/if}
			{#if renderTestArea}
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

	.layout-keyboard-link {
		display: flex;
		border-radius: 0.5rem;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
		-webkit-user-select: text;
		user-select: text;
	}

	.layout-keyboard-link:hover {
		background-color: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.layout-keyboard-link:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.layout-card-analyzer-switch {
		display: flex;
		width: 100%;
		padding-top: 0.125rem;
	}

	.layout-card-analyzer-switch :global(.layout-card-analyzer-tabs) {
		width: 100%;
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
