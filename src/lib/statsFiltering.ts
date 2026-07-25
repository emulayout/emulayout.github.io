import { CYANOPHAGE_ANALYZER, MANA2_ANALYZER, type StatsAnalyzer } from '$lib/statsAnalyzers';
import type { CyanophageStatSortKey, Mana2StatSortKey, StatSortKey } from '$lib/statsDerivation';

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

export function getStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
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
