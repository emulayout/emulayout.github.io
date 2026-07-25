import type { CyanophageStats, Mana2Stats, CminiStats } from '$lib/layout';

/** Keep in sync with FINGERS in bin/cmini-analyzer.js. */
export const FINGER_USAGE_KEYS = [
	'LI',
	'LM',
	'LR',
	'LP',
	'RI',
	'RM',
	'RR',
	'RP',
	'LT',
	'RT',
	'TB'
] as const;

export type FingerUsageKey = (typeof FINGER_USAGE_KEYS)[number];

/** Cyanophage finger usage keys (no TB; thumbs are LT/RT). */
export const CYANOPHAGE_FINGER_STAT_KEYS = FINGER_USAGE_KEYS.filter(
	(finger): finger is Exclude<FingerUsageKey, 'TB'> => finger !== 'TB'
);

export type CyanophageFingerUsageKey = (typeof CYANOPHAGE_FINGER_STAT_KEYS)[number];

export const LEFT_HAND_FINGERS = ['LI', 'LM', 'LR', 'LP'] as const;
export const RIGHT_HAND_FINGERS = ['RI', 'RM', 'RR', 'RP'] as const;

/** Frontend decoder order for arrays emitted by bin/layout-stats.js. */
export const BOT_STAT_KEYS = [
	'alternate',
	'roll-in',
	'roll-out',
	'oneh-in',
	'oneh-out',
	'redirect',
	'bad-redirect',
	'dsfb-red',
	'dsfb-alt',
	'sfb',
	'lh',
	'rh',
	...FINGER_USAGE_KEYS
] as const satisfies readonly (keyof CminiStats)[];

export const STAT_VALUE_SCALE = 10_000;
export const COMPACT_STAT_FIELD_COUNT = BOT_STAT_KEYS.length;

/** Frontend decoder order for arrays emitted by bin/cyanophage-stats.js. */
export const CYANOPHAGE_STAT_KEYS = [
	'total-word-effort',
	'effort',
	'sfb',
	'sfs',
	'scissors',
	'lsb',
	'alternate',
	'roll',
	'redirect',
	'lh',
	'rh',
	...CYANOPHAGE_FINGER_STAT_KEYS
] as const;

export const CYANOPHAGE_STAT_VALUE_SCALE = 10_000;
export const CYANOPHAGE_COMPACT_STAT_FIELD_COUNT = CYANOPHAGE_STAT_KEYS.length;

export type DerivedCyanophageStats = {
	totalWordEffort: number;
	effort: number;
	sfb: number;
	sfs: number;
	scissors: number;
	lsb: number;
	alternate: number;
	roll: number;
	redirect: number;
	lh: number;
	rh: number;
} & Record<CyanophageFingerUsageKey, number>;

export type CyanophageStatSortKey = keyof DerivedCyanophageStats;

/** Frontend decoder order for arrays emitted by bin/mana2-stats.js. */
export const MANA2_STAT_KEYS = [
	'finger-usage-LP',
	'finger-usage-LR',
	'finger-usage-LM',
	'finger-usage-LI',
	'finger-usage-LT',
	'finger-usage-RT',
	'finger-usage-RI',
	'finger-usage-RM',
	'finger-usage-RR',
	'finger-usage-RP',
	'offpinky',
	'sfb',
	'sfbw',
	'skb',
	'lsb',
	'vsb',
	'sfs',
	'sfsw',
	'sks',
	'lss',
	'vss',
	'alt',
	'altnothumbs',
	'altsfs',
	'altsfsnothumbs',
	'redirect',
	'redirectnothumbs',
	'redirectsfs',
	'redirectsfsnothumbs',
	'redirectweak',
	'redirectweaknothumbs',
	'redirectsfsweak',
	'redirectsfsweaknothumbs',
	'roll',
	'rollnothumbs',
	'inroll2',
	'inroll2nothumbs',
	'outroll2',
	'outroll2nothumbs',
	'inroll3',
	'inroll3nothumbs',
	'outroll3',
	'outroll3nothumbs',
	'goodroll',
	'goodrollnothumbs'
] as const;

