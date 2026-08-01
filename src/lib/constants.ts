import type { StatsAnalyzer } from '$lib/statsAnalyzers';
import type { LayoutCardStatsMode } from '$lib/uiPrefs.svelte';

// LayoutCard dimensions constants
/** Action toolbar between layout display and stats (`.card-action-divider`). */
export const LAYOUT_CARD_ACTION_BAR_HEIGHT = 40;
/** Baseline card height for cmini's detailed stats view. */
export const LAYOUT_CARD_HEIGHT = 524;
/** Min height for layout display area (~4.5 rows × 14px × 1.5 line-height). */
export const LAYOUT_DISPLAY_MIN_HEIGHT = 94;
export const LAYOUT_CARD_ROW_GAP = 12; // px (mb-3 = 0.75rem = 12px)
export const LAYOUT_CARD_SECTION_GAP = 8; // px (gap-2 between main sections)
export const LAYOUT_CARD_BOTTOM_SECTION_GAP = 12; // px (gap-3 between stats and test area)
/** Space removed when the stats section is hidden entirely. */
export const LAYOUT_CARD_STATS_HEIGHT = 208;
/** 2-row textarea with px-3 pt-3 pb-0 (bottom inset comes from card pb-2). */
export const LAYOUT_CARD_TEST_AREA_HEIGHT = 56;

/** `.stats-block`: 11px font × 1.35 line height. */
const STATS_TEXT_LINE_HEIGHT = 14.85;
/** Two 44px rows plus the extra 8px gap Highlights adds over Detailed. */
const HIGHLIGHTS_STATS_HEIGHT = 96;
/** Detailed non-finger stat lines; finger usage occupies the chart's former fixed-height region. */
const DETAILED_STATS_LINE_COUNT: Readonly<Record<StatsAnalyzer, number>> = {
	cmini: 8,
	cyanophage: 7,
	mana2: 12
};
const CMINI_DETAILED_STATS_HEIGHT = DETAILED_STATS_LINE_COUNT.cmini * STATS_TEXT_LINE_HEIGHT;

export function getLayoutCardStatsHeight(
	analyzer: StatsAnalyzer,
	mode: LayoutCardStatsMode
): number {
	return mode === 'focused'
		? HIGHLIGHTS_STATS_HEIGHT
		: DETAILED_STATS_LINE_COUNT[analyzer] * STATS_TEXT_LINE_HEIGHT;
}

export function getLayoutCardHeight(
	showStats = true,
	showTestArea = true,
	analyzer: StatsAnalyzer = 'cmini',
	statsMode: LayoutCardStatsMode = 'detailed'
): number {
	let height = LAYOUT_CARD_HEIGHT;

	if (showStats) {
		height += getLayoutCardStatsHeight(analyzer, statsMode) - CMINI_DETAILED_STATS_HEIGHT;
	}

	if (!showStats) {
		height -= LAYOUT_CARD_STATS_HEIGHT;
		if (showTestArea) height -= LAYOUT_CARD_BOTTOM_SECTION_GAP;
	}

	if (!showTestArea) {
		height -= LAYOUT_CARD_TEST_AREA_HEIGHT;
		if (showStats) height -= LAYOUT_CARD_BOTTOM_SECTION_GAP;
	}

	if (!showStats && !showTestArea) {
		height -= LAYOUT_CARD_SECTION_GAP;
	}

	return height;
}

export function getLayoutCardItemSize(
	showStats = true,
	showTestArea = true,
	analyzer: StatsAnalyzer = 'cmini',
	statsMode: LayoutCardStatsMode = 'detailed'
): number {
	return getLayoutCardHeight(showStats, showTestArea, analyzer, statsMode) + LAYOUT_CARD_ROW_GAP;
}

/** @deprecated Use getLayoutCardItemSize() when card sections may be hidden. */
export const LAYOUT_CARD_ITEM_SIZE = getLayoutCardItemSize();

// Tailwind breakpoint media queries
export const TAILWIND_BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
	'3xl': 1920
} as const;

/** Side-by-side filter rail + results; below this the sidebar stacks (mobile). */
export const LAYOUT_SPLIT_MIN_WIDTH = TAILWIND_BREAKPOINTS.md;
