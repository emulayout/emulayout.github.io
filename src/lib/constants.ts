// LayoutCard dimensions constants
/** Action toolbar between layout display and stats (`.card-action-divider`). */
export const LAYOUT_CARD_ACTION_BAR_HEIGHT = 40;
export const LAYOUT_CARD_HEIGHT = 524; // px — compact padding vs prior 548
/** Min height for layout display area (~4.5 rows × 14px × 1.5 line-height). */
export const LAYOUT_DISPLAY_MIN_HEIGHT = 94;
export const LAYOUT_CARD_ROW_GAP = 12; // px (mb-3 = 0.75rem = 12px)
export const LAYOUT_CARD_SECTION_GAP = 8; // px (gap-2 between main sections)
export const LAYOUT_CARD_BOTTOM_SECTION_GAP = 12; // px (gap-3 between stats and test area)
/** Matches `.stats-block` min-height in layout.css (14 × 1.35 × 11px). */
export const LAYOUT_CARD_STATS_HEIGHT = 208;
/** Caption above each stats block when both analyzers are shown. */
export const LAYOUT_CARD_STATS_LABEL_HEIGHT = 20;
/** Gap between stacked analyzer stats blocks. */
export const LAYOUT_CARD_STATS_STACK_GAP = 12;
/**
 * Extra height beyond the single stats block already in {@link LAYOUT_CARD_HEIGHT}
 * when showing both analyzers (second block + both labels + stack gap).
 */
export const LAYOUT_CARD_DUAL_STATS_EXTRA =
	LAYOUT_CARD_STATS_HEIGHT +
	LAYOUT_CARD_STATS_LABEL_HEIGHT * 2 +
	LAYOUT_CARD_STATS_STACK_GAP;
/**
 * Extra height when showing Mana2’s taller stats block (18 lines vs the default 14).
 * Keep in sync with MANA2_STATS_BLOCK_LINE_COUNT in layoutStats.ts.
 */
export const LAYOUT_CARD_MANA2_STATS_EXTRA = 60;
/** 2-row textarea with px-3 pt-3 pb-0 (bottom inset comes from card pb-2). */
export const LAYOUT_CARD_TEST_AREA_HEIGHT = 56;

export function getLayoutCardHeight(
	showStats = true,
	showTestArea = true,
	dualStats = false,
	mana2Stats = false
): number {
	let height = LAYOUT_CARD_HEIGHT;

	if (showStats && dualStats) {
		height += LAYOUT_CARD_DUAL_STATS_EXTRA;
	} else if (showStats && mana2Stats) {
		height += LAYOUT_CARD_MANA2_STATS_EXTRA;
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
	dualStats = false,
	mana2Stats = false
): number {
	return getLayoutCardHeight(showStats, showTestArea, dualStats, mana2Stats) + LAYOUT_CARD_ROW_GAP;
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

/** Side-by-side filter rail + results; below this the sidebar stacks (mobile/medium). */
export const LAYOUT_SPLIT_MIN_WIDTH = TAILWIND_BREAKPOINTS.lg;
