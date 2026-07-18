import type { CyanophageStats, MonkeyracerStats, LayoutData, StatsMaps } from '$lib/layout';

/** Default analyzer for layout stats (matches common cmini bot preference). */
export const DEFAULT_STATS_ANALYZER = 'monkeyracer';

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Display both analyzers’ stats on cards. */
export const ALL_STATS_ANALYZERS_MODE = 'all';

/** Concrete analyzers that own a stats JSON map. */
export const STAT_ANALYZERS = [
	{ value: DEFAULT_STATS_ANALYZER, label: 'cmini (monkeyracer)' },
	{ value: CYANOPHAGE_ANALYZER, label: 'Cyanophage' }
] as const;

export type StatsAnalyzer = (typeof STAT_ANALYZERS)[number]['value'];

/** Toolbar / URL display modes (includes stacked “All”). */
export const STAT_ANALYZER_MODES = [
	{ value: ALL_STATS_ANALYZERS_MODE, label: 'All' },
	...STAT_ANALYZERS
] as const;

export type StatsAnalyzerMode = (typeof STAT_ANALYZER_MODES)[number]['value'];

const STATS_ANALYZER_VALUES = new Set<string>(STAT_ANALYZERS.map((analyzer) => analyzer.value));
const STATS_ANALYZER_MODE_VALUES = new Set<string>(
	STAT_ANALYZER_MODES.map((analyzer) => analyzer.value)
);

export function isStatsAnalyzer(value: string): value is StatsAnalyzer {
	return STATS_ANALYZER_VALUES.has(value);
}

export function isStatsAnalyzerMode(value: string): value is StatsAnalyzerMode {
	return STATS_ANALYZER_MODE_VALUES.has(value);
}

/** Concrete analyzers included in a display mode. */
export function resolveStatsAnalyzers(mode: StatsAnalyzerMode): StatsAnalyzer[] {
	return mode === ALL_STATS_ANALYZERS_MODE
		? [DEFAULT_STATS_ANALYZER, CYANOPHAGE_ANALYZER]
		: [mode];
}

export function showsMonkeyracerStats(mode: StatsAnalyzerMode): boolean {
	return mode === ALL_STATS_ANALYZERS_MODE || mode === DEFAULT_STATS_ANALYZER;
}

export function showsCyanophageStats(mode: StatsAnalyzerMode): boolean {
	return mode === ALL_STATS_ANALYZERS_MODE || mode === CYANOPHAGE_ANALYZER;
}

/** Disambiguate legacy sort tokens; `all` behaves like the default analyzer. */
export function concreteAnalyzerForSort(mode: StatsAnalyzerMode): StatsAnalyzer {
	return mode === ALL_STATS_ANALYZERS_MODE ? DEFAULT_STATS_ANALYZER : mode;
}

/** Keep in sync with FINGERS in bin/cmini-analyzer.js */
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

/** Keep in sync with BOT_STAT_KEYS in bin/layout-stats.js. */
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
] as const satisfies readonly (keyof MonkeyracerStats)[];

export const STAT_VALUE_SCALE = 10_000;
export const COMPACT_STAT_FIELD_COUNT = BOT_STAT_KEYS.length;

/** Keep in sync with CYANOPHAGE_STAT_KEYS in bin/cyanophage-stats.js. */
export const CYANOPHAGE_STAT_KEYS = [
	'total-word-effort',
	'effort',
	'sfb',
	'sfs',
	'scissors',
	'lsb',
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
	lh: number;
	rh: number;
} & Record<CyanophageFingerUsageKey, number>;

export type CyanophageStatSortKey = keyof DerivedCyanophageStats;

/**
 * Prefixed cyanophage filter keys (storage/URL) so limits never collide with cmini.
 * Map to derived stats via {@link StatFilterField.statKey}.
 */
export type CyanoStatLimitKey =
	| 'cyano-sfb'
	| 'cyano-sfs'
	| 'cyano-lh'
	| 'cyano-rh'
	| 'cyano-LI'
	| 'cyano-LM'
	| 'cyano-LR'
	| 'cyano-LP'
	| 'cyano-LT'
	| 'cyano-RI'
	| 'cyano-RM'
	| 'cyano-RR'
	| 'cyano-RP'
	| 'cyano-RT';

/** @deprecated Use {@link CyanoStatLimitKey}. */
export type CyanoHandStatLimitKey = Exclude<CyanoStatLimitKey, 'cyano-sfb' | 'cyano-sfs'>;

/** Keys usable in stat limit filters (union of both analyzers). */
export type StatLimitKey = StatSortKey | CyanophageStatSortKey | CyanoStatLimitKey | 'likes';

export const CYANOPHAGE_STATS_BLOCK_LINE_COUNT = 14;

/** Longest cyanophage stat label in `buildCyanophageStatsBlockLines` (for value column alignment). */
const CYANOPHAGE_STAT_LABEL_WIDTH = 20;

/** Cache trigram stats are valid when alternate is non-zero (always true for analyzed layouts). */
export function isValidMonkeyracerStats(stats: MonkeyracerStats): boolean {
	return stats.alternate > 0;
}

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

export type SortOrder = 'asc' | 'desc';