export type Mana2StatKey = (typeof MANA2_STAT_KEYS)[number];

export const MANA2_STAT_VALUE_SCALE = 10_000;
export const MANA2_COMPACT_STAT_FIELD_COUNT = MANA2_STAT_KEYS.length;

/** Mana2 metrics that are already percentage-points in the JSON (not 0–1 fractions). */
const MANA2_RAW_STAT_KEYS = new Set<Mana2StatKey>(['sfbw', 'sfsw', 'lsb', 'lss', 'vsb', 'vss']);

export type DerivedMana2Stats = {
	sfb: number;
	sfs: number;
	sfbw: number;
	sfsw: number;
	skb: number;
	sks: number;
	lsb: number;
	lss: number;
	vsb: number;
	vss: number;
	alt: number;
	altNoThumbs: number;
	altSfs: number;
	redirect: number;
	redirectNoThumbs: number;
	redirectSfs: number;
	redirectWeak: number;
	redirectSfsWeak: number;
	roll: number;
	rollNoThumbs: number;
	inroll2: number;
	outroll2: number;
	inroll3: number;
	outroll3: number;
	goodroll: number;
	offpinky: number;
	lh: number;
	rh: number;
} & Record<CyanophageFingerUsageKey, number>;

export type Mana2StatSortKey = keyof DerivedMana2Stats;

export type DerivedBotStats = {
	alternate: number;
	roll: number;
	rollIn: number;
	rollOut: number;
	one: number;
	oneIn: number;
	oneOut: number;
	rtl: number;
	rtlIn: number;
	rtlOut: number;
	red: number;
	badRedirect: number;
	sfb: number;
	sfs: number;
	dsfbRed: number;
	dsfbAlt: number;
	lh: number;
	rh: number;
} & Record<FingerUsageKey, number>;

export type StatSortKey = keyof DerivedBotStats;

/** Cache trigram stats are valid when alternate is non-zero (always true for analyzed layouts). */
export function isValidCminiStats(stats: CminiStats): boolean {
	return stats.alternate > 0;
}

export function decodeCminiStats(values: number[]): CminiStats | undefined {
	if (values.length !== COMPACT_STAT_FIELD_COUNT) {
		return undefined;
	}

	const stats = {} as CminiStats;
	for (let i = 0; i < BOT_STAT_KEYS.length; i++) {
		stats[BOT_STAT_KEYS[i]] = values[i] / STAT_VALUE_SCALE;
	}
	return isValidCminiStats(stats) ? stats : undefined;
}

export function deriveBotStats(stats: CminiStats): DerivedBotStats {
	const rollIn = stats['roll-in'];
	const rollOut = stats['roll-out'];
	const oneIn = stats['oneh-in'];
	const oneOut = stats['oneh-out'];

	return {
		alternate: stats.alternate,
		rollIn,
		rollOut,
		roll: rollIn + rollOut,
		oneIn,
		oneOut,
		one: oneIn + oneOut,
		rtlIn: rollIn + oneIn,
		rtlOut: rollOut + oneOut,
		rtl: rollIn + rollOut + oneIn + oneOut,
		badRedirect: stats['bad-redirect'],
		red: stats.redirect + stats['bad-redirect'],
		sfb: stats.sfb,
		dsfbRed: stats['dsfb-red'],
		dsfbAlt: stats['dsfb-alt'],
		sfs: stats['dsfb-red'] + stats['dsfb-alt'],
		lh: stats.lh,
		rh: stats.rh,
		...Object.fromEntries(FINGER_USAGE_KEYS.map((finger) => [finger, stats[finger]]))
	} as DerivedBotStats;
}

export function isValidCyanophageStats(stats: CyanophageStats): boolean {
	return stats['total-word-effort'] > 0;
}

export function decodeCyanophageStats(values: number[]): CyanophageStats | undefined {
	if (values.length !== CYANOPHAGE_COMPACT_STAT_FIELD_COUNT) {
		return undefined;
	}

	const stats = {} as CyanophageStats;
	for (let i = 0; i < CYANOPHAGE_STAT_KEYS.length; i++) {
		stats[CYANOPHAGE_STAT_KEYS[i]] = values[i] / CYANOPHAGE_STAT_VALUE_SCALE;
	}

	return isValidCyanophageStats(stats) ? stats : undefined;
}

