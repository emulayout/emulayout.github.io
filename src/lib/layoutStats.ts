import type { LayoutCorpusStats, LayoutStatsMap } from '$lib/layout';

/** Default corpus for layout stats (matches common cmini bot preference). */
export const DEFAULT_STATS_CORPUS = 'monkeyracer';

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

export function getLayoutCorpusStats(
	statsMap: LayoutStatsMap,
	layoutName: string,
	corpus = DEFAULT_STATS_CORPUS
): LayoutCorpusStats | undefined {
	return statsMap[layoutName]?.[corpus];
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
export function formatStatsUnavailableBlock(): string {
	return [
		' STATS UNAVAILABLE',
		' stats synced nightly',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}
