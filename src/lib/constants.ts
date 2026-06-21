// LayoutCard dimensions constants
export const LAYOUT_CARD_HEIGHT = 372; // px — full card with stats and test area
export const LAYOUT_CARD_ROW_GAP = 16; // px (mb-4 = 1rem = 16px)
export const LAYOUT_CARD_SECTION_GAP = 12; // px (gap-3 between main sections)
export const LAYOUT_CARD_BOTTOM_SECTION_GAP = 16; // px (gap-4 between stats and test area)
/** Matches `.stats-block` min-height in layout.css (8 × 1.35 × 10px). */
export const LAYOUT_CARD_STATS_HEIGHT = 108;
/** 2-row textarea with px-3 pt-3 pb-0 (bottom inset comes from card pb-3). */
export const LAYOUT_CARD_TEST_AREA_HEIGHT = 56;

export function getLayoutCardHeight(showStats = true, showTestArea = true): number {
	let height = LAYOUT_CARD_HEIGHT;

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
	xl: 1280
} as const;
