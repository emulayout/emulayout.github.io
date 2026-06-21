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

export function formatStatPercent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}
