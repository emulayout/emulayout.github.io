// LayoutCard dimensions constants
export const LAYOUT_CARD_HEIGHT = 260; // px
export const LAYOUT_CARD_ROW_GAP = 16; // px (mb-4 = 1rem = 16px)
export const LAYOUT_CARD_ITEM_SIZE = LAYOUT_CARD_HEIGHT + LAYOUT_CARD_ROW_GAP; // Total height per row including gap

// Tailwind breakpoint media queries
export const TAILWIND_BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280
} as const;