export interface StatSortField {
	value: string;
	label: string;
	key: StatSortKey | CyanophageStatSortKey;
	analyzer: StatsAnalyzer;
	/** Default Order when this Sort-by field is selected. */
	defaultOrder: SortOrder;
	/**
	 * Whether higher values are better for compare highlighting.
	 * `null` = balance metric (not ranked higher/lower).
	 */
	higherIsBetter: boolean | null;
}

/** Sortable cyanophage stats — values are `cyano-*` so they never collide with cmini. */
export const CYANOPHAGE_STAT_SORT_FIELDS = [
	{
		value: 'cyano-total-word-effort',
		label: 'Total Word Effort',
		key: 'totalWordEffort',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-effort',
		label: 'Effort',
		key: 'effort',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-sfb',
		label: 'Same Finger Bigrams',
		key: 'sfb',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-sfs',
		label: 'Skip Bigrams',
		key: 'sfs',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-scissors',
		label: 'Scissors',
		key: 'scissors',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-lsb',
		label: 'Lat Stretch Bigrams',
		key: 'lsb',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-lh',
		label: 'Left hand',
		key: 'lh',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	},
	{
		value: 'cyano-rh',
		label: 'Right hand',
		key: 'rh',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	}
] as const satisfies readonly StatSortField[];

/** Sortable bot stats (cmini / monkeyracer). */
export const STAT_SORT_FIELDS = [
	{
		value: 'alternate',
		label: 'Alternate',
		key: 'alternate',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll',
		label: 'Roll',
		key: 'roll',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-in',
		label: 'Roll in',
		key: 'rollIn',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-out',
		label: 'Roll out',
		key: 'rollOut',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'one',
		label: 'One-hand',
		key: 'one',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'one-in',
		label: 'One-hand in',
		key: 'oneIn',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'one-out',
		label: 'One-hand out',
		key: 'oneOut',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-total',
		label: 'Roll total',
		key: 'rtl',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-total-in',
		label: 'Roll total in',
		key: 'rtlIn',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-total-out',
		label: 'Roll total out',
		key: 'rtlOut',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'redirect',
		label: 'Redirect',
		key: 'red',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'bad-redirect',
		label: 'Bad redirect',
		key: 'badRedirect',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'sfb',
		label: 'Same-finger bigrams',
		key: 'sfb',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'same-finger-skip',
		label: 'Same-finger skip',
		key: 'sfs',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'same-finger-skip-redirect',
		label: 'Same-finger skip redirect',
		key: 'dsfbRed',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'same-finger-skip-alternate',
		label: 'Same-finger skip alternate',
		key: 'dsfbAlt',
		analyzer: DEFAULT_STATS_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	}
] as const satisfies readonly StatSortField[];

const ALL_STAT_SORT_FIELDS = [...STAT_SORT_FIELDS, ...CYANOPHAGE_STAT_SORT_FIELDS] as const;

export interface StatFilterField {
	key: StatLimitKey;
	label: string;
	/** Longer name for tooltips and aria labels when `label` is abbreviated. */
	title?: string;
	/** How filter input values are interpreted. Defaults to percent (0–100). */
	unit?: 'percent' | 'raw';
	/**
	 * Property on derived analyzer stats used for comparison.
	 * Defaults to `key` when the storage key matches the stats property.
	 */
	statKey?: StatSortKey | CyanophageStatSortKey;
}

export const LIKES_STAT_FILTER_FIELD = {
	key: 'likes',
	label: 'Likes',
	title: 'Likes',
	unit: 'raw'
} as const satisfies StatFilterField;

/** Max related stats per general-stat row (matches layout card group width). */
export const GENERAL_STAT_FILTER_COLUMN_COUNT = 3;

/**
 * General stat limits in card-style rows: one row per stat group,
 * up to three columns for related stats (empty cells omitted at render time).
 */
export const MONKEY_GENERAL_STAT_FILTER_ROWS: readonly (readonly StatFilterField[])[] = [
	[{ key: 'alternate', label: 'Alt' }],
	[
		{ key: 'roll', label: 'Rol' },
		{ key: 'rollIn', label: 'In', title: 'Roll in' },
		{ key: 'rollOut', label: 'Out', title: 'Roll out' }
	],
	[
		{ key: 'one', label: 'One' },
		{ key: 'oneIn', label: 'In', title: 'One-hand in' },
		{ key: 'oneOut', label: 'Out', title: 'One-hand out' }
	],
	[
		{ key: 'rtl', label: 'Rtl' },
		{ key: 'rtlIn', label: 'In', title: 'Roll total in' },
		{ key: 'rtlOut', label: 'Out', title: 'Roll total out' }
	],
	[
		{ key: 'red', label: 'Red' },
		{ key: 'badRedirect', label: 'Bad', title: 'Bad redirect' }
	],
	[{ key: 'sfb', label: 'SFB' }],
	[
		{ key: 'sfs', label: 'SFS' },
		{ key: 'dsfbRed', label: 'Red', title: 'Same-finger skip redirect' },
		{ key: 'dsfbAlt', label: 'Alt', title: 'Same-finger skip alternate' }
	]
];

