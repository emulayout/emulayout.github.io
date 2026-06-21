export interface KeyInfo {
	row: number;
	col: number;
}

export type BoardType = 'angle' | 'stagger' | 'ortho' | 'mini';

export interface LayoutData {
	name: string;
	user: number;
	board: BoardType;
	keys: Record<string, KeyInfo>;
	hasThumbKeys: boolean;
	displayValue: string;
	characterSet: 'english' | 'international';
	hasAllLetters: boolean;
	hasMagicKey: boolean;
	updatedAt: string;
}

/** Bot-display stat fields for one corpus (from cmini cache). */
export interface LayoutCorpusStats {
	alternate: number;
	'roll-in': number;
	'roll-out': number;
	'oneh-in': number;
	'oneh-out': number;
	redirect: number;
	'bad-redirect': number;
	'dsfb-red': number;
	'dsfb-alt': number;
}

/** All corpora stats for one layout, keyed by corpus name. */
export type LayoutStats = Record<string, LayoutCorpusStats>;

/** Layout stats keyed by layout name (monkeyracer corpus). Loaded from /layout-stats.json. */
export type LayoutStatsMap = Record<string, LayoutCorpusStats>;
