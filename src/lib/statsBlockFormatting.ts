/** Line counts used by fixed-height card stat blocks and their loading fallbacks. */
export const STATS_BLOCK_LINE_COUNT = 14;
export const CYANOPHAGE_STATS_BLOCK_LINE_COUNT = 14;
export const MANA2_STATS_BLOCK_LINE_COUNT = 18;

/** Longest Cyanophage stat label, used to align its value column. */
export const CYANOPHAGE_STAT_LABEL_WIDTH = 20;

/** Per-section Mana2 label widths; alignment is intentionally local to each section. */
export const MANA2_PAIR_LABEL_WIDTH = 12;
export const MANA2_FLOW_LABEL_WIDTH = 9;
export const MANA2_HAND_LABEL_WIDTH = 6;

/** Card/stat highlight: analyzer filter colors, or yellow for the active sort field. */
export type StatsHighlightTone = 'cmini' | 'cyanophage' | 'mana2' | 'sort';

export interface StatsBlockSegment {
	text: string;
	/** When set, the value uses the matching highlight color. */
	highlight?: StatsHighlightTone;
	/** Compare-delta tone: improvement or regression for the new layout. */
	tone?: 'better' | 'worse' | 'neutral';
}

export function formatStatPercent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

export function formatStatLabel(label: string, width?: number): string {
	if (width === undefined) {
		return `${label} `;
	}
	return `${label.padStart(width)} `;
}