/** Cyanophage general stat filter rows (one row per stats-card line). */
export const CYANOPHAGE_GENERAL_STAT_FILTER_ROWS: readonly (readonly StatFilterField[])[] = [
	[{ key: 'totalWordEffort', label: 'TWE', title: 'Total Word Effort', unit: 'raw' }],
	[{ key: 'effort', label: 'Effort', title: 'Effort', unit: 'raw' }],
	[{ key: 'cyano-sfb', statKey: 'sfb', label: 'SFB', title: 'Same Finger Bigrams' }],
	[{ key: 'cyano-sfs', statKey: 'sfs', label: 'SFS', title: 'Skip Bigrams' }],
	[{ key: 'lsb', label: 'LSB', title: 'Lat Stretch Bigrams' }],
	[{ key: 'scissors', label: 'Sci', title: 'Scissors' }]
];

/** @deprecated Use MONKEY_GENERAL_STAT_FILTER_ROWS or getGeneralStatFilterRowsForAnalyzer */
export const GENERAL_STAT_FILTER_ROWS = MONKEY_GENERAL_STAT_FILTER_ROWS;

/** Flat list of monkey general stat filter fields. */
export const MONKEY_GENERAL_STAT_FILTER_FIELDS = MONKEY_GENERAL_STAT_FILTER_ROWS.flat();

/** Flat list of cyanophage general stat filter fields. */
export const CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS = CYANOPHAGE_GENERAL_STAT_FILTER_ROWS.flat();

/** Flat list of general stat filter fields — keep in sync with filterStore. */
export const GENERAL_STAT_FILTER_FIELDS = MONKEY_GENERAL_STAT_FILTER_FIELDS;

export const MONKEY_LEFT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'lh', label: 'Hand' },
	{ key: 'LI', label: 'Index' },
	{ key: 'LM', label: 'Middle' },
	{ key: 'LR', label: 'Ring' },
	{ key: 'LP', label: 'Pinky' },
	{ key: 'LT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

export const MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'rh', label: 'Hand' },
	{ key: 'RI', label: 'Index' },
	{ key: 'RM', label: 'Middle' },
	{ key: 'RR', label: 'Ring' },
	{ key: 'RP', label: 'Pinky' },
	{ key: 'RT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

/** Cyanophage hand filters use `cyano-*` keys so limits can differ from cmini. */
export const CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'cyano-lh', statKey: 'lh', label: 'Hand' },
	{ key: 'cyano-LI', statKey: 'LI', label: 'Index' },
	{ key: 'cyano-LM', statKey: 'LM', label: 'Middle' },
	{ key: 'cyano-LR', statKey: 'LR', label: 'Ring' },
	{ key: 'cyano-LP', statKey: 'LP', label: 'Pinky' },
	{ key: 'cyano-LT', statKey: 'LT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

export const CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'cyano-rh', statKey: 'rh', label: 'Hand' },
	{ key: 'cyano-RI', statKey: 'RI', label: 'Index' },
	{ key: 'cyano-RM', statKey: 'RM', label: 'Middle' },
	{ key: 'cyano-RR', statKey: 'RR', label: 'Ring' },
	{ key: 'cyano-RP', statKey: 'RP', label: 'Pinky' },
	{ key: 'cyano-RT', statKey: 'RT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

/** @deprecated Use MONKEY_LEFT_HAND_STAT_FILTER_FIELDS or getLeftHandStatFilterFieldsForAnalyzer */
export const LEFT_HAND_STAT_FILTER_FIELDS = MONKEY_LEFT_HAND_STAT_FILTER_FIELDS;

/** @deprecated Use MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS or getRightHandStatFilterFieldsForAnalyzer */
export const RIGHT_HAND_STAT_FILTER_FIELDS = MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS;

function uniqueStatFilterFields(fields: readonly StatFilterField[]): StatFilterField[] {
	const byKey = new Map<string, StatFilterField>();
	for (const field of fields) {
		if (!byKey.has(field.key)) byKey.set(field.key, field);
	}
	return [...byKey.values()];
}

/** All stat limit keys (both analyzers) — used for URL state and empty limit records. */
export const ALL_STAT_FILTER_FIELDS = uniqueStatFilterFields([
	...MONKEY_GENERAL_STAT_FILTER_FIELDS,
	...CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS,
	...MONKEY_LEFT_HAND_STAT_FILTER_FIELDS,
	...MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS,
	...CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS,
	...CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS,
	LIKES_STAT_FILTER_FIELD
]);

/** @deprecated Use ALL_STAT_FILTER_FIELDS or getStatFilterFieldsForAnalyzer */
export const STAT_FILTER_FIELDS = ALL_STAT_FILTER_FIELDS;

export function getGeneralStatFilterRowsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly (readonly StatFilterField[])[] {
	return analyzer === CYANOPHAGE_ANALYZER
		? CYANOPHAGE_GENERAL_STAT_FILTER_ROWS
		: MONKEY_GENERAL_STAT_FILTER_ROWS;
}

export function getLeftHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return analyzer === CYANOPHAGE_ANALYZER
		? CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS
		: MONKEY_LEFT_HAND_STAT_FILTER_FIELDS;
}

export function getRightHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return analyzer === CYANOPHAGE_ANALYZER
		? CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS
		: MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS;
}

/** Flat hand+finger fields — stable references (no per-call alloc). */
const MONKEY_HAND_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...MONKEY_LEFT_HAND_STAT_FILTER_FIELDS,
	...MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS
];

const CYANOPHAGE_HAND_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS,
	...CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS
];

/** Full filter fields per analyzer — stable references for hot filter paths. */
const MONKEY_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...MONKEY_GENERAL_STAT_FILTER_FIELDS,
	...MONKEY_HAND_STAT_FILTER_FIELDS
];

