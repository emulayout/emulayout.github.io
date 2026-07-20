import type {
	CyanophageStats,
	Mana2Stats,
	MonkeyracerStats,
	LayoutData,
	StatsMaps
} from '$lib/layout';

/** Default analyzer for layout stats (matches common cmini bot preference). */
export const DEFAULT_STATS_ANALYZER = 'monkeyracer';

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Mana2 stats analyzer. */
export const MANA2_ANALYZER = 'mana2';

/** Display stacked analyzers that opt into All (not Mana2). */
export const ALL_STATS_ANALYZERS_MODE = 'all';

/** Concrete analyzers that own a stats JSON map. */
export const STAT_ANALYZERS = [
	{
		value: DEFAULT_STATS_ANALYZER,
		label: 'cmini (monkeyracer)',
		shortLabel: 'cmini',
		statsUrl: '/layout-stats.json',
		includeInAll: true
	},
	{
		value: CYANOPHAGE_ANALYZER,
		label: 'Cyanophage',
		shortLabel: 'Cyanophage',
		statsUrl: '/layout-stats-cyanophage.json',
		includeInAll: true
	},
	{
		value: MANA2_ANALYZER,
		label: 'Mana2',
		shortLabel: 'Mana2',
		statsUrl: '/layout-stats-mana2.json',
		includeInAll: false
	}
] as const;

export type StatsAnalyzerDefinition = (typeof STAT_ANALYZERS)[number];
export type StatsAnalyzer = StatsAnalyzerDefinition['value'];

/** Toolbar / URL display modes (includes stacked “All”). */
export const STAT_ANALYZER_MODES = [
	{ value: ALL_STATS_ANALYZERS_MODE, label: 'All' },
	...STAT_ANALYZERS
] as const;

export type StatsAnalyzerMode = (typeof STAT_ANALYZER_MODES)[number]['value'];

const STATS_ANALYZER_BY_VALUE = new Map<StatsAnalyzer, StatsAnalyzerDefinition>(
	STAT_ANALYZERS.map((analyzer) => [analyzer.value, analyzer])
);
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

export function getAnalyzerDefinition(analyzer: StatsAnalyzer): StatsAnalyzerDefinition {
	const definition = STATS_ANALYZER_BY_VALUE.get(analyzer);
	if (!definition) {
		throw new Error(`Unknown stats analyzer: ${analyzer}`);
	}
	return definition;
}

export function analyzerShortLabel(analyzer: StatsAnalyzer): string {
	return getAnalyzerDefinition(analyzer).shortLabel;
}

export function getAnalyzerStatsUrl(analyzer: StatsAnalyzer): string {
	return getAnalyzerDefinition(analyzer).statsUrl;
}

/** Concrete analyzers included in a display mode. */
export function resolveStatsAnalyzers(mode: StatsAnalyzerMode): StatsAnalyzer[] {
	if (mode === ALL_STATS_ANALYZERS_MODE) {
		return STAT_ANALYZERS.filter((analyzer) => analyzer.includeInAll).map(
			(analyzer) => analyzer.value
		);
	}
	return [mode];
}

/** Whether a concrete analyzer’s stats should render for the current display mode. */
export function showsAnalyzerStats(mode: StatsAnalyzerMode, analyzer: StatsAnalyzer): boolean {
	return resolveStatsAnalyzers(mode).includes(analyzer);
}

export function showsMonkeyracerStats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, DEFAULT_STATS_ANALYZER);
}

export function showsCyanophageStats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, CYANOPHAGE_ANALYZER);
}

export function showsMana2Stats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, MANA2_ANALYZER);
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

/** Keep in sync with MANA2_STAT_KEYS in bin/mana2-stats.js. */
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
const MANA2_RAW_STAT_KEYS = new Set<Mana2StatKey>([
	'sfbw',
	'sfsw',
	'lsb',
	'lss',
	'vsb',
	'vss'
]);

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

/**
 * Prefixed mana2 filter keys (storage/URL) so limits never collide with cmini/cyano.
 * Map to derived stats via {@link StatFilterField.statKey}.
 */
export type Mana2StatLimitKey =
	| 'mana-sfb'
	| 'mana-sfs'
	| 'mana-lsb'
	| 'mana-lss'
	| 'mana-vsb'
	| 'mana-vss'
	| 'mana-lh'
	| 'mana-rh'
	| 'mana-LI'
	| 'mana-LM'
	| 'mana-LR'
	| 'mana-LP'
	| 'mana-LT'
	| 'mana-RI'
	| 'mana-RM'
	| 'mana-RR'
	| 'mana-RP'
	| 'mana-RT'
	| 'mana-alt'
	| 'mana-roll'
	| 'mana-redirect';

/** Keys usable in stat limit filters (union of all analyzers). */
export type StatLimitKey =
	| StatSortKey
	| CyanophageStatSortKey
	| CyanoStatLimitKey
	| Mana2StatSortKey
	| Mana2StatLimitKey
	| 'likes';

export const CYANOPHAGE_STATS_BLOCK_LINE_COUNT = 14;

/** Longest cyanophage stat label in `buildCyanophageStatsBlockLines` (for value column alignment). */
const CYANOPHAGE_STAT_LABEL_WIDTH = 20;

/** Line count of `buildMana2StatsBlockLines` — keep in sync with card height extras. */
export const MANA2_STATS_BLOCK_LINE_COUNT = 18;

/** Per-section label widths so colons align within a section only (not across sections). */
const MANA2_PAIR_LABEL_WIDTH = 12; // "Same Finger:"
const MANA2_FLOW_LABEL_WIDTH = 9; // "Redirect:"
const MANA2_HAND_LABEL_WIDTH = 6; // "LH/RH:"

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
	key: StatSortKey | CyanophageStatSortKey | Mana2StatSortKey;
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

