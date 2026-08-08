export interface KeyInfo {
	row: number;
	col: number;
	/** Left or right thumb (row 3+ only), from cmini finger when available. */
	thumbHand?: 'l' | 'r';
}

export type BoardType = 'angle' | 'stagger' | 'ortho' | 'mini';

/** Thumb key on one hand, sorted left-to-right by column. */
export interface ThumbKeyEntry {
	key: string;
	col: number;
}

export interface LayoutData {
	name: string;
	user: number;
	board: BoardType;
	keys: Record<string, KeyInfo>;
	/** `"row,col"` → key character for O(1) position lookups. */
	positionBySlot: Map<string, string>;
	/** Pre-sorted thumb keys per hand (lowercase key chars). */
	thumbKeysByHand: { l: ThumbKeyEntry[]; r: ThumbKeyEntry[] };
	hasThumbKeys: boolean;
	characterSet: 'english' | 'international';
	hasAllLetters: boolean;
	hasMagicKey: boolean;
	/** The layout contains an unclaimed `@`, which repeats the previous character by default. */
	hasRepeatKey: boolean;
	/** A curated profile is available in the separately loaded mappings payload. */
	hasMagicKeyMappings: boolean;
	/** The default Magic profile cannot currently be modeled by Cyanophage. */
	cyanophageStatsNeedMagicMappings: boolean;
	/** The layout is known to use adaptive swaps, whether or not mappings are available. */
	hasAdaptiveSwap: boolean;
	/** Curated adaptive-swap mappings are available in the input-behavior payload. */
	hasAdaptiveSwapMappings: boolean;
	cyanophageCompatible: boolean;
	/** Set when the layout has exactly one thumb key (cyanophage playground). */
	cyanophageThumb?: 'l' | 'r';
	updatedAt: string;
}

/** Cmini bot-display stat fields. */
export interface CminiStats {
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
 * @see BOT_STAT_KEYS in statsDerivation.ts
 */
export type CompactLayoutStats = number[];

/** Layout stats keyed by layout name. Loaded from /layout-stats-cmini-{corpus}.json. */
export type LayoutStatsMap = Record<string, CompactLayoutStats>;
export type LayoutLikesMap = Record<string, number>;

/** Cyanophage stats keyed by CYANOPHAGE_STAT_KEYS in statsDerivation.ts. */
export interface CyanophageStats {
	'total-word-effort': number;
	effort: number;
	distance: number;
	sfb: number;
	sfs: number;
	scissors: number;
	lsb: number;
	alternate: number;
	'alt-sfs': number;
	roll: number;
	'roll-in': number;
	'roll-out': number;
	'roll-in-2': number;
	'roll-out-2': number;
	'roll-in-3': number;
	'roll-out-3': number;
	redirect: number;
	'redirect-weak': number;
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
	'distance-LI': number;
	'distance-LM': number;
	'distance-LR': number;
	'distance-LP': number;
	'distance-RI': number;
	'distance-RM': number;
	'distance-RR': number;
	'distance-RP': number;
	'distance-LT': number;
	'distance-RT': number;
}

/**
 * Compact cyanophage stats: fixed-point values (×10_000) in CYANOPHAGE_STAT_KEYS order.
 * @see CYANOPHAGE_STAT_KEYS in statsDerivation.ts
 */
export type CompactCyanophageStats = number[];

/** Layout stats keyed by layout name. Loaded from /layout-stats-cyanophage.json. */
export type CyanophageStatsMap = Record<string, CompactCyanophageStats>;

/**
 * Mana2 stats keyed by MANA2_STAT_KEYS in statsDerivation.ts.
 * Percentage metrics are stored as 0–1 fractions after decode; stretch/scissor/weights stay raw.
 */
export type Mana2Stats = Record<string, number>;

/**
 * Compact mana2 stats: fixed-point values (×10_000) in MANA2_STAT_KEYS order.
 * @see MANA2_STAT_KEYS in statsDerivation.ts
 */
export type CompactMana2Stats = number[];

/** Layout stats keyed by layout name. Loaded from /layout-stats-mana2-{corpus}-{board}-{space}.json. */
export type Mana2StatsMap = Record<string, CompactMana2Stats>;

/** Loaded stat payloads keyed by analyzer id. */
export type StatsMaps = Partial<{
	cmini: LayoutStatsMap;
	cyanophage: CyanophageStatsMap;
	mana2: Mana2StatsMap;
}>;