const CYANOPHAGE_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS,
	...CYANOPHAGE_HAND_STAT_FILTER_FIELDS
];

export function getHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return analyzer === CYANOPHAGE_ANALYZER
		? CYANOPHAGE_HAND_STAT_FILTER_FIELDS
		: MONKEY_HAND_STAT_FILTER_FIELDS;
}

export function getStatFilterFieldsForAnalyzer(analyzer: StatsAnalyzer): readonly StatFilterField[] {
	return analyzer === CYANOPHAGE_ANALYZER
		? CYANOPHAGE_STAT_FILTER_FIELDS
		: MONKEY_STAT_FILTER_FIELDS;
}

/** Resolve the derived-stats property for a filter field. */
export function getStatFilterStatKey(
	field: StatFilterField
): StatSortKey | CyanophageStatSortKey | 'likes' {
	if (field.key === 'likes') return 'likes';
	return field.statKey ?? (field.key as StatSortKey | CyanophageStatSortKey);
}

/** Parse a stat filter input value for comparison against stored stats. */
export function parseStatFilterThreshold(field: StatFilterField, value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed)) return null;
	return field.unit === 'raw' ? parsed : parsed / 100;
}

export type StatSortBy = (typeof ALL_STAT_SORT_FIELDS)[number]['value'];

export type LayoutSortBy = 'name' | 'date' | 'likes' | 'similarity';

export type SortBy = LayoutSortBy | StatSortBy;

const STAT_SORT_FIELD_BY_VALUE = new Map<string, StatSortField>(
	ALL_STAT_SORT_FIELDS.map((field) => [field.value, field])
);

const SORT_BY_VALUES = new Set<string>([
	'name',
	'date',
	'likes',
	'similarity',
	...ALL_STAT_SORT_FIELDS.map((field) => field.value)
]);

/** Layout-level Sort-by defaults (not tied to a StatSortField). */
const LAYOUT_DEFAULT_SORT_ORDER: Record<LayoutSortBy, SortOrder> = {
	name: 'asc',
	date: 'desc',
	likes: 'desc',
	similarity: 'desc'
};

/**
 * Pre-`cyano-*` URL values and other renames → current SortBy.
 * Ambiguous `sfb` is handled in {@link normalizeSortBy}.
 */
const SORT_BY_ALIASES: Record<string, SortBy> = {
	'total-word-effort': 'cyano-total-word-effort',
	effort: 'cyano-effort',
	sfs: 'cyano-sfs',
	scissors: 'cyano-scissors',
	lsb: 'cyano-lsb',
	lh: 'cyano-lh',
	rh: 'cyano-rh'
};

const LEGACY_SORT_BY_ORDER: Record<string, { sortBy: SortBy; sortOrder: SortOrder }> = {
	name: { sortBy: 'name', sortOrder: 'asc' },
	'date-asc': { sortBy: 'date', sortOrder: 'asc' },
	'date-desc': { sortBy: 'date', sortOrder: 'desc' },
	'likes-desc': { sortBy: 'likes', sortOrder: 'desc' },
	'alternate-desc': { sortBy: 'alternate', sortOrder: 'desc' },
	'roll-desc': { sortBy: 'roll', sortOrder: 'desc' },
	'roll-in-desc': { sortBy: 'roll-in', sortOrder: 'desc' },
	'roll-out-desc': { sortBy: 'roll-out', sortOrder: 'desc' },
	'one-desc': { sortBy: 'one', sortOrder: 'desc' },
	'one-in-desc': { sortBy: 'one-in', sortOrder: 'desc' },
	'one-out-desc': { sortBy: 'one-out', sortOrder: 'desc' },
	'rtl-desc': { sortBy: 'roll-total', sortOrder: 'desc' },
	'rtl-in-desc': { sortBy: 'roll-total-in', sortOrder: 'desc' },
	'rtl-out-desc': { sortBy: 'roll-total-out', sortOrder: 'desc' },
	'red-asc': { sortBy: 'redirect', sortOrder: 'asc' },
	'bad-redirect-asc': { sortBy: 'bad-redirect', sortOrder: 'asc' },
	'sfb-asc': { sortBy: 'sfb', sortOrder: 'asc' },
	'sfs-asc': { sortBy: 'same-finger-skip', sortOrder: 'asc' },
	'dsfb-red-asc': { sortBy: 'same-finger-skip-redirect', sortOrder: 'asc' },
	'dsfb-alt-asc': { sortBy: 'same-finger-skip-alternate', sortOrder: 'asc' }
};

export function isSortBy(value: string): value is SortBy {
	return SORT_BY_VALUES.has(value);
}

export function isSortOrder(value: string): value is SortOrder {
	return value === 'asc' || value === 'desc';
}

/**
 * Default Order for a Sort-by field.
 * Prefer {@link StatSortField.defaultOrder} for stats; layout fields use fixed defaults.
 */
export function getDefaultSortOrder(sortBy: SortBy): SortOrder {
	const statField = STAT_SORT_FIELD_BY_VALUE.get(sortBy);
	if (statField) return statField.defaultOrder;
	if (sortBy in LAYOUT_DEFAULT_SORT_ORDER) {
		return LAYOUT_DEFAULT_SORT_ORDER[sortBy as LayoutSortBy];
	}
	return 'asc';
}

