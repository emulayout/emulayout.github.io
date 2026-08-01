import {
	flattenGeneralStatFilterGroups,
	type AnalyzerStatFilterCatalog,
	type GeneralStatFilterGroup,
	type StatFilterField
} from './shared';

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
					chipLabel: 'Stretch big',
					title: 'Stretch Bigrams',
					hint: 'Weighted lateral stretch: same-hand keys that are horizontally far apart. Worse when the stretch is shared by fewer fingers. Lower is better.',
					unit: 'raw'
				},
				{
					key: 'mana-lss',
					statKey: 'lss',
					label: 'Skip',
					chipLabel: 'Stretch skip',
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
					chipLabel: 'Scissor big',
					title: 'Scissor Bigrams',
					hint: 'Weighted vertical scissor: adjacent fingers separated by row. Penalty depends on which finger is above/below. Lower is better.',
					unit: 'raw'
				},
				{
					key: 'mana-vss',
					statKey: 'vss',
					label: 'Skip',
					chipLabel: 'Scissor skip',
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
					chipLabel: 'Alt NoT',
					title: 'No thumbs',
					hint: 'Alternation counted only on trigrams that do not use a thumb key.'
				},
				{
					key: 'altSfs',
					label: 'A&S',
					chipLabel: 'Alt & SFS',
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
					chipLabel: 'Red NoT',
					title: 'No thumbs',
					hint: 'Redirects that do not involve a thumb key.'
				},
				{
					key: 'redirectWeak',
					label: 'Weak',
					chipLabel: 'Weak red',
					title: 'Weak redirect',
					hint: 'Redirects using only middle/ring/pinky (no index or thumb). Especially awkward; lower is better.'
				}
			],
			[
				{
					key: 'redirectSfs',
					label: 'R&S',
					chipLabel: 'Red & SFS',
					title: 'Redirect & SFS',
					hint: 'Redirect where the first and last keys use the same finger. Lower is better.'
				},
				{
					key: 'redirectSfsWeak',
					label: 'W&S',
					chipLabel: 'Weak red & SFS',
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
					chipLabel: 'Roll in 2',
					title: 'Inroll 2',
					hint: 'Two same-hand keys rolling inward (pinky → index), plus a hand switch. Example shape: QWERTY “oif”.'
				},
				{
					key: 'outroll2',
					label: 'Out2',
					chipLabel: 'Roll out 2',
					title: 'Outroll 2',
					hint: 'Two same-hand keys rolling outward (index → pinky), plus a hand switch.'
				}
			],
			[
				{
					key: 'rollNoThumbs',
					label: 'NoT',
					chipLabel: 'Roll NoT',
					title: 'No thumbs',
					hint: 'Roll total excluding trigrams that use a thumb key.'
				},
				{
					key: 'inroll3',
					label: 'In3',
					chipLabel: 'Roll in 3',
					title: 'Inroll 3',
					hint: 'Three same-hand keys rolling inward (pinky → index) with no same-finger use.'
				},
				{
					key: 'outroll3',
					label: 'Out3',
					chipLabel: 'Roll out 3',
					title: 'Outroll 3',
					hint: 'Three same-hand keys rolling outward (index → pinky) with no same-finger use.'
				}
			],
			[
				{
					key: 'goodroll',
					label: 'Good',
					chipLabel: 'Good roll',
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
					chipLabel: 'Off-pinky',
					title: 'Off pinky',
					hint: 'Pinky usage off the home row. Stretchy pinky work; lower is usually preferred.'
				}
			]
		]
	}
];

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

export const MANA2_GENERAL_STAT_FILTER_FIELDS = flattenGeneralStatFilterGroups(
	MANA2_GENERAL_STAT_FILTER_GROUPS
);

export const MANA2_HAND_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...MANA2_LEFT_HAND_STAT_FILTER_FIELDS,
	...MANA2_RIGHT_HAND_STAT_FILTER_FIELDS
];

export const MANA2_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...MANA2_GENERAL_STAT_FILTER_FIELDS,
	...MANA2_HAND_STAT_FILTER_FIELDS
];

export const MANA2_STAT_FILTER_CATALOG = {
	generalGroups: MANA2_GENERAL_STAT_FILTER_GROUPS,
	generalFields: MANA2_GENERAL_STAT_FILTER_FIELDS,
	leftHandFields: MANA2_LEFT_HAND_STAT_FILTER_FIELDS,
	rightHandFields: MANA2_RIGHT_HAND_STAT_FILTER_FIELDS,
	handFields: MANA2_HAND_STAT_FILTER_FIELDS,
	fields: MANA2_STAT_FILTER_FIELDS
} satisfies AnalyzerStatFilterCatalog;
