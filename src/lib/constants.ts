// LayoutCard dimensions constants
export const LAYOUT_CARD_ROW_GAP = 12; // px (mb-3 = 0.75rem = 12px)
export const LAYOUT_CARD_BOTTOM_SECTION_GAP = 12; // px (gap-3 between stats and test area)
/** 2-row textarea with px-3 pt-3 pb-0 (bottom inset comes from card pb-2). */
export const LAYOUT_CARD_TEST_AREA_HEIGHT = 56;
/** Shared height of the visual finger-usage chart in Highlights. */
export const FINGER_USAGE_BARS_HEIGHT = 103;

/** Two 44px metric rows, 16px chart gap, and the 103px finger chart. */
const HIGHLIGHTS_STATS_HEIGHT = 2 * 44 + 16 + FINGER_USAGE_BARS_HEIGHT;
/** Compact card height with Highlights stats and the test area visible. */
const HIGHLIGHTS_CARD_HEIGHT = 501.2;
/** Existing compact heights when card stats are hidden. */
const TEST_AREA_ONLY_CARD_HEIGHT = 304;
const BARE_CARD_HEIGHT = 252;
export const LAYOUT_CARD_HEIGHT = HIGHLIGHTS_CARD_HEIGHT;

export function getLayoutCardStatsHeight(): number {
	return HIGHLIGHTS_STATS_HEIGHT;
}

export function getLayoutCardHeight(showStats = true, showTestArea = true): number {
	if (!showStats) {
		return showTestArea ? TEST_AREA_ONLY_CARD_HEIGHT : BARE_CARD_HEIGHT;
	}

	let height = HIGHLIGHTS_CARD_HEIGHT;
	if (!showTestArea) {
		height -= LAYOUT_CARD_TEST_AREA_HEIGHT + LAYOUT_CARD_BOTTOM_SECTION_GAP;
	}

	return height;
}

export function getLayoutCardItemSize(showStats = true, showTestArea = true): number {
	return getLayoutCardHeight(showStats, showTestArea) + LAYOUT_CARD_ROW_GAP;
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