export function isStatSortBy(sortBy: SortBy): sortBy is StatSortBy {
	return STAT_SORT_FIELD_BY_VALUE.has(sortBy);
}

/**
 * Resolve a sort field. Values are unique per analyzer (Cyanophage uses `cyano-*`).
 * Pass `analyzer` to require a match for that analyzer.
 */
export function getStatSortField(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatSortField | undefined {
	const field = STAT_SORT_FIELD_BY_VALUE.get(sortBy);
	if (!field) return undefined;
	if (analyzer && field.analyzer !== analyzer) return undefined;
	return field;
}

export function getStatSortAnalyzer(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatsAnalyzer | undefined {
	return getStatSortField(sortBy, analyzer)?.analyzer ?? getStatSortField(sortBy)?.analyzer;
}

export function getStatSortFieldsForAnalyzer(analyzer: StatsAnalyzer): readonly StatSortField[] {
	return ALL_STAT_SORT_FIELDS.filter((field) => field.analyzer === analyzer);
}

export function getStatSortFieldsForMode(mode: StatsAnalyzerMode): readonly StatSortField[] {
	if (mode === ALL_STATS_ANALYZERS_MODE) return ALL_STAT_SORT_FIELDS;
	return getStatSortFieldsForAnalyzer(mode);
}

export function isStatSortByForAnalyzer(sortBy: SortBy, analyzer: StatsAnalyzer): boolean {
	return getStatSortField(sortBy, analyzer) !== undefined;
}

/**
 * Map a Sort-by to the equivalent field on another analyzer (same underlying `key`),
 * or `null` if there is no counterpart.
 */
export function coerceSortByForAnalyzer(sortBy: SortBy, analyzer: StatsAnalyzer): SortBy | null {
	if (!isStatSortBy(sortBy)) return sortBy;
	if (isStatSortByForAnalyzer(sortBy, analyzer)) return sortBy;
	const current = STAT_SORT_FIELD_BY_VALUE.get(sortBy);
	if (!current) return null;
	const match = ALL_STAT_SORT_FIELDS.find(
		(field) => field.analyzer === analyzer && field.key === current.key
	);
	return match ? (match.value as SortBy) : null;
}

/**
 * Normalize a URL/query sort token to a current {@link SortBy}.
 * Handles legacy combo params, pre-`cyano-*` values, and analyzer-disambiguated `sfb`.
 */
export function normalizeSortBy(
	sort: string,
	analyzer: StatsAnalyzerMode = DEFAULT_STATS_ANALYZER
): SortBy | undefined {
	const legacy = parseLegacySortParam(sort);
	if (legacy) return legacy.sortBy;

	if (sort === 'sfb') {
		return concreteAnalyzerForSort(analyzer) === CYANOPHAGE_ANALYZER ? 'cyano-sfb' : 'sfb';
	}

	const aliased = SORT_BY_ALIASES[sort];
	if (aliased) return aliased;

	if (isSortBy(sort)) return sort;
	return undefined;
}

export function parseLegacySortParam(
	sort: string
): { sortBy: SortBy; sortOrder: SortOrder } | undefined {
	if (sort in LEGACY_SORT_BY_ORDER) {
		return LEGACY_SORT_BY_ORDER[sort];
	}
	return undefined;
}

export function decodeMonkeyracerStats(values: number[]): MonkeyracerStats | undefined {
	if (values.length !== COMPACT_STAT_FIELD_COUNT) {
		return undefined;
	}

	const stats = {} as MonkeyracerStats;
	for (let i = 0; i < BOT_STAT_KEYS.length; i++) {
		stats[BOT_STAT_KEYS[i]] = values[i] / STAT_VALUE_SCALE;
	}
	return isValidMonkeyracerStats(stats) ? stats : undefined;
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
		lh: stats.lh,
		rh: stats.rh,
		...Object.fromEntries(
			CYANOPHAGE_FINGER_STAT_KEYS.map((finger) => [finger, stats[finger]])
		)
	} as DerivedCyanophageStats;
}

export function getLayoutCyanophageStats(
	statsMaps: StatsMaps,
	layoutName: string
): CyanophageStats | undefined {
	const encoded = statsMaps.cyanophage?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeCyanophageStats(encoded);
}

export function getLayoutAnalyzerStats(
	statsMaps: StatsMaps,
	layoutName: string,
	analyzer: StatsAnalyzer = DEFAULT_STATS_ANALYZER,
	cyanophageCompatible = true
): MonkeyracerStats | CyanophageStats | undefined {
	if (analyzer === CYANOPHAGE_ANALYZER) {
		if (!cyanophageCompatible) return undefined;
		return getLayoutCyanophageStats(statsMaps, layoutName);
	}

	const encoded = statsMaps.monkeyracer?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeMonkeyracerStats(encoded);
}

export function isAnalyzerStatsReady(statsMaps: StatsMaps, analyzer: StatsAnalyzer): boolean {
	return statsMaps[analyzer] !== undefined;
}

export function getStatSortValue(
	statsMaps: StatsMaps,
	layout: LayoutData,
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): number | null {
	const field = getStatSortField(sortBy, analyzer);
	if (!field) return null;

	const analyzerStats = getLayoutAnalyzerStats(
		statsMaps,
		layout.name,
		field.analyzer,
		layout.cyanophageCompatible
	);
	if (!analyzerStats) return null;

	if (field.analyzer === CYANOPHAGE_ANALYZER) {
		return deriveCyanophageStats(analyzerStats as CyanophageStats)[
			field.key as CyanophageStatSortKey
		];
	}

	return deriveBotStats(analyzerStats as MonkeyracerStats)[field.key as StatSortKey];
}

export function deriveBotStats(stats: MonkeyracerStats): DerivedBotStats {
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

/** Line count of `formatBotStatsBlock` output — keep in sync with `.stats-block` in layout.css. */
export const STATS_BLOCK_LINE_COUNT = 14;

export function formatStatPercent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

function formatStatField(value: number, width: number): string {
	return formatStatPercent(value).padStart(width);
}

function formatStatLabel(label: string, width?: number): string {
	if (width === undefined) {
		return `${label} `;
	}
	return `${label.padStart(width)} `;
}

/** Card/stat highlight: analyzer filter colors, or yellow for the active sort field. */
export type StatsHighlightTone = 'cmini' | 'cyanophage' | 'sort';

export interface StatsBlockSegment {
	text: string;
	/** When set, the value uses the matching highlight color. */
	highlight?: StatsHighlightTone;
	/** Compare-delta tone: improvement for the right layout relative to the left. */
	tone?: 'better' | 'worse' | 'neutral';
}

function toHighlightKeySet<T extends string>(
	keys?: ReadonlySet<T> | T | null
): ReadonlySet<T> {
	if (keys == null) return new Set();
	if (typeof keys === 'string') return new Set([keys]);
	return keys;
}

/**
 * Derived-stat keys with an active limit for the given analyzer.
 * Pass applied (debounced) limits so card highlights match the filtered list/chips.
 */
export function getActiveFilterStatKeys(
	limits: Record<StatLimitKey, { value: string }>,
	analyzer: StatsAnalyzer
): Set<StatSortKey | CyanophageStatSortKey> {
	const keys = new Set<StatSortKey | CyanophageStatSortKey>();
	for (const field of getStatFilterFieldsForAnalyzer(analyzer)) {
		if (!limits[field.key]?.value.trim()) continue;
		const statKey = getStatFilterStatKey(field);
		if (statKey === 'likes') continue;
		keys.add(statKey);
	}
	return keys;
}

/** Count applied (debounced) stat-limit filters for one analyzer. */
export function countActiveStatFiltersForAnalyzer(
	limits: Record<StatLimitKey, { value: string }>,
	analyzer: StatsAnalyzer,
	options?: { includeLikes?: boolean }
): number {
	let count = 0;
	for (const field of getStatFilterFieldsForAnalyzer(analyzer)) {
		if (limits[field.key]?.value.trim()) count += 1;
	}
	if (options?.includeLikes && limits.likes?.value.trim()) count += 1;
	return count;
}

/**
 * Whether higher values are better for a sortable stat key, or `null` when the
 * metric is not ranked (hand/finger balance, etc.).
 */
export function isHigherBetterStatKey(
	key: StatSortKey | CyanophageStatSortKey,
	analyzer: StatsAnalyzer
): boolean | null {
	const field = ALL_STAT_SORT_FIELDS.find(
		(entry) => entry.key === key && entry.analyzer === analyzer
	);
	return field?.higherIsBetter ?? null;
}

function toneForStatDelta(
	delta: number,
	higherIsBetter: boolean | null,
	display: string
): 'better' | 'worse' | 'neutral' {
	if (higherIsBetter === null || delta === 0) return 'neutral';
	// Match displayed rounding so ±0.00% / ±0.0 stays neutral.
	const numeric = Number(display.replace(/[+%\s]/g, ''));
	if (Number.isFinite(numeric) && numeric === 0) return 'neutral';
	const improved = higherIsBetter ? delta > 0 : delta < 0;
	return improved ? 'better' : 'worse';
}

/** Signed percent delta like cmini compare (` 0.16%` / `-0.18%`). */
function formatStatDiffField(delta: number, width: number): string {
	const sign = delta > 0 ? ' ' : delta < 0 ? '-' : ' ';
	const body = `${(Math.abs(delta) * 100).toFixed(2)}%`;
	return `${sign}${body}`.padStart(width);
}

function formatCyanophageStatDiffField(delta: number, width: number): string {
	const sign = delta > 0 ? '+' : delta < 0 ? '-' : ' ';
	const body = Math.abs(delta).toFixed(1);
	return `${sign}${body}`.padStart(width);
}

const CYANOPHAGE_RAW_DIFF_KEYS = new Set<CyanophageStatSortKey>(['totalWordEffort', 'effort']);

function diffSegment(
	delta: number,
	width: number,
	higherIsBetter: boolean | null,
	format: 'percent' | 'raw'
): StatsBlockSegment {
	const text =
		format === 'raw' ? formatCyanophageStatDiffField(delta, width) : formatStatDiffField(delta, width);
	return {
		text,
		tone: toneForStatDelta(delta, higherIsBetter, text)
	};
}

function botDiff(
	newStats: DerivedBotStats,
	oldStats: DerivedBotStats,
	key: StatSortKey,
	width: number
): StatsBlockSegment {
	return diffSegment(
		newStats[key] - oldStats[key],
		width,
		isHigherBetterStatKey(key, DEFAULT_STATS_ANALYZER),
		'percent'
	);
}

function cyanophageDiff(
	newStats: DerivedCyanophageStats,
	oldStats: DerivedCyanophageStats,
	key: CyanophageStatSortKey,
	width: number
): StatsBlockSegment {
	return diffSegment(
		newStats[key] - oldStats[key],
		width,
		isHigherBetterStatKey(key, CYANOPHAGE_ANALYZER),
		CYANOPHAGE_RAW_DIFF_KEYS.has(key) ? 'raw' : 'percent'
	);
}

/**
 * cmini-style compare block: `new − old` for each displayed bot stat field.
 * Tones mark whether the delta is an improvement for the new (left) layout.
 */
export function buildBotStatsDiffBlockLines(
	newStats: DerivedBotStats,
	oldStats: DerivedBotStats
): StatsBlockSegment[][] {
	return [
		[{ text: formatStatLabel('Alt:') }, botDiff(newStats, oldStats, 'alternate', 7)],
		[
			{ text: formatStatLabel('Rol:') },
			botDiff(newStats, oldStats, 'roll', 7),
			{ text: ' (In/Out: ' },
			botDiff(newStats, oldStats, 'rollIn', 7),
			{ text: ' | ' },
			botDiff(newStats, oldStats, 'rollOut', 7),
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('One:') },
			botDiff(newStats, oldStats, 'one', 7),
			{ text: ' (In/Out: ' },
			botDiff(newStats, oldStats, 'oneIn', 7),
			{ text: ' | ' },
			botDiff(newStats, oldStats, 'oneOut', 7),
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('Rtl:') },
			botDiff(newStats, oldStats, 'rtl', 7),
			{ text: ' (In/Out: ' },
			botDiff(newStats, oldStats, 'rtlIn', 7),
			{ text: ' | ' },
			botDiff(newStats, oldStats, 'rtlOut', 7),
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('Red:') },
			botDiff(newStats, oldStats, 'red', 7),
			{ text: ' (Bad: ' },
			botDiff(newStats, oldStats, 'badRedirect', 10),
			{ text: ')' }
		],
		[{ text: '' }],
		[{ text: formatStatLabel('SFB:') }, botDiff(newStats, oldStats, 'sfb', 7)],
		[
			{ text: formatStatLabel('SFS:') },
			botDiff(newStats, oldStats, 'sfs', 7),
			{ text: ' (Red/Alt: ' },
			botDiff(newStats, oldStats, 'dsfbRed', 6),
			{ text: ' | ' },
			botDiff(newStats, oldStats, 'dsfbAlt', 6),
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('LH/RH:') },
			botDiff(newStats, oldStats, 'lh', 7),
			{ text: ' | ' },
			botDiff(newStats, oldStats, 'rh', 7)
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((finger, index) => {
			const rightFinger = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${finger}: ` },
				botDiff(newStats, oldStats, finger, 7),
				{ text: '    ' },
				{ text: `${rightFinger}: ` },
				botDiff(newStats, oldStats, rightFinger, 7)
			];
		})
	];
}

/** Cyanophage compare block: `new − old` (effort metrics use raw units). */
export function buildCyanophageStatsDiffBlockLines(
	newStats: DerivedCyanophageStats,
	oldStats: DerivedCyanophageStats
): StatsBlockSegment[][] {
	return [
		[
			{ text: formatStatLabel('Total Word Effort:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'totalWordEffort', 7)
		],
		[
			{ text: formatStatLabel('Effort:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'effort', 7)
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('Same Finger Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'sfb', 7)
		],
		[
			{ text: formatStatLabel('Skip Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'sfs', 7)
		],
		[
			{ text: formatStatLabel('Lat Stretch Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'lsb', 7)
		],
		[
			{ text: formatStatLabel('Scissors:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'scissors', 7)
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('LH/RH:') },
			cyanophageDiff(newStats, oldStats, 'lh', 7),
			{ text: ' | ' },
			cyanophageDiff(newStats, oldStats, 'rh', 7)
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((finger, index) => {
			const rightFinger = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${finger}: ` },
				cyanophageDiff(newStats, oldStats, finger, 7),
				{ text: '    ' },
				{ text: `${rightFinger}: ` },
				cyanophageDiff(newStats, oldStats, rightFinger, 7)
			];
		})
	];
}

