import { formatStatPercent } from '$lib/layoutStats';
import type {
	DerivedBotStats,
	DerivedCyanophageStats,
	DerivedMana2Stats
} from '$lib/statsDerivation';

export interface ExpandedStatsRow {
	label: string;
	cmini: string;
	cyanophage: string;
	mana2: string;
}

export interface ExpandedStatsTables {
	sharedRows: ExpandedStatsRow[];
	leftHandRows: ExpandedStatsRow[];
	rightHandRows: ExpandedStatsRow[];
}

interface ExpandedStatsTablesInput {
	cminiStats: DerivedBotStats | null;
	cyanophageStats: DerivedCyanophageStats | null;
	mana2Stats: DerivedMana2Stats | null;
	cminiLoading: boolean;
	cyanophageLoading: boolean;
	mana2Loading: boolean;
}

const DASH = '—';
const LOADING = '…';

function formatCell<T>(
	stats: T | null,
	loading: boolean,
	get: (stats: T) => number,
	format: (value: number) => string = formatStatPercent
): string {
	if (loading) return LOADING;
	if (!stats) return DASH;
	return format(get(stats));
}

function formatPair<T>(
	stats: T | null,
	loading: boolean,
	getA: (stats: T) => number,
	getB: (stats: T) => number
): string {
	if (loading) return LOADING;
	if (!stats) return DASH;
	return `${formatStatPercent(getA(stats))} | ${formatStatPercent(getB(stats))}`;
}

export function buildExpandedStatsTables({
	cminiStats,
	cyanophageStats,
	mana2Stats,
	cminiLoading,
	cyanophageLoading,
	mana2Loading
}: ExpandedStatsTablesInput): ExpandedStatsTables {
	const cminiCell = (get: (stats: DerivedBotStats) => number, format?: (value: number) => string) =>
		formatCell(cminiStats, cminiLoading, get, format);
	const cyanophageCell = (
		get: (stats: DerivedCyanophageStats) => number,
		format?: (value: number) => string
	) => formatCell(cyanophageStats, cyanophageLoading, get, format);
	const mana2Cell = (
		get: (stats: DerivedMana2Stats) => number,
		format?: (value: number) => string
	) => formatCell(mana2Stats, mana2Loading, get, format);
	const cminiPair = (
		getA: (stats: DerivedBotStats) => number,
		getB: (stats: DerivedBotStats) => number
	) => formatPair(cminiStats, cminiLoading, getA, getB);
	const mana2Pair = (
		getA: (stats: DerivedMana2Stats) => number,
		getB: (stats: DerivedMana2Stats) => number
	) => formatPair(mana2Stats, mana2Loading, getA, getB);
	const mana2Raw = (value: number) => value.toFixed(3);

	const sharedRows: ExpandedStatsRow[] = [
		{
			label: 'Same-finger bigrams',
			cmini: cminiCell((stats) => stats.sfb),
			cyanophage: cyanophageCell((stats) => stats.sfb),
			mana2: mana2Cell((stats) => stats.sfb)
		},
		{
			// Skipgram SFB — cmini’s “SFS” is trigram end-same-finger, not this.
			label: 'Same-finger skip',
			cmini: DASH,
			cyanophage: cyanophageCell((stats) => stats.sfs),
			mana2: mana2Cell((stats) => stats.sfs)
		},
		{
			label: 'Alternation',
			cmini: cminiCell((stats) => stats.alternate),
			cyanophage: cyanophageCell((stats) => stats.alternate),
			mana2: mana2Cell((stats) => stats.alt)
		},
		{
			label: 'Alt & SFS',
			cmini: cminiCell((stats) => stats.dsfbAlt),
			cyanophage: DASH,
			mana2: mana2Cell((stats) => stats.altSfs)
		},
		{
			// cmini rtl (= roll + one-hand) matches Mana2 roll total; cmini roll is 2-key only.
			label: 'Roll total',
			cmini: cminiCell((stats) => stats.rtl),
			cyanophage: cyanophageCell((stats) => stats.roll),
			mana2: mana2Cell((stats) => stats.roll)
		},
		{
			label: 'Roll in / out (2)',
			cmini: cminiPair(
				(stats) => stats.rollIn,
				(stats) => stats.rollOut
			),
			cyanophage: DASH,
			mana2: mana2Pair(
				(stats) => stats.inroll2,
				(stats) => stats.outroll2
			)
		},
		{
			label: 'One-hand in / out (3)',
			cmini: cminiPair(
				(stats) => stats.oneIn,
				(stats) => stats.oneOut
			),
			cyanophage: DASH,
			mana2: mana2Pair(
				(stats) => stats.inroll3,
				(stats) => stats.outroll3
			)
		},
		{
			label: 'Redirect',
			cmini: cminiCell((stats) => stats.red),
			cyanophage: cyanophageCell((stats) => stats.redirect),
			mana2: mana2Cell((stats) => stats.redirect)
		},
		{
			label: 'Weak / bad redirect',
			cmini: cminiCell((stats) => stats.badRedirect),
			cyanophage: DASH,
			mana2: mana2Cell((stats) => stats.redirectWeak)
		},
		{
			label: 'Redirect & SFS',
			cmini: cminiCell((stats) => stats.dsfbRed),
			cyanophage: DASH,
			mana2: mana2Cell((stats) => stats.redirectSfs)
		},
		{
			label: 'Lat stretch bigrams',
			cmini: DASH,
			cyanophage: cyanophageCell((stats) => stats.lsb),
			mana2: mana2Cell((stats) => stats.lsb, mana2Raw)
		},
		{
			label: 'Scissors',
			cmini: DASH,
			cyanophage: cyanophageCell((stats) => stats.scissors),
			mana2: mana2Cell((stats) => stats.vsb, mana2Raw)
		}
	];

	const handRows = (
		hand: 'left' | 'right',
		fingers: Array<{
			key: 'LI' | 'LM' | 'LR' | 'LP' | 'LT' | 'RI' | 'RM' | 'RR' | 'RP' | 'RT';
			label: string;
		}>
	): ExpandedStatsRow[] => [
		{
			label: 'Hand',
			cmini: cminiCell((stats) => stats[hand === 'left' ? 'lh' : 'rh']),
			cyanophage: cyanophageCell((stats) => stats[hand === 'left' ? 'lh' : 'rh']),
			mana2: mana2Cell((stats) => stats[hand === 'left' ? 'lh' : 'rh'])
		},
		...fingers.map(({ key, label }) => ({
			label,
			cmini: cminiCell((stats) => stats[key]),
			cyanophage: cyanophageCell((stats) => stats[key]),
			mana2: mana2Cell((stats) => stats[key])
		}))
	];

	return {
		sharedRows,
		leftHandRows: handRows('left', [
			{ key: 'LI', label: 'Index' },
			{ key: 'LM', label: 'Middle' },
			{ key: 'LR', label: 'Ring' },
			{ key: 'LP', label: 'Pinky' },
			{ key: 'LT', label: 'Thumb' }
		]),
		rightHandRows: handRows('right', [
			{ key: 'RI', label: 'Index' },
			{ key: 'RM', label: 'Middle' },
			{ key: 'RR', label: 'Ring' },
			{ key: 'RP', label: 'Pinky' },
			{ key: 'RT', label: 'Thumb' }
		])
	};
}
