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

export interface StatSortOption {
	value: string;
	label: string;
	key: StatSortKey;
	/** When true, higher values sort first (matches cmini !rank defaults). */
	descending: boolean;
}

/** Sort options for bot stats (monkeyracer corpus). */
export const STAT_SORT_OPTIONS = [
	{ value: 'alternate-desc', label: 'Alternate (high → low)', key: 'alternate', descending: true },
	{ value: 'roll-desc', label: 'Roll (high → low)', key: 'roll', descending: true },
	{ value: 'roll-in-desc', label: 'Roll in (high → low)', key: 'rollIn', descending: true },
	{ value: 'roll-out-desc', label: 'Roll out (high → low)', key: 'rollOut', descending: true },
	{ value: 'one-desc', label: 'One-hand (high → low)', key: 'one', descending: true },
	{ value: 'one-in-desc', label: 'One-hand in (high → low)', key: 'oneIn', descending: true },
	{ value: 'one-out-desc', label: 'One-hand out (high → low)', key: 'oneOut', descending: true },
	{ value: 'rtl-desc', label: 'Roll total (high → low)', key: 'rtl', descending: true },
	{ value: 'rtl-in-desc', label: 'Roll total in (high → low)', key: 'rtlIn', descending: true },
	{ value: 'rtl-out-desc', label: 'Roll total out (high → low)', key: 'rtlOut', descending: true },
	{ value: 'red-asc', label: 'Redirect (low → high)', key: 'red', descending: false },
	{ value: 'bad-redirect-asc', label: 'Bad redirect (low → high)', key: 'badRedirect', descending: false },
	{ value: 'sfs-asc', label: 'Same-finger skip (low → high)', key: 'sfs', descending: false },
	{ value: 'dsfb-red-asc', label: 'Same-finger skip redirect (low → high)', key: 'dsfbRed', descending: false },
	{
		value: 'dsfb-alt-asc',
		label: 'Same-finger skip alternate (low → high)',
		key: 'dsfbAlt',
		descending: false
	}
] as const satisfies readonly StatSortOption[];

export type StatSortOptionValue = (typeof STAT_SORT_OPTIONS)[number]['value'];

export type LayoutSortOption = 'name' | 'date-asc' | 'date-desc';

export type SortOption = LayoutSortOption | StatSortOptionValue;

const STAT_SORT_OPTION_BY_VALUE = new Map<string, StatSortOption>(
	STAT_SORT_OPTIONS.map((option) => [option.value, option])
);

const SORT_OPTIONS = new Set<string>([
	'name',
	'date-asc',
	'date-desc',
	...STAT_SORT_OPTIONS.map((option) => option.value)
]);

export function isSortOption(value: string): value is SortOption {
	return SORT_OPTIONS.has(value);
}

export function isStatSortOption(sort: SortOption): sort is StatSortOptionValue {
	return STAT_SORT_OPTION_BY_VALUE.has(sort);
}

export function getStatSortOption(sort: SortOption): StatSortOption | undefined {
	return STAT_SORT_OPTION_BY_VALUE.get(sort);
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
	return ` ${label.padStart(5)}`;
}

/** Fixed-width block matching cmini Discord bot layout (minus SFB and LH/RH). */
export function formatBotStatsBlock(
	stats: DerivedBotStats,
	corpus = DEFAULT_STATS_CORPUS
): string {
	return [
		`${corpus.toUpperCase()}:`,
		`${formatStatLabel('Alt:')} ${formatStatField(stats.alternate, 6)}`,
		`${formatStatLabel('Rol:')} ${formatStatField(stats.roll, 6)}   (In/Out: ${formatStatField(stats.rollIn, 6)} | ${formatStatField(stats.rollOut, 6)})`,
		`${formatStatLabel('One:')} ${formatStatField(stats.one, 6)}   (In/Out: ${formatStatField(stats.oneIn, 6)} | ${formatStatField(stats.oneOut, 6)})`,
		`${formatStatLabel('Rtl:')} ${formatStatField(stats.rtl, 6)}   (In/Out: ${formatStatField(stats.rtlIn, 6)} | ${formatStatField(stats.rtlOut, 6)})`,
		`${formatStatLabel('Red:')} ${formatStatField(stats.red, 6)}   (Bad: ${formatStatField(stats.badRedirect, 9)})`,
		'',
		`${formatStatLabel('SFS:')} ${formatStatField(stats.sfs, 6)}   (Red/Alt: ${formatStatField(stats.dsfbRed, 5)} | ${formatStatField(stats.dsfbAlt, 5)})`
	].join('\n');
}

/** Placeholder with the same line count as a full stats block. */
export function formatStatsLoadingBlock(): string {
	return [
		' LOADING STATS',
		' …',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Placeholder with the same line count as a full stats block. */
export function formatStatsUnavailableBlock(): string {
	return [
		' STATS UNAVAILABLE',
		' stats synced nightly',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}