/** Sortable mana2 stats — values are `mana-*` when they would collide with cmini/cyano. */
export const MANA2_STAT_SORT_FIELDS = [
	{
		value: 'mana-sfb',
		label: 'Same Finger (bigram)',
		key: 'sfb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-sfs',
		label: 'Same Finger (skip)',
		key: 'sfs',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-skb',
		label: 'Same Key (bigram)',
		key: 'skb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-sks',
		label: 'Same Key (skip)',
		key: 'sks',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-lsb',
		label: 'Stretch (bigram)',
		key: 'lsb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-vsb',
		label: 'Scissor (bigram)',
		key: 'vsb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-alt',
		label: 'Alternation',
		key: 'alt',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'mana-redirect',
		label: 'Redirect',
		key: 'redirect',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-roll',
		label: 'Roll',
		key: 'roll',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'mana-lh',
		label: 'Left hand',
		key: 'lh',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	},
	{
		value: 'mana-rh',
		label: 'Right hand',
		key: 'rh',
		analyzer: MANA2_ANALYZER,
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

const ALL_STAT_SORT_FIELDS = [
	...STAT_SORT_FIELDS,
	...CYANOPHAGE_STAT_SORT_FIELDS,
	...MANA2_STAT_SORT_FIELDS
] as const;

export interface StatFilterField {
	key: StatLimitKey;
	label: string;
	/** Longer name for display labels when `label` is abbreviated. */
	title?: string;
	/** Short explanation shown next to the field in the general-stats modal. */
	hint?: string;
	/** How filter input values are interpreted. Defaults to percent (0–100). */
	unit?: 'percent' | 'raw';
	/**
	 * Property on derived analyzer stats used for comparison.
	 * Defaults to `key` when the storage key matches the stats property.
	 */
	statKey?: StatSortKey | CyanophageStatSortKey | Mana2StatSortKey;
}

export const LIKES_STAT_FILTER_FIELD = {
	key: 'likes',
	label: 'Likes',
	title: 'Likes',
	hint: 'Community like count for this layout on cmini.',
	unit: 'raw'
} as const satisfies StatFilterField;

/** Max related stats per general-stat row (matches layout card group width). */
export const GENERAL_STAT_FILTER_COLUMN_COUNT = 3;

/** Titled block of related general-stat filter rows. */
export interface GeneralStatFilterGroup {
	title: string;
	rows: readonly (readonly StatFilterField[])[];
}

function flattenGeneralStatFilterGroups(
	groups: readonly GeneralStatFilterGroup[]
): StatFilterField[] {
	return groups.flatMap((group) => group.rows.flat());
}

/**
 * General stat limits in titled groups; each row has up to three related fields
 * (empty cells omitted at render time).
 */
export const MONKEY_GENERAL_STAT_FILTER_GROUPS: readonly GeneralStatFilterGroup[] = [
	{
		title: 'Alternation',
		rows: [
			[
				{
					key: 'alternate',
					label: 'Alt',
					title: 'Alternation',
					hint: 'Trigrams that switch hands each key (L-R-L or R-L-R). Higher is usually preferred.'
				}
			]
		]
	},
	{
		title: 'Roll',
		rows: [
			[
				{
					key: 'roll',
					label: 'Rol',
					title: 'Roll',
					hint: 'Two same-hand keys rolling in one direction, then the other hand. Comfortable “drumming” motions; higher is better.'
				},
				{
					key: 'rollIn',
					label: 'In',
					title: 'Roll in',
					hint: 'Rolls that move inward (pinky → index) on the rolling hand.'
				},
				{
					key: 'rollOut',
					label: 'Out',
					title: 'Roll out',
					hint: 'Rolls that move outward (index → pinky) on the rolling hand.'
				}
			]
		]
	},
	{
		title: 'One-hand',
		rows: [
			[
				{
					key: 'one',
					label: 'One',
					title: 'One-hand',
					hint: 'Trigrams typed entirely on one hand (no hand switch). Often slower than rolls/alts.'
				},
				{
					key: 'oneIn',
					label: 'In',
					title: 'One-hand in',
					hint: 'One-hand trigrams whose finger motion trends inward (pinky → index).'
				},
				{
					key: 'oneOut',
					label: 'Out',
					title: 'One-hand out',
					hint: 'One-hand trigrams whose finger motion trends outward (index → pinky).'
				}
			]
		]
	},
	{
		title: 'Roll total',
		rows: [
			[
				{
					key: 'rtl',
					label: 'Rtl',
					title: 'Roll total',
					hint: 'Combined roll rate (roll + related roll totals in cmini’s Rtl metric). Higher means more rolling flow.'
				},
				{
					key: 'rtlIn',
					label: 'In',
					title: 'Roll total in',
					hint: 'Inward portion of the roll-total metric (pinky → index).'
				},
				{
					key: 'rtlOut',
					label: 'Out',
					title: 'Roll total out',
					hint: 'Outward portion of the roll-total metric (index → pinky).'
				}
			]
		]
	},
	{
		title: 'Redirect',
		rows: [
			[
				{
					key: 'red',
					label: 'Red',
					title: 'Redirect',
					hint: 'Same-hand trigrams that reverse direction mid-sequence (anti-rolls). Usually minimized.'
				},
				{
					key: 'badRedirect',
					label: 'Bad',
					title: 'Bad redirect',
					hint: 'Redirects that never use an index finger—awkward middle/ring/pinky-only redirects. Lower is better.'
				}
			]
		]
	},
	{
		title: 'Same finger',
		rows: [
			[
				{
					key: 'sfb',
					label: 'SFB',
					title: 'Same finger bigrams',
					hint: 'Two consecutive keys on different positions hit by the same finger (e.g. QWERTY “ed”). Lower is better.'
				}
			],
			[
				{
					key: 'sfs',
					label: 'SFS',
					title: 'Same finger skipgrams',
					hint: 'Same finger used on keys 1 and 3 of a trigram, with a different finger in between. Lower is better.'
				},
				{
					key: 'dsfbRed',
					label: 'Red',
					title: 'Same-finger skip redirect',
					hint: 'Same-finger skipgrams that also form a redirect pattern. Especially awkward; lower is better.'
				},
				{
					key: 'dsfbAlt',
					label: 'Alt',
					title: 'Same-finger skip alternate',
					hint: 'Same-finger skipgrams that also form an alternation (hand switch in the middle). Lower is better.'
				}
			]
		]
	}
];

/** Cyanophage general stat filter groups. */
export const CYANOPHAGE_GENERAL_STAT_FILTER_GROUPS: readonly GeneralStatFilterGroup[] = [
	{
		title: 'Effort',
		rows: [
			[
				{
					key: 'totalWordEffort',
					label: 'TWE',
					title: 'Total Word Effort',
					hint: 'Cyanophage’s overall typing-cost score for dictionary words (travel + difficulty). Lower is better.',
					unit: 'raw'
				}
			],
			[
				{
					key: 'effort',
					label: 'Effort',
					title: 'Effort',
					hint: 'Average per-key effort from Cyanophage’s position effort grid. Lower is better.',
					unit: 'raw'
				}
			]
		]
	},
	{
		title: 'Bigrams',
		rows: [
			[
				{
					key: 'cyano-sfb',
					statKey: 'sfb',
					label: 'SFB',
					title: 'Same Finger Bigrams',
					hint: 'Consecutive keys typed with the same finger. Slow and tiring; lower is better.'
				}
			],
			[
				{
					key: 'cyano-sfs',
					statKey: 'sfs',
					label: 'SFS',
					title: 'Skip Bigrams',
					hint: 'Same finger on letters separated by one other key (skipgrams). Lower is better.'
				}
			],
			[
				{
					key: 'lsb',
					label: 'LSB',
					title: 'Lat Stretch Bigrams',
					hint: 'Adjacent-finger bigrams that need an awkward sideways stretch (often into outer index columns). Lower is better.'
				}
			],
			[
				{
					key: 'scissors',
					label: 'Sci',
					title: 'Scissors',
					hint: 'Adjacent fingers jumping vertically across rows (scissor motion). Uncomfortable; lower is better.'
				}
			]
		]
	}
];

/** Mana2 general stat filter groups (related stats + section headings). */
export const MANA2_GENERAL_STAT_FILTER_GROUPS: readonly GeneralStatFilterGroup[] = [
	{
		title: 'Same finger',
		rows: [
			[
				{
					key: 'mana-sfb',
					statKey: 'sfb',
					label: 'SFB',
					title: 'Same Finger Bigrams',
					hint: 'Same finger hits two different keys in a row. Lower is better.'
				},
				{
					key: 'mana-sfs',
					statKey: 'sfs',
					label: 'SFS',
					title: 'Same Finger Skipgrams',
					hint: 'Same finger on letters with one letter between them (skipgram). Lower is better.'
				}
			]
		]
	},
	{
		title: 'Same key',
		rows: [
			[
				{
					key: 'skb',
					label: 'SKB',
					title: 'Same Key Bigrams',
					hint: 'Repeats on the exact same key (e.g. “ss”). Often inevitable; lower can still help comfort.'
				},
				{
					key: 'sks',
					label: 'SKS',
					title: 'Same Key Skipgrams',
					hint: 'Same key used again with one letter between (skipgram repeats).'
				}
			]
		]
	},
	{
		title: 'Stretch',
		rows: [
			[
				{
					key: 'mana-lsb',
					statKey: 'lsb',
					label: 'Big',
					title: 'Stretch Bigrams',
					hint: 'Weighted lateral stretch: same-hand keys that are horizontally far apart. Worse when the stretch is shared by fewer fingers. Lower is better.',
					unit: 'raw'
				},
				{
					key: 'mana-lss',
					statKey: 'lss',
					label: 'Skip',
					title: 'Stretch Skipgrams',
					hint: 'Same stretch rating applied to skipgrams (letters with one key between). Lower is better.',
					unit: 'raw'
				}
			]
		]
	},
	{
		title: 'Scissor',
		rows: [
			[
				{
					key: 'mana-vsb',
					statKey: 'vsb',
					label: 'Big',
					title: 'Scissor Bigrams',
					hint: 'Weighted vertical scissor: adjacent fingers separated by row. Penalty depends on which finger is above/below. Lower is better.',
					unit: 'raw'
				},
				{
					key: 'mana-vss',
					statKey: 'vss',
					label: 'Skip',
					title: 'Scissor Skipgrams',
					hint: 'Same scissor rating on skipgrams. Lower is better.',
					unit: 'raw'
				}
			]
		]
	},
	{
		title: 'Alternation',
		rows: [
			[
				{
					key: 'mana-alt',
					statKey: 'alt',
					label: 'Alt',
					title: 'Alternation',
					hint: 'Trigrams that switch hands every key (L-R-L / R-L-R). Higher is usually preferred.'
				},
				{
					key: 'altNoThumbs',
					label: 'NoT',
					title: 'No thumbs',
					hint: 'Alternation counted only on trigrams that do not use a thumb key.'
				},
				{
					key: 'altSfs',
					label: 'A&S',
					title: 'Alt & SFS',
					hint: 'Alternation where the first and last keys use the same finger—an awkward alt. Lower is better.'
				}
			]
		]
	},
	{
		title: 'Redirect',
		rows: [
			[
				{
					key: 'mana-redirect',
					statKey: 'redirect',
					label: 'Red',
					title: 'Redirect',
					hint: 'Same-hand trigram that is not a roll and has no SFBs—direction reverses mid-hand (anti-roll). Lower is better.'
				},
				{
					key: 'redirectNoThumbs',
					label: 'NoT',
					title: 'No thumbs',
					hint: 'Redirects that do not involve a thumb key.'
				},
				{
					key: 'redirectWeak',
					label: 'Weak',
					title: 'Weak redirect',
					hint: 'Redirects using only middle/ring/pinky (no index or thumb). Especially awkward; lower is better.'
				}
			],
			[
				{
					key: 'redirectSfs',
					label: 'R&S',
					title: 'Redirect & SFS',
					hint: 'Redirect where the first and last keys use the same finger. Lower is better.'
				},
				{
					key: 'redirectSfsWeak',
					label: 'W&S',
					title: 'Weak redirect & SFS',
					hint: 'Weak redirect that is also an SFS redirect. Lower is better.'
				}
			]
		]
	},
	{
		title: 'Roll',
		rows: [
			[
				{
					key: 'mana-roll',
					statKey: 'roll',
					label: 'Roll',
					title: 'Roll total',
					hint: 'Sum of in/out 2- and 3-key rolls—fingers moving in one consistent direction. Higher is usually preferred.'
				},
				{
					key: 'inroll2',
					label: 'In2',
					title: 'Inroll 2',
					hint: 'Two same-hand keys rolling inward (pinky → index), plus a hand switch. Example shape: QWERTY “oif”.'
				},
				{
					key: 'outroll2',
					label: 'Out2',
					title: 'Outroll 2',
					hint: 'Two same-hand keys rolling outward (index → pinky), plus a hand switch.'
				}
			],
			[
				{
					key: 'rollNoThumbs',
					label: 'NoT',
					title: 'No thumbs',
					hint: 'Roll total excluding trigrams that use a thumb key.'
				},
				{
					key: 'inroll3',
					label: 'In3',
					title: 'Inroll 3',
					hint: 'Three same-hand keys rolling inward (pinky → index) with no same-finger use.'
				},
				{
					key: 'outroll3',
					label: 'Out3',
					title: 'Outroll 3',
					hint: 'Three same-hand keys rolling outward (index → pinky) with no same-finger use.'
				}
			],
			[
				{
					key: 'goodroll',
					label: 'Good',
					title: 'Good roll',
					hint: 'Rolls that also have zero scissor rating on both bigrams—cleaner rolls. Higher is better.'
				}
			]
		]
	},
	{
		title: 'Other',
		rows: [
			[
				{
					key: 'offpinky',
					label: 'OffP',
					title: 'Off pinky',
					hint: 'Pinky usage off the home row. Stretchy pinky work; lower is usually preferred.'
				}
			]
		]
	}
];

/** Flat list of monkey general stat filter fields. */
export const MONKEY_GENERAL_STAT_FILTER_FIELDS = flattenGeneralStatFilterGroups(
	MONKEY_GENERAL_STAT_FILTER_GROUPS
);

/** Flat list of cyanophage general stat filter fields. */
export const CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS = flattenGeneralStatFilterGroups(
	CYANOPHAGE_GENERAL_STAT_FILTER_GROUPS
);

/** Flat list of mana2 general stat filter fields. */
export const MANA2_GENERAL_STAT_FILTER_FIELDS = flattenGeneralStatFilterGroups(
	MANA2_GENERAL_STAT_FILTER_GROUPS
);

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

/** Mana2 hand filters use `mana-*` keys so limits never collide with cmini/cyano. */
export const MANA2_LEFT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'mana-lh', statKey: 'lh', label: 'Hand' },
	{ key: 'mana-LI', statKey: 'LI', label: 'Index' },
	{ key: 'mana-LM', statKey: 'LM', label: 'Middle' },
	{ key: 'mana-LR', statKey: 'LR', label: 'Ring' },
	{ key: 'mana-LP', statKey: 'LP', label: 'Pinky' },
	{ key: 'mana-LT', statKey: 'LT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

export const MANA2_RIGHT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'mana-rh', statKey: 'rh', label: 'Hand' },
	{ key: 'mana-RI', statKey: 'RI', label: 'Index' },
	{ key: 'mana-RM', statKey: 'RM', label: 'Middle' },
	{ key: 'mana-RR', statKey: 'RR', label: 'Ring' },
	{ key: 'mana-RP', statKey: 'RP', label: 'Pinky' },
	{ key: 'mana-RT', statKey: 'RT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

function uniqueStatFilterFields(fields: readonly StatFilterField[]): StatFilterField[] {
	const byKey = new Map<string, StatFilterField>();
	for (const field of fields) {
		if (!byKey.has(field.key)) byKey.set(field.key, field);
	}
	return [...byKey.values()];
}

/** All stat limit keys (all analyzers) — used for URL state and empty limit records. */
export const ALL_STAT_FILTER_FIELDS = uniqueStatFilterFields([
	...MONKEY_GENERAL_STAT_FILTER_FIELDS,
	...CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS,
	...MANA2_GENERAL_STAT_FILTER_FIELDS,
	...MONKEY_LEFT_HAND_STAT_FILTER_FIELDS,
	...MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS,
	...CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS,
	...CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS,
	...MANA2_LEFT_HAND_STAT_FILTER_FIELDS,
	...MANA2_RIGHT_HAND_STAT_FILTER_FIELDS,
	LIKES_STAT_FILTER_FIELD
]);

export function getGeneralStatFilterGroupsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly GeneralStatFilterGroup[] {
	if (analyzer === CYANOPHAGE_ANALYZER) return CYANOPHAGE_GENERAL_STAT_FILTER_GROUPS;
	if (analyzer === MANA2_ANALYZER) return MANA2_GENERAL_STAT_FILTER_GROUPS;
	return MONKEY_GENERAL_STAT_FILTER_GROUPS;
}

/** Flat row list for iteration (chip summaries, snapshots, etc.). */
export function getGeneralStatFilterRowsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly (readonly StatFilterField[])[] {
	return getGeneralStatFilterGroupsForAnalyzer(analyzer).flatMap((group) => group.rows);
}

export function getLeftHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	if (analyzer === CYANOPHAGE_ANALYZER) return CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS;
	if (analyzer === MANA2_ANALYZER) return MANA2_LEFT_HAND_STAT_FILTER_FIELDS;
	return MONKEY_LEFT_HAND_STAT_FILTER_FIELDS;
}

export function getRightHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	if (analyzer === CYANOPHAGE_ANALYZER) return CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS;
	if (analyzer === MANA2_ANALYZER) return MANA2_RIGHT_HAND_STAT_FILTER_FIELDS;
	return MONKEY_RIGHT_HAND_STAT_FILTER_FIELDS;
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

const MANA2_HAND_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...MANA2_LEFT_HAND_STAT_FILTER_FIELDS,
	...MANA2_RIGHT_HAND_STAT_FILTER_FIELDS
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

const MANA2_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...MANA2_GENERAL_STAT_FILTER_FIELDS,
	...MANA2_HAND_STAT_FILTER_FIELDS
];

