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

/** Monkeyracer bot-display stat fields. */
export interface MonkeyracerStats {
	alternate: number;
	'roll-in': number;
	'roll-out': number;
	'oneh-in': number;
	'oneh-out': number;
	redirect: number;
	'bad-redirect': number;
	'dsfb-red': number;
	'dsfb-alt': number;
	sfb: number;
	lh: number;
	rh: number;
	LI: number;
	LM: number;
	LR: number;
	LP: number;
	RI: number;
	RM: number;
	RR: number;
	RP: number;
	LT: number;
	RT: number;
	TB: number;
}

/**
 * Compact stats: fixed-point values (×10_000) in bot stat key order.
 * @see BOT_STAT_KEYS in layoutStats.ts
 */
export type CompactLayoutStats = number[];

/** Layout stats keyed by layout name. Loaded from /layout-stats.json. */
export type LayoutStatsMap = Record<string, CompactLayoutStats>;

/** Cyanophage tier-1 stats: total word effort and effort. */
export interface CyanophageStats {
	'total-word-effort': number;
	effort: number;
}

/**
 * Compact cyanophage stats: fixed-point values (×10_000) in CYANOPHAGE_STAT_KEYS order.
 * @see CYANOPHAGE_STAT_KEYS in layoutStats.ts
 */
export type CompactCyanophageStats = [number, number];

/** Layout stats keyed by layout name. Loaded from /layout-stats-cyanophage.json. */
export type CyanophageStatsMap = Record<string, CompactCyanophageStats>;

/** Loaded stat payloads keyed by analyzer id. */
export type StatsMaps = Partial<{
	monkeyracer: LayoutStatsMap;
	cyanophage: CyanophageStatsMap;
}>;
