import {
	flattenGeneralStatFilterGroups,
	type AnalyzerStatFilterCatalog,
	type GeneralStatFilterGroup,
	type StatFilterField
} from './shared';

/**
 * General stat limits in titled groups; each row has up to three related fields
 * (empty cells omitted at render time).
 */
export const CMINI_GENERAL_STAT_FILTER_GROUPS: readonly GeneralStatFilterGroup[] = [
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
					chipLabel: 'Roll',
					title: 'Roll',
					hint: 'Two same-hand keys rolling in one direction, then the other hand. Comfortable “drumming” motions; higher is better.'
				},
				{
					key: 'rollIn',
					label: 'In',
					chipLabel: 'Roll in',
					title: 'Roll in',
					hint: 'Rolls that move inward (pinky → index) on the rolling hand.'
				},
				{
					key: 'rollOut',
					label: 'Out',
					chipLabel: 'Roll out',
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
					chipLabel: 'One-hand',
					title: 'One-hand',
					hint: 'Trigrams typed entirely on one hand (no hand switch). Often slower than rolls/alts.'
				},
				{
					key: 'oneIn',
					label: 'In',
					chipLabel: 'One-hand in',
					title: 'One-hand in',
					hint: 'One-hand trigrams whose finger motion trends inward (pinky → index).'
				},
				{
					key: 'oneOut',
					label: 'Out',
					chipLabel: 'One-hand out',
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
					chipLabel: 'Roll total',
					title: 'Roll total',
					hint: 'Combined roll rate (roll + related roll totals in cmini’s Rtl metric). Higher means more rolling flow.'
				},
				{
					key: 'rtlIn',
					label: 'In',
					chipLabel: 'Roll total in',
					title: 'Roll total in',
					hint: 'Inward portion of the roll-total metric (pinky → index).'
				},
				{
					key: 'rtlOut',
					label: 'Out',
					chipLabel: 'Roll total out',
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
					chipLabel: 'Bad red',
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
					chipLabel: 'SFS red',
					title: 'Same-finger skip redirect',
					hint: 'Same-finger skipgrams that also form a redirect pattern. Especially awkward; lower is better.'
				},
				{
					key: 'dsfbAlt',
					label: 'Alt',
					chipLabel: 'SFS alt',
					title: 'Same-finger skip alternate',
					hint: 'Same-finger skipgrams that also form an alternation (hand switch in the middle). Lower is better.'
				}
			]
		]
	}
];

export const CMINI_LEFT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'lh', label: 'Hand' },
	{ key: 'LI', label: 'Index' },
	{ key: 'LM', label: 'Middle' },
	{ key: 'LR', label: 'Ring' },
	{ key: 'LP', label: 'Pinky' },
	{ key: 'LT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

export const CMINI_RIGHT_HAND_STAT_FILTER_FIELDS = [
	{ key: 'rh', label: 'Hand' },
	{ key: 'RI', label: 'Index' },
	{ key: 'RM', label: 'Middle' },
	{ key: 'RR', label: 'Ring' },
	{ key: 'RP', label: 'Pinky' },
	{ key: 'RT', label: 'Thumb' }
] as const satisfies readonly StatFilterField[];

export const CMINI_GENERAL_STAT_FILTER_FIELDS = flattenGeneralStatFilterGroups(
	CMINI_GENERAL_STAT_FILTER_GROUPS
);

export const CMINI_HAND_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...CMINI_LEFT_HAND_STAT_FILTER_FIELDS,
	...CMINI_RIGHT_HAND_STAT_FILTER_FIELDS
];

export const CMINI_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...CMINI_GENERAL_STAT_FILTER_FIELDS,
	...CMINI_HAND_STAT_FILTER_FIELDS
];

export const CMINI_STAT_FILTER_CATALOG = {
	generalGroups: CMINI_GENERAL_STAT_FILTER_GROUPS,
	generalFields: CMINI_GENERAL_STAT_FILTER_FIELDS,
	leftHandFields: CMINI_LEFT_HAND_STAT_FILTER_FIELDS,
	rightHandFields: CMINI_RIGHT_HAND_STAT_FILTER_FIELDS,
	handFields: CMINI_HAND_STAT_FILTER_FIELDS,
	fields: CMINI_STAT_FILTER_FIELDS
} satisfies AnalyzerStatFilterCatalog;