export function getHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	if (analyzer === CYANOPHAGE_ANALYZER) return CYANOPHAGE_HAND_STAT_FILTER_FIELDS;
	if (analyzer === MANA2_ANALYZER) return MANA2_HAND_STAT_FILTER_FIELDS;
	return MONKEY_HAND_STAT_FILTER_FIELDS;
}

export function getStatFilterFieldsForAnalyzer(analyzer: StatsAnalyzer): readonly StatFilterField[] {
	if (analyzer === CYANOPHAGE_ANALYZER) return CYANOPHAGE_STAT_FILTER_FIELDS;
	if (analyzer === MANA2_ANALYZER) return MANA2_STAT_FILTER_FIELDS;
	return MONKEY_STAT_FILTER_FIELDS;
}

/** Resolve the derived-stats property for a filter field. */
export function getStatFilterStatKey(
	field: StatFilterField
): StatSortKey | CyanophageStatSortKey | Mana2StatSortKey | 'likes' {
	if (field.key === 'likes') return 'likes';
	return field.statKey ?? (field.key as StatSortKey | CyanophageStatSortKey | Mana2StatSortKey);
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

/** All analyzer sort fields (display mode does not restrict sort options). */
export function getStatSortFieldsForMode(_mode?: StatsAnalyzerMode): readonly StatSortField[] {
	return ALL_STAT_SORT_FIELDS;
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
		const concrete = concreteAnalyzerForSort(analyzer);
		if (concrete === CYANOPHAGE_ANALYZER) return 'cyano-sfb';
		if (concrete === MANA2_ANALYZER) return 'mana-sfb';
		return 'sfb';
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
		alternate: stats.alternate,
		roll: stats.roll,
		redirect: stats.redirect,
		lh: stats.lh,
		rh: stats.rh,
		...Object.fromEntries(
			CYANOPHAGE_FINGER_STAT_KEYS.map((finger) => [finger, stats[finger]])
		)
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

export function getLayoutCyanophageStats(
	statsMaps: StatsMaps,
	layoutName: string
): CyanophageStats | undefined {
	const encoded = statsMaps.cyanophage?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeCyanophageStats(encoded);
}

export function getLayoutMana2Stats(
	statsMaps: StatsMaps,
	layoutName: string
): Mana2Stats | undefined {
	const encoded = statsMaps.mana2?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeMana2Stats(encoded);
}

export function getLayoutAnalyzerStats(
	statsMaps: StatsMaps,
	layoutName: string,
	analyzer: StatsAnalyzer = DEFAULT_STATS_ANALYZER,
	cyanophageCompatible = true
): MonkeyracerStats | CyanophageStats | Mana2Stats | undefined {
	if (analyzer === CYANOPHAGE_ANALYZER) {
		if (!cyanophageCompatible) return undefined;
		return getLayoutCyanophageStats(statsMaps, layoutName);
	}
	if (analyzer === MANA2_ANALYZER) {
		return getLayoutMana2Stats(statsMaps, layoutName);
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
	if (field.analyzer === MANA2_ANALYZER) {
		return deriveMana2Stats(analyzerStats as Mana2Stats)[field.key as Mana2StatSortKey];
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

/** Asc/desc marker used in place of `:` on the active sort field’s label. */
function sortOrderSuffix(sorted: boolean, sortOrder?: SortOrder | null): string {
	if (!sorted || !sortOrder) return ':';
	return sortOrder === 'asc' ? '▲' : '▼';
}

/** Like {@link formatStatLabel}, but swaps a trailing `:` for ▲/▼ when sorted. */
function formatSortStatLabel(
	labelWithColon: string,
	sorted: boolean,
	sortOrder?: SortOrder | null,
	width?: number
): string {
	const suffix = sortOrderSuffix(sorted, sortOrder);
	const label = sorted ? labelWithColon.replace(/:$/, suffix) : labelWithColon;
	return formatStatLabel(label, width);
}

function formatFingerSortLabel(
	finger: string,
	sorted: boolean,
	sortOrder?: SortOrder | null
): string {
	return `${finger}${sortOrderSuffix(sorted, sortOrder)} `;
}

/** Card/stat highlight: analyzer filter colors, or yellow for the active sort field. */
export type StatsHighlightTone = 'cmini' | 'cyanophage' | 'mana2' | 'sort';

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
): Set<StatSortKey | CyanophageStatSortKey | Mana2StatSortKey> {
	const keys = new Set<StatSortKey | CyanophageStatSortKey | Mana2StatSortKey>();
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

/** Analyzers that have at least one non-empty limit in `limits`. */
export function analyzersNeededForLimits(
	limits: Record<StatLimitKey, { value: string }>
): StatsAnalyzer[] {
	const needed: StatsAnalyzer[] = [];
	for (const { value: analyzer } of STAT_ANALYZERS) {
		const hasLimits = getStatFilterFieldsForAnalyzer(analyzer).some(
			(field) => limits[field.key]?.value.trim() !== ''
		);
		if (hasLimits) needed.push(analyzer);
	}
	return needed;
}

export type AnalyzersNeededForLoadOptions = {
	/** When true, include analyzers shown by `displayMode`. */
	showStats?: boolean;
	displayMode?: StatsAnalyzerMode;
	/** Applied (or draft) limits — analyzers with active values are included. */
	limits?: Record<StatLimitKey, { value: string }>;
	/** Include the analyzer that owns this sort key, if any. */
	sortBy?: SortBy;
};

/**
 * Concrete analyzers that must be loaded for display, filtering, and/or sort.
 * Order follows `STAT_ANALYZERS`.
 */
export function analyzersNeededForLoad(options: AnalyzersNeededForLoadOptions): StatsAnalyzer[] {
	const needed = new Set<StatsAnalyzer>();

	if (options.showStats && options.displayMode) {
		for (const analyzer of resolveStatsAnalyzers(options.displayMode)) {
			needed.add(analyzer);
		}
	}

	if (options.limits) {
		for (const analyzer of analyzersNeededForLimits(options.limits)) {
			needed.add(analyzer);
		}
	}

	if (options.sortBy) {
		const sortAnalyzer = getStatSortAnalyzer(options.sortBy);
		if (sortAnalyzer) needed.add(sortAnalyzer);
	}

	return STAT_ANALYZERS.map((entry) => entry.value).filter((analyzer) => needed.has(analyzer));
}

/** Caution when a hidden analyzer still has active applied filters. */
export function getHiddenAnalyzerFilterCaution(
	displayMode: StatsAnalyzerMode,
	limits: Record<StatLimitKey, { value: string }>,
	options?: { includeLikes?: boolean }
): { analyzer: StatsAnalyzer; count: number; text: string } | null {
	const visible = new Set(resolveStatsAnalyzers(displayMode));
	for (const { value: analyzer } of STAT_ANALYZERS) {
		if (visible.has(analyzer)) continue;
		const count = countActiveStatFiltersForAnalyzer(limits, analyzer, {
			includeLikes: Boolean(options?.includeLikes) && analyzer === DEFAULT_STATS_ANALYZER
		});
		if (count === 0) continue;
		const label = analyzerShortLabel(analyzer);
		return {
			analyzer,
			count,
			text: `${label} stats are hidden, but its filters (${count}) still affect which layouts appear.`
		};
	}
	return null;
}

/** Shared filter/sort highlight keys for layout cards (compute once per list). */
export function getStatCardHighlightState(
	limits: Record<StatLimitKey, { value: string }>,
	sortBy: SortBy
): {
	botFilterHighlightKeys: Set<StatSortKey>;
	cyanophageFilterHighlightKeys: Set<CyanophageStatSortKey>;
	mana2FilterHighlightKeys: Set<Mana2StatSortKey>;
	botSortHighlightKey: StatSortKey | null;
	cyanophageSortHighlightKey: CyanophageStatSortKey | null;
	mana2SortHighlightKey: Mana2StatSortKey | null;
} {
	const sortField = getStatSortField(sortBy);
	return {
		botFilterHighlightKeys: getActiveFilterStatKeys(limits, DEFAULT_STATS_ANALYZER) as Set<StatSortKey>,
		cyanophageFilterHighlightKeys: getActiveFilterStatKeys(
			limits,
			CYANOPHAGE_ANALYZER
		) as Set<CyanophageStatSortKey>,
		mana2FilterHighlightKeys: getActiveFilterStatKeys(
			limits,
			MANA2_ANALYZER
		) as Set<Mana2StatSortKey>,
		botSortHighlightKey:
			sortField?.analyzer === DEFAULT_STATS_ANALYZER ? (sortField.key as StatSortKey) : null,
		cyanophageSortHighlightKey:
			sortField?.analyzer === CYANOPHAGE_ANALYZER
				? (sortField.key as CyanophageStatSortKey)
				: null,
		mana2SortHighlightKey:
			sortField?.analyzer === MANA2_ANALYZER ? (sortField.key as Mana2StatSortKey) : null
	};
}

/**
 * Whether higher values are better for a sortable stat key, or `null` when the
 * metric is not ranked (hand/finger balance, etc.).
 */
export function isHigherBetterStatKey(
	key: StatSortKey | CyanophageStatSortKey | Mana2StatSortKey,
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

function formatMana2RawDiffField(delta: number, width: number): string {
	const sign = delta > 0 ? '+' : delta < 0 ? '-' : ' ';
	const body = Math.abs(delta).toFixed(3);
	return `${sign}${body}`.padStart(width);
}

const MANA2_RAW_DIFF_KEYS = new Set<Mana2StatSortKey>(['lsb', 'lss', 'vsb', 'vss']);

function mana2Diff(
	newStats: DerivedMana2Stats,
	oldStats: DerivedMana2Stats,
	key: Mana2StatSortKey,
	width: number
): StatsBlockSegment {
	const delta = newStats[key] - oldStats[key];
	const higherIsBetter = isHigherBetterStatKey(key, MANA2_ANALYZER);
	if (MANA2_RAW_DIFF_KEYS.has(key)) {
		const text = formatMana2RawDiffField(delta, width);
		return { text, tone: toneForStatDelta(delta, higherIsBetter, text) };
	}
	return diffSegment(delta, width, higherIsBetter, 'percent');
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

/** Mana2 compare block: `new − old` (stretch/scissor use raw units). */
export function buildMana2StatsDiffBlockLines(
	newStats: DerivedMana2Stats,
	oldStats: DerivedMana2Stats
): StatsBlockSegment[][] {
	const pair = (
		label: string,
		bigKey: Mana2StatSortKey,
		skipKey: Mana2StatSortKey
	): StatsBlockSegment[] => [
		{ text: formatStatLabel(`${label}:`, MANA2_PAIR_LABEL_WIDTH) },
		mana2Diff(newStats, oldStats, bigKey, 7),
		{ text: ' | ' },
		mana2Diff(newStats, oldStats, skipKey, 7)
	];

	const flow = (label: string): StatsBlockSegment => ({
		text: formatStatLabel(`${label}:`, MANA2_FLOW_LABEL_WIDTH)
	});

	return [
		pair('Same Finger', 'sfb', 'sfs'),
		pair('Same Key', 'skb', 'sks'),
		pair('Stretch', 'lsb', 'lss'),
		pair('Scissor', 'vsb', 'vss'),
		[{ text: '' }],
		[
			flow('Alt'),
			mana2Diff(newStats, oldStats, 'alt', 7),
			{ text: ' (noT ' },
			mana2Diff(newStats, oldStats, 'altNoThumbs', 7),
			{ text: ')' }
		],
		[flow('Alt&SFS'), mana2Diff(newStats, oldStats, 'altSfs', 7)],
		[
			flow('Redirect'),
			mana2Diff(newStats, oldStats, 'redirect', 7),
			{ text: ' (noT ' },
			mana2Diff(newStats, oldStats, 'redirectNoThumbs', 7),
			{ text: ')' }
		],
		[
			flow('R&S/Wk'),
			mana2Diff(newStats, oldStats, 'redirectSfs', 6),
			{ text: ' | ' },
			mana2Diff(newStats, oldStats, 'redirectWeak', 6),
			{ text: ' | ' },
			mana2Diff(newStats, oldStats, 'redirectSfsWeak', 6)
		],
		[
			flow('Roll'),
			mana2Diff(newStats, oldStats, 'roll', 7),
			{ text: ' (noT ' },
			mana2Diff(newStats, oldStats, 'rollNoThumbs', 7),
			{ text: ')' }
		],
		[
			flow('In/Out'),
			mana2Diff(newStats, oldStats, 'inroll2', 6),
			{ text: ' | ' },
			mana2Diff(newStats, oldStats, 'outroll2', 6),
			{ text: ' | ' },
			mana2Diff(newStats, oldStats, 'inroll3', 6),
			{ text: ' | ' },
			mana2Diff(newStats, oldStats, 'outroll3', 6)
		],
		[{ text: '' }],
		[
			{ text: formatStatLabel('LH/RH:', MANA2_HAND_LABEL_WIDTH) },
			mana2Diff(newStats, oldStats, 'lh', 7),
			{ text: ' | ' },
			mana2Diff(newStats, oldStats, 'rh', 7)
		],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			return [
				{ text: `${left}: ` },
				mana2Diff(newStats, oldStats, left, 6),
				{ text: '    ' },
				{ text: `${right}: ` },
				mana2Diff(newStats, oldStats, right, 6)
			];
		}),
		[
			{ text: 'LT: ' },
			mana2Diff(newStats, oldStats, 'LT', 6),
			{ text: '    ' },
			{ text: 'RT: ' },
			mana2Diff(newStats, oldStats, 'RT', 6)
		]
	];
}

export function getStatSortHighlightKey(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatSortKey | CyanophageStatSortKey | Mana2StatSortKey | undefined {
	return getStatSortField(sortBy, analyzer)?.key;
}

export function formatCyanophageStatValue(value: number): string {
	return value.toFixed(1);
}

function formatMana2RawValue(value: number): string {
	return value.toFixed(3);
}

export function buildMana2StatsBlockLines(
	stats: DerivedMana2Stats,
	highlightKeys?: ReadonlySet<Mana2StatSortKey> | Mana2StatSortKey | null,
	sortHighlightKey?: Mana2StatSortKey | null,
	sortOrder?: SortOrder | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: Mana2StatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'mana2' : undefined;
	const sortHl = (...candidates: Mana2StatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;
	const sortLabel = (
		labelWithColon: string,
		width: number | undefined,
		...candidates: Mana2StatSortKey[]
	): StatsBlockSegment => {
		const highlight = sortHl(...candidates);
		return {
			text: formatSortStatLabel(labelWithColon, Boolean(highlight), sortOrder, width),
			highlight
		};
	};

	const pair = (
		label: string,
		bigKey: Mana2StatSortKey,
		bigVal: number,
		skipKey: Mana2StatSortKey,
		skipVal: number,
		raw = false
	): StatsBlockSegment[] => [
		sortLabel(`${label}:`, MANA2_PAIR_LABEL_WIDTH, bigKey, skipKey),
		{
			text: (raw ? formatMana2RawValue(bigVal) : formatStatPercent(bigVal)).padStart(7),
			highlight: filterHl(bigKey)
		},
		{ text: ' | ' },
		{
			text: (raw ? formatMana2RawValue(skipVal) : formatStatPercent(skipVal)).padStart(7),
			highlight: filterHl(skipKey)
		}
	];

	return [
		pair('Same Finger', 'sfb', stats.sfb, 'sfs', stats.sfs),
		pair('Same Key', 'skb', stats.skb, 'sks', stats.sks),
		pair('Stretch', 'lsb', stats.lsb, 'lss', stats.lss, true),
		pair('Scissor', 'vsb', stats.vsb, 'vss', stats.vss, true),
		[{ text: '' }],
		[
			sortLabel('Alt:', MANA2_FLOW_LABEL_WIDTH, 'alt'),
			{ text: formatStatField(stats.alt, 7), highlight: filterHl('alt') },
			{ text: ' (noT ' },
			{ text: formatStatField(stats.altNoThumbs, 7), highlight: filterHl('altNoThumbs') },
			{ text: ')' }
		],
		[
			sortLabel('Alt&SFS:', MANA2_FLOW_LABEL_WIDTH, 'altSfs'),
			{ text: formatStatField(stats.altSfs, 7), highlight: filterHl('altSfs') }
		],
		[
			sortLabel('Redirect:', MANA2_FLOW_LABEL_WIDTH, 'redirect'),
			{ text: formatStatField(stats.redirect, 7), highlight: filterHl('redirect') },
			{ text: ' (noT ' },
			{
				text: formatStatField(stats.redirectNoThumbs, 7),
				highlight: filterHl('redirectNoThumbs')
			},
			{ text: ')' }
		],
		[
			sortLabel(
				'R&S/Wk:',
				MANA2_FLOW_LABEL_WIDTH,
				'redirectSfs',
				'redirectWeak',
				'redirectSfsWeak'
			),
			{ text: formatStatField(stats.redirectSfs, 6), highlight: filterHl('redirectSfs') },
			{ text: ' | ' },
			{ text: formatStatField(stats.redirectWeak, 6), highlight: filterHl('redirectWeak') },
			{ text: ' | ' },
			{
				text: formatStatField(stats.redirectSfsWeak, 6),
				highlight: filterHl('redirectSfsWeak')
			}
		],
		[
			sortLabel('Roll:', MANA2_FLOW_LABEL_WIDTH, 'roll'),
			{ text: formatStatField(stats.roll, 7), highlight: filterHl('roll') },
			{ text: ' (noT ' },
			{ text: formatStatField(stats.rollNoThumbs, 7), highlight: filterHl('rollNoThumbs') },
			{ text: ')' }
		],
		[
			sortLabel('In/Out:', MANA2_FLOW_LABEL_WIDTH, 'inroll2', 'outroll2', 'inroll3', 'outroll3'),
			{ text: formatStatField(stats.inroll2, 6), highlight: filterHl('inroll2') },
			{ text: ' | ' },
			{ text: formatStatField(stats.outroll2, 6), highlight: filterHl('outroll2') },
			{ text: ' | ' },
			{ text: formatStatField(stats.inroll3, 6), highlight: filterHl('inroll3') },
			{ text: ' | ' },
			{ text: formatStatField(stats.outroll3, 6), highlight: filterHl('outroll3') }
		],
		[{ text: '' }],
		[
			sortLabel('LH/RH:', MANA2_HAND_LABEL_WIDTH, 'lh', 'rh'),
			{ text: formatStatField(stats.lh, 7), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 7), highlight: filterHl('rh') }
		],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			const leftHl = sortHl(left);
			const rightHl = sortHl(right);
			return [
				{
					text: formatFingerSortLabel(left, Boolean(leftHl), sortOrder),
					highlight: leftHl
				},
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{
					text: formatFingerSortLabel(right, Boolean(rightHl), sortOrder),
					highlight: rightHl
				},
				{ text: formatStatField(stats[right], 6), highlight: filterHl(right) }
			];
		}),
		(() => {
			const ltHl = sortHl('LT');
			const rtHl = sortHl('RT');
			return [
				{ text: formatFingerSortLabel('LT', Boolean(ltHl), sortOrder), highlight: ltHl },
				{ text: formatStatField(stats.LT, 6), highlight: filterHl('LT') },
				{ text: '    ' },
				{ text: formatFingerSortLabel('RT', Boolean(rtHl), sortOrder), highlight: rtHl },
				{ text: formatStatField(stats.RT, 6), highlight: filterHl('RT') }
			];
		})()
	];
}

/** Placeholder with the same line count as a mana2 stats block. */
export function formatMana2StatsLoadingBlock(): string {
	return [
		'LOADING STATS',
		'…',
		...Array(Math.max(0, MANA2_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Placeholder when mana2 has no stats for this layout. */
export function formatMana2StatsUnavailableBlock(): string {
	return [
		'STATS UNAVAILABLE',
		'no mana2 stats for this layout',
		...Array(Math.max(0, MANA2_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

export function buildCyanophageStatsBlockLines(
	stats: DerivedCyanophageStats,
	highlightKeys?: ReadonlySet<CyanophageStatSortKey> | CyanophageStatSortKey | null,
	sortHighlightKey?: CyanophageStatSortKey | null,
	sortOrder?: SortOrder | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: CyanophageStatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'cyanophage' : undefined;
	const sortHl = (...candidates: CyanophageStatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;
	const sortLabel = (
		labelWithColon: string,
		width: number | undefined,
		...candidates: CyanophageStatSortKey[]
	): StatsBlockSegment => {
		const highlight = sortHl(...candidates);
		return {
			text: formatSortStatLabel(labelWithColon, Boolean(highlight), sortOrder, width),
			highlight
		};
	};

	return [
		[
			sortLabel('Total Word Effort:', CYANOPHAGE_STAT_LABEL_WIDTH, 'totalWordEffort'),
			{
				text: formatCyanophageStatValue(stats.totalWordEffort).padStart(6),
				highlight: filterHl('totalWordEffort')
			}
		],
		[
			sortLabel('Effort:', CYANOPHAGE_STAT_LABEL_WIDTH, 'effort'),
			{
				text: formatCyanophageStatValue(stats.effort).padStart(6),
				highlight: filterHl('effort')
			}
		],
		[{ text: '' }],
		[
			sortLabel('Same Finger Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH, 'sfb'),
			{ text: formatStatField(stats.sfb, 6), highlight: filterHl('sfb') }
		],
		[
			sortLabel('Skip Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH, 'sfs'),
			{ text: formatStatField(stats.sfs, 6), highlight: filterHl('sfs') }
		],
		[
			sortLabel('Lat Stretch Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH, 'lsb'),
			{ text: formatStatField(stats.lsb, 6), highlight: filterHl('lsb') }
		],
		[
			sortLabel('Scissors:', CYANOPHAGE_STAT_LABEL_WIDTH, 'scissors'),
			{ text: formatStatField(stats.scissors, 6), highlight: filterHl('scissors') }
		],
		[{ text: '' }],
		[
			sortLabel('LH/RH:', undefined, 'lh', 'rh'),
			{ text: formatStatField(stats.lh, 6), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: filterHl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			const leftHl = sortHl(left);
			const rightHl = sortHl(right);
			return [
				{
					text: formatFingerSortLabel(left, Boolean(leftHl), sortOrder),
					highlight: leftHl
				},
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{
					text: formatFingerSortLabel(right, Boolean(rightHl), sortOrder),
					highlight: rightHl
				},
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
	sortHighlightKey?: StatSortKey | null,
	sortOrder?: SortOrder | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: StatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'cmini' : undefined;
	const sortHl = (...candidates: StatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;
	const sortLabel = (
		labelWithColon: string,
		...candidates: StatSortKey[]
	): StatsBlockSegment => {
		const highlight = sortHl(...candidates);
		return {
			text: formatSortStatLabel(labelWithColon, Boolean(highlight), sortOrder),
			highlight
		};
	};

	const badHl = sortHl('badRedirect');

	return [
		[
			sortLabel('Alt:', 'alternate'),
			{ text: formatStatField(stats.alternate, 6), highlight: filterHl('alternate') }
		],
		[
			sortLabel('Rol:', 'roll', 'rollIn', 'rollOut'),
			{ text: formatStatField(stats.roll, 6), highlight: filterHl('roll') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rollIn, 6), highlight: filterHl('rollIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rollOut, 6), highlight: filterHl('rollOut') },
			{ text: ')' }
		],
		[
			sortLabel('One:', 'one', 'oneIn', 'oneOut'),
			{ text: formatStatField(stats.one, 6), highlight: filterHl('one') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.oneIn, 6), highlight: filterHl('oneIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.oneOut, 6), highlight: filterHl('oneOut') },
			{ text: ')' }
		],
		[
			sortLabel('Rtl:', 'rtl', 'rtlIn', 'rtlOut'),
			{ text: formatStatField(stats.rtl, 6), highlight: filterHl('rtl') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rtlIn, 6), highlight: filterHl('rtlIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rtlOut, 6), highlight: filterHl('rtlOut') },
			{ text: ')' }
		],
		[
			sortLabel('Red:', 'red'),
			{ text: formatStatField(stats.red, 6), highlight: filterHl('red') },
			{ text: ' (' },
			{
				text: `Bad${sortOrderSuffix(Boolean(badHl), sortOrder)}`,
				highlight: badHl
			},
			{ text: ' ' },
			{ text: formatStatField(stats.badRedirect, 9), highlight: filterHl('badRedirect') },
			{ text: ')' }
		],
		[{ text: '' }],
		[
			sortLabel('SFB:', 'sfb'),
			{ text: formatStatField(stats.sfb, 6), highlight: filterHl('sfb') }
		],
		[
			sortLabel('SFS:', 'sfs', 'dsfbRed', 'dsfbAlt'),
			{ text: formatStatField(stats.sfs, 6), highlight: filterHl('sfs') },
			{ text: ' (Red/Alt: ' },
			{ text: formatStatField(stats.dsfbRed, 5), highlight: filterHl('dsfbRed') },
			{ text: ' | ' },
			{ text: formatStatField(stats.dsfbAlt, 5), highlight: filterHl('dsfbAlt') },
			{ text: ')' }
		],
		[
			sortLabel('LH/RH:', 'lh', 'rh'),
			{ text: formatStatField(stats.lh, 6), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: filterHl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			const leftHl = sortHl(left);
			const rightHl = sortHl(right);
			return [
				{
					text: formatFingerSortLabel(left, Boolean(leftHl), sortOrder),
					highlight: leftHl
				},
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{
					text: formatFingerSortLabel(right, Boolean(rightHl), sortOrder),
					highlight: rightHl
				},
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
