import type { LayoutCorpusStats, LayoutStatsMap } from '$lib/layout';

/** Default corpus for layout stats (matches common cmini bot preference). */
export const DEFAULT_STATS_CORPUS = 'monkeyracer';

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
	'dsfb-alt'
] as const satisfies readonly (keyof LayoutCorpusStats)[];

export const STAT_VALUE_SCALE = 10_000;
export const COMPACT_STAT_FIELD_COUNT = BOT_STAT_KEYS.length;

export interface DerivedBotStats {
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
	sfs: number;
	dsfbRed: number;
	dsfbAlt: number;
}

export type StatSortKey = keyof DerivedBotStats;

export interface StatSortField {
	value: string;
	label: string;
	key: StatSortKey;
}

/** Sortable bot stats (monkeyracer corpus). */
export const STAT_SORT_FIELDS = [
	{ value: 'alternate', label: 'Alternate', key: 'alternate' },
	{ value: 'roll', label: 'Roll', key: 'roll' },
	{ value: 'roll-in', label: 'Roll in', key: 'rollIn' },
	{ value: 'roll-out', label: 'Roll out', key: 'rollOut' },
	{ value: 'one', label: 'One-hand', key: 'one' },
	{ value: 'one-in', label: 'One-hand in', key: 'oneIn' },
	{ value: 'one-out', label: 'One-hand out', key: 'oneOut' },
	{ value: 'roll-total', label: 'Roll total', key: 'rtl' },
	{ value: 'roll-total-in', label: 'Roll total in', key: 'rtlIn' },
	{ value: 'roll-total-out', label: 'Roll total out', key: 'rtlOut' },
	{ value: 'redirect', label: 'Redirect', key: 'red' },
	{ value: 'bad-redirect', label: 'Bad redirect', key: 'badRedirect' },
	{ value: 'same-finger-skip', label: 'Same-finger skip', key: 'sfs' },
	{ value: 'same-finger-skip-redirect', label: 'Same-finger skip redirect', key: 'dsfbRed' },
	{ value: 'same-finger-skip-alternate', label: 'Same-finger skip alternate', key: 'dsfbAlt' }
] as const satisfies readonly StatSortField[];

export type StatSortBy = (typeof STAT_SORT_FIELDS)[number]['value'];

export type LayoutSortBy = 'name' | 'date';

export type SortBy = LayoutSortBy | StatSortBy;

export type SortOrder = 'asc' | 'desc';

const STAT_SORT_FIELD_BY_VALUE = new Map<string, StatSortField>(
	STAT_SORT_FIELDS.map((field) => [field.value, field])
);

const SORT_BY_VALUES = new Set<string>(['name', 'date', ...STAT_SORT_FIELDS.map((field) => field.value)]);

const LEGACY_SORT_BY_ORDER: Record<string, { sortBy: SortBy; sortOrder: SortOrder }> = {
	name: { sortBy: 'name', sortOrder: 'asc' },
	'date-asc': { sortBy: 'date', sortOrder: 'asc' },
	'date-desc': { sortBy: 'date', sortOrder: 'desc' },
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

export function isStatSortBy(sortBy: SortBy): sortBy is StatSortBy {
	return STAT_SORT_FIELD_BY_VALUE.has(sortBy);
}

export function getStatSortField(sortBy: SortBy): StatSortField | undefined {
	return STAT_SORT_FIELD_BY_VALUE.get(sortBy);
}

export function parseLegacySortParam(
	sort: string
): { sortBy: SortBy; sortOrder: SortOrder } | undefined {
	if (sort in LEGACY_SORT_BY_ORDER) {
		return LEGACY_SORT_BY_ORDER[sort];
	}
	if (isSortBy(sort)) {
		return { sortBy: sort, sortOrder: 'desc' };
	}
	return undefined;
}

export function decodeCorpusStats(values: number[]): LayoutCorpusStats | undefined {
	if (values.length !== COMPACT_STAT_FIELD_COUNT) {
		return undefined;
	}

	const stats = {} as LayoutCorpusStats;
	for (let i = 0; i < BOT_STAT_KEYS.length; i++) {
		stats[BOT_STAT_KEYS[i]] = values[i] / STAT_VALUE_SCALE;
	}
	return stats;
}

export function getLayoutCorpusStats(
	statsMap: LayoutStatsMap,
	layoutName: string,
	corpus = DEFAULT_STATS_CORPUS
): LayoutCorpusStats | undefined {
	if (corpus !== DEFAULT_STATS_CORPUS) return undefined;
	const encoded = statsMap[layoutName];
	if (encoded === undefined) return undefined;
	return decodeCorpusStats(encoded);
}

export function deriveBotStats(stats: LayoutCorpusStats): DerivedBotStats {
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
		dsfbRed: stats['dsfb-red'],
		dsfbAlt: stats['dsfb-alt'],
		sfs: stats['dsfb-red'] + stats['dsfb-alt']
	};
}

/** Line count of `formatBotStatsBlock` output — keep in sync with `.stats-block` in layout.css. */
export const STATS_BLOCK_LINE_COUNT = 8;

export function formatStatPercent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

function formatStatField(value: number, width: number): string {
	return formatStatPercent(value).padStart(width);
}

function formatStatLabel(label: string): string {
	return `${label} `;
}

export interface StatsBlockSegment {
	text: string;
	highlight?: boolean;
}

export function getStatSortHighlightKey(sortBy: SortBy): StatSortKey | undefined {
	return getStatSortField(sortBy)?.key;
}

/** Lines of segments for rendering; optional highlight on the active sort stat. */
export function buildBotStatsBlockLines(
	stats: DerivedBotStats,
	highlightKey?: StatSortKey,
	corpus = DEFAULT_STATS_CORPUS
): StatsBlockSegment[][] {
	const hl = (key: StatSortKey): boolean => highlightKey === key;

	return [
		[{ text: `${corpus.toUpperCase()}:` }],
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
			{ text: formatStatLabel('SFS:') },
			{ text: formatStatField(stats.sfs, 6), highlight: hl('sfs') },
			{ text: ' (Red/Alt: ' },
			{ text: formatStatField(stats.dsfbRed, 5), highlight: hl('dsfbRed') },
			{ text: ' | ' },
			{ text: formatStatField(stats.dsfbAlt, 5), highlight: hl('dsfbAlt') },
			{ text: ')' }
		]
	];
}

/** Fixed-width block matching cmini Discord bot layout (minus SFB and LH/RH). */
export function formatBotStatsBlock(
	stats: DerivedBotStats,
	corpus = DEFAULT_STATS_CORPUS
): string {
	return buildBotStatsBlockLines(stats, undefined, corpus)
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
		'stats synced nightly',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}
