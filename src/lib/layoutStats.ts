import type { CyanophageStats, MonkeyracerStats, LayoutData, StatsMaps } from '$lib/layout';

/** Default analyzer for layout stats (matches common cmini bot preference). */
export const DEFAULT_STATS_ANALYZER = 'monkeyracer';

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Analyzers available for stats display, sorting, and filtering. */
export const STAT_ANALYZERS = [
	{ value: DEFAULT_STATS_ANALYZER, label: 'cmini (monkeyracer)' },
	{ value: CYANOPHAGE_ANALYZER, label: 'cyanophage' }
] as const;

export type StatsAnalyzer = (typeof STAT_ANALYZERS)[number]['value'];

const STATS_ANALYZER_VALUES = new Set<string>(STAT_ANALYZERS.map((analyzer) => analyzer.value));

export function isStatsAnalyzer(value: string): value is StatsAnalyzer {
	return STATS_ANALYZER_VALUES.has(value);
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

/** Keys usable in stat limit filters (union of both analyzers). */
export type StatLimitKey = StatSortKey | CyanophageStatSortKey | 'likes';

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

/** Cyanophage general stat filter rows (matches stats card grouping). */
export const CYANOPHAGE_GENERAL_STAT_FILTER_ROWS: readonly (readonly StatFilterField[])[] = [
	[
		{ key: 'totalWordEffort', label: 'TWE', title: 'Total Word Effort', unit: 'raw' },
		{ key: 'effort', label: 'Effort', title: 'Effort', unit: 'raw' }
	],
	[
		{ key: 'sfb', label: 'SFB', title: 'Same Finger Bigrams' },
		{ key: 'sfs', label: 'SFS', title: 'Skip Bigrams' },
		{ key: 'lsb', label: 'LSB', title: 'Lat Stretch Bigrams' }
	],
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

export const LEFT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'lh', label: 'Hand' },
	{ key: 'LI', label: 'Index' },
	{ key: 'LM', label: 'Middle' },
	{ key: 'LR', label: 'Ring' },
	{ key: 'LP', label: 'Pinky' },
	{ key: 'LT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

export const RIGHT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'rh', label: 'Hand' },
	{ key: 'RI', label: 'Index' },
	{ key: 'RM', label: 'Middle' },
	{ key: 'RR', label: 'Ring' },
	{ key: 'RP', label: 'Pinky' },
	{ key: 'RT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

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
	...LEFT_HAND_STAT_FILTER_FIELDS,
	...RIGHT_HAND_STAT_FILTER_FIELDS,
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

export function getStatFilterFieldsForAnalyzer(analyzer: StatsAnalyzer): readonly StatFilterField[] {
	return [
		...getGeneralStatFilterRowsForAnalyzer(analyzer).flat(),
		...LEFT_HAND_STAT_FILTER_FIELDS,
		...RIGHT_HAND_STAT_FILTER_FIELDS
	];
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
	analyzer: StatsAnalyzer = DEFAULT_STATS_ANALYZER
): SortBy | undefined {
	const legacy = parseLegacySortParam(sort);
	if (legacy) return legacy.sortBy;

	if (sort === 'sfb') {
		return analyzer === CYANOPHAGE_ANALYZER ? 'cyano-sfb' : 'sfb';
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

export interface StatsBlockSegment {
	text: string;
	highlight?: boolean;
	/** Compare-delta tone: improvement for the right layout relative to the left. */
	tone?: 'better' | 'worse' | 'neutral';
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
	highlightKey?: CyanophageStatSortKey
): StatsBlockSegment[][] {
	const hl = (key: CyanophageStatSortKey): boolean => highlightKey === key;

	return [
		[
			{ text: formatStatLabel('Total Word Effort:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			{
				text: formatCyanophageStatValue(stats.totalWordEffort).padStart(6),
				highlight: hl('totalWordEffort')
			}
		],
		[
			{ text: formatStatLabel('Effort:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			{
				text: formatCyanophageStatValue(stats.effort).padStart(6),
				highlight: hl('effort')
			}
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('Same Finger Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			{ text: formatStatField(stats.sfb, 6), highlight: hl('sfb') }
		],
		[
			{ text: formatStatLabel('Skip Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			{ text: formatStatField(stats.sfs, 6), highlight: hl('sfs') }
		],
		[
			{ text: formatStatLabel('Lat Stretch Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			{ text: formatStatField(stats.lsb, 6), highlight: hl('lsb') }
		],
		[
			{ text: formatStatLabel('Scissors:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			{ text: formatStatField(stats.scissors, 6), highlight: hl('scissors') }
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('LH/RH:') },
			{ text: formatStatField(stats.lh, 6), highlight: hl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: hl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${left}: ` },
				{ text: formatStatField(stats[left], 6) },
				{ text: '    ' },
				{ text: `${right}: ` },
				{ text: formatStatField(stats[right], 6) }
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
		reason ?? 'no cyanophage stats for this layout',
		...Array(Math.max(0, CYANOPHAGE_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Lines of segments for rendering; optional highlight on the active sort stat. */
export function buildBotStatsBlockLines(
	stats: DerivedBotStats,
	highlightKey?: StatSortKey
): StatsBlockSegment[][] {
	const hl = (key: StatSortKey): boolean => highlightKey === key;

	return [
		[
			{ text: formatStatLabel('Alt:') },
			{ text: formatStatField(stats.alternate, 6), highlight: hl('alternate') }
		],
		[
			{ text: formatStatLabel('Rol:') },
			{ text: formatStatField(stats.roll, 6), highlight: hl('roll') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rollIn, 6), highlight: hl('rollIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rollOut, 6), highlight: hl('rollOut') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('One:') },
			{ text: formatStatField(stats.one, 6), highlight: hl('one') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.oneIn, 6), highlight: hl('oneIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.oneOut, 6), highlight: hl('oneOut') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('Rtl:') },
			{ text: formatStatField(stats.rtl, 6), highlight: hl('rtl') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rtlIn, 6), highlight: hl('rtlIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rtlOut, 6), highlight: hl('rtlOut') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('Red:') },
			{ text: formatStatField(stats.red, 6), highlight: hl('red') },
			{ text: ' (Bad: ' },
			{ text: formatStatField(stats.badRedirect, 9), highlight: hl('badRedirect') },
			{ text: ')' }
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('SFB:') },
			{ text: formatStatField(stats.sfb, 6), highlight: hl('sfb') }
		],
		[
			{ text: formatStatLabel('SFS:') },
			{ text: formatStatField(stats.sfs, 6), highlight: hl('sfs') },
			{ text: ' (Red/Alt: ' },
			{ text: formatStatField(stats.dsfbRed, 5), highlight: hl('dsfbRed') },
			{ text: ' | ' },
			{ text: formatStatField(stats.dsfbAlt, 5), highlight: hl('dsfbAlt') },
			{ text: ')' }
		],
		[
			{ text: formatStatLabel('LH/RH:') },
			{ text: formatStatField(stats.lh, 6), highlight: hl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: hl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${left}: ` },
				{ text: formatStatField(stats[left], 6) },
				{ text: '    ' },
				{ text: `${right}: ` },
				{ text: formatStatField(stats[right], 6) }
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
