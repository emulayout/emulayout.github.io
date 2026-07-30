import {
	flattenGeneralStatFilterGroups,
	type AnalyzerStatFilterCatalog,
	type GeneralStatFilterGroup,
	type StatFilterField
} from './shared';

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
			],
			[
				{
					key: 'cyano-distance',
					statKey: 'distance',
					label: 'Distance',
					title: 'Finger Distance',
					hint: 'Total finger travel through each word, using Cyanophage’s board geometry and normalization. Lower is better.',
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

export const CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS = flattenGeneralStatFilterGroups(
	CYANOPHAGE_GENERAL_STAT_FILTER_GROUPS
);

export const CYANOPHAGE_HAND_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS,
	...CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS
];

export const CYANOPHAGE_STAT_FILTER_FIELDS: readonly StatFilterField[] = [
	...CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS,
	...CYANOPHAGE_HAND_STAT_FILTER_FIELDS
];

export const CYANOPHAGE_STAT_FILTER_CATALOG = {
	generalGroups: CYANOPHAGE_GENERAL_STAT_FILTER_GROUPS,
	generalFields: CYANOPHAGE_GENERAL_STAT_FILTER_FIELDS,
	leftHandFields: CYANOPHAGE_LEFT_HAND_STAT_FILTER_FIELDS,
	rightHandFields: CYANOPHAGE_RIGHT_HAND_STAT_FILTER_FIELDS,
	handFields: CYANOPHAGE_HAND_STAT_FILTER_FIELDS,
	fields: CYANOPHAGE_STAT_FILTER_FIELDS
} satisfies AnalyzerStatFilterCatalog;