export function deriveCyanophageStats(stats: CyanophageStats): DerivedCyanophageStats {
	return {
		totalWordEffort: stats['total-word-effort'],
		effort: stats.effort,
		sfb: stats.sfb,
		sfs: stats.sfs,
		scissors: stats.scissors,
		lsb: stats.lsb,
		alternate: stats.alternate,
		roll: stats.roll,
		redirect: stats.redirect,
		lh: stats.lh,
		rh: stats.rh,
		...Object.fromEntries(CYANOPHAGE_FINGER_STAT_KEYS.map((finger) => [finger, stats[finger]]))
	} as DerivedCyanophageStats;
}

export function isValidMana2Stats(stats: Mana2Stats): boolean {
	return (stats.sfb ?? 0) > 0 || (stats.alt ?? 0) > 0 || (stats.roll ?? 0) > 0;
}

export function decodeMana2Stats(values: number[]): Mana2Stats | undefined {
	if (values.length !== MANA2_COMPACT_STAT_FIELD_COUNT) {
		return undefined;
	}

	const stats = {} as Mana2Stats;
	for (let i = 0; i < MANA2_STAT_KEYS.length; i++) {
		const key = MANA2_STAT_KEYS[i];
		const raw = values[i] / MANA2_STAT_VALUE_SCALE;
		// Mana2 emits percentage-points for most metrics; keep stretch/weights raw.
		stats[key] = MANA2_RAW_STAT_KEYS.has(key) ? raw : raw / 100;
	}

	return isValidMana2Stats(stats) ? stats : undefined;
}

export function deriveMana2Stats(stats: Mana2Stats): DerivedMana2Stats {
	const LP = stats['finger-usage-LP'] ?? 0;
	const LR = stats['finger-usage-LR'] ?? 0;
	const LM = stats['finger-usage-LM'] ?? 0;
	const LI = stats['finger-usage-LI'] ?? 0;
	const LT = stats['finger-usage-LT'] ?? 0;
	const RT = stats['finger-usage-RT'] ?? 0;
	const RI = stats['finger-usage-RI'] ?? 0;
	const RM = stats['finger-usage-RM'] ?? 0;
	const RR = stats['finger-usage-RR'] ?? 0;
	const RP = stats['finger-usage-RP'] ?? 0;

	return {
		sfb: stats.sfb ?? 0,
		sfs: stats.sfs ?? 0,
		sfbw: stats.sfbw ?? 0,
		sfsw: stats.sfsw ?? 0,
		skb: stats.skb ?? 0,
		sks: stats.sks ?? 0,
		lsb: stats.lsb ?? 0,
		lss: stats.lss ?? 0,
		vsb: stats.vsb ?? 0,
		vss: stats.vss ?? 0,
		alt: stats.alt ?? 0,
		altNoThumbs: stats.altnothumbs ?? 0,
		altSfs: stats.altsfs ?? 0,
		redirect: stats.redirect ?? 0,
		redirectNoThumbs: stats.redirectnothumbs ?? 0,
		redirectSfs: stats.redirectsfs ?? 0,
		redirectWeak: stats.redirectweak ?? 0,
		redirectSfsWeak: stats.redirectsfsweak ?? 0,
		roll: stats.roll ?? 0,
		rollNoThumbs: stats.rollnothumbs ?? 0,
		inroll2: stats.inroll2 ?? 0,
		outroll2: stats.outroll2 ?? 0,
		inroll3: stats.inroll3 ?? 0,
		outroll3: stats.outroll3 ?? 0,
		goodroll: stats.goodroll ?? 0,
		offpinky: stats.offpinky ?? 0,
		lh: LP + LR + LM + LI + LT,
		rh: RI + RM + RR + RP + RT,
		LP,
		LR,
		LM,
		LI,
		LT,
		RT,
		RI,
		RM,
		RR,
		RP
	};
}