export function getStatSortHighlightKey(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatSortKey | CyanophageStatSortKey | undefined {
	return getStatSortField(sortBy, analyzer)?.key;
}

export function formatCyanophageStatValue(value: number): string {
	return value.toFixed(1);
}

export function buildCyanophageStatsBlockLines(
	stats: DerivedCyanophageStats,
	highlightKeys?: ReadonlySet<CyanophageStatSortKey> | CyanophageStatSortKey | null,
	sortHighlightKey?: CyanophageStatSortKey | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: CyanophageStatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'cyanophage' : undefined;
	const sortHl = (...candidates: CyanophageStatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;

	return [
		[
			{
				text: formatStatLabel('Total Word Effort:', CYANOPHAGE_STAT_LABEL_WIDTH),
				highlight: sortHl('totalWordEffort')
			},
			{
				text: formatCyanophageStatValue(stats.totalWordEffort).padStart(6),
				highlight: filterHl('totalWordEffort')
			}
		],
		[
			{
				text: formatStatLabel('Effort:', CYANOPHAGE_STAT_LABEL_WIDTH),
				highlight: sortHl('effort')
			},
			{
				text: formatCyanophageStatValue(stats.effort).padStart(6),
				highlight: filterHl('effort')
			}
		],
		[{ text: '' }],
		[
			{
				text: formatStatLabel('Same Finger Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH),
				highlight: sortHl('sfb')
			},
			{ text: formatStatField(stats.sfb, 6), highlight: filterHl('sfb') }
		],
		[
			{
				text: formatStatLabel('Skip Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH),
				highlight: sortHl('sfs')
			},
			{ text: formatStatField(stats.sfs, 6), highlight: filterHl('sfs') }
		],
		[
			{
				text: formatStatLabel('Lat Stretch Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH),
				highlight: sortHl('lsb')
			},
			{ text: formatStatField(stats.lsb, 6), highlight: filterHl('lsb') }
		],
		[
			{
				text: formatStatLabel('Scissors:', CYANOPHAGE_STAT_LABEL_WIDTH),
				highlight: sortHl('scissors')
			},
			{ text: formatStatField(stats.scissors, 6), highlight: filterHl('scissors') }
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('LH/RH:'), highlight: sortHl('lh', 'rh') },
			{ text: formatStatField(stats.lh, 6), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: filterHl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${left}: `, highlight: sortHl(left) },
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{ text: `${right}: `, highlight: sortHl(right) },
				{ text: formatStatField(stats[right], 6), highlight: filterHl(right) }
			];
		})
	];
}

/** Placeholder with the same line count as a cyanophage stats block. */
export function formatCyanophageStatsLoadingBlock(): string {
	return [
		'LOADING STATS',
		'…',
		...Array(Math.max(0, CYANOPHAGE_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Placeholder with the same line count as a cyanophage stats block. */
export function formatCyanophageStatsUnavailableBlock(reason?: string): string {
	return [
		'STATS UNAVAILABLE',
		reason ?? 'no Cyanophage stats for this layout',
		...Array(Math.max(0, CYANOPHAGE_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Lines of segments for rendering; optional highlight on filtered/sorted stats. */
export function buildBotStatsBlockLines(
	stats: DerivedBotStats,
	highlightKeys?: ReadonlySet<StatSortKey> | StatSortKey | null,
	sortHighlightKey?: StatSortKey | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: StatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'cmini' : undefined;
	const sortHl = (...candidates: StatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;

	return [
		[
			{ text: formatStatLabel('Alt:'), highlight: sortHl('alternate') },
			{ text: formatStatField(stats.alternate, 6), highlight: filterHl('alternate') }
		],
		[
			{ text: formatStatLabel('Rol:'), highlight: sortHl('roll', 'rollIn', 'rollOut') },
			{ text: formatStatField(stats.roll, 6), highlight: filterHl('roll') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rollIn, 6), highlight: filterHl('rollIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rollOut, 6), highlight: filterHl('rollOut') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('One:'), highlight: sortHl('one', 'oneIn', 'oneOut') },
			{ text: formatStatField(stats.one, 6), highlight: filterHl('one') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.oneIn, 6), highlight: filterHl('oneIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.oneOut, 6), highlight: filterHl('oneOut') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('Rtl:'), highlight: sortHl('rtl', 'rtlIn', 'rtlOut') },
			{ text: formatStatField(stats.rtl, 6), highlight: filterHl('rtl') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rtlIn, 6), highlight: filterHl('rtlIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rtlOut, 6), highlight: filterHl('rtlOut') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('Red:'), highlight: sortHl('red') },
			{ text: formatStatField(stats.red, 6), highlight: filterHl('red') },
			{ text: ' (' },
			{ text: 'Bad:', highlight: sortHl('badRedirect') },
			{ text: ' ' },
			{ text: formatStatField(stats.badRedirect, 9), highlight: filterHl('badRedirect') },
			{ text: ')' }
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('SFB:'), highlight: sortHl('sfb') },
			{ text: formatStatField(stats.sfb, 6), highlight: filterHl('sfb') }
		],
		[
			{
				text: formatStatLabel('SFS:'),
				highlight: sortHl('sfs', 'dsfbRed', 'dsfbAlt')
			},
			{ text: formatStatField(stats.sfs, 6), highlight: filterHl('sfs') },
			{ text: ' (Red/Alt: ' },
			{ text: formatStatField(stats.dsfbRed, 5), highlight: filterHl('dsfbRed') },
			{ text: ' | ' },
			{ text: formatStatField(stats.dsfbAlt, 5), highlight: filterHl('dsfbAlt') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('LH/RH:'), highlight: sortHl('lh', 'rh') },
			{ text: formatStatField(stats.lh, 6), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: filterHl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${left}: `, highlight: sortHl(left) },
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{ text: `${right}: `, highlight: sortHl(right) },
				{ text: formatStatField(stats[right], 6), highlight: filterHl(right) }
			];
		})
	];
}

/** Fixed-width block matching the cmini Discord bot layout. */
export function formatBotStatsBlock(stats: DerivedBotStats): string {
	return buildBotStatsBlockLines(stats)
		.map((line) => line.map((segment) => segment.text).join(''))
		.join('\n');
}

/** Placeholder with the same line count as a full stats block. */
export function formatStatsLoadingBlock(): string {
	return [
		'LOADING STATS',
		'…',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Placeholder with the same line count as a full stats block. */
export function formatStatsUnavailableBlock(): string {
	return [
		'STATS UNAVAILABLE',
		'no cmini cache for this layout',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}
