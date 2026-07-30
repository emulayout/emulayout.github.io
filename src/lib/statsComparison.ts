import { CMINI_ANALYZER, CYANOPHAGE_ANALYZER, MANA2_ANALYZER } from '$lib/statsAnalyzers';
import {
	LEFT_HAND_FINGERS,
	RIGHT_HAND_FINGERS,
	type CyanophageStatSortKey,
	type DerivedBotStats,
	type DerivedCyanophageStats,
	type DerivedMana2Stats,
	type Mana2StatSortKey,
	type StatSortKey
} from '$lib/statsDerivation';
import {
	CYANOPHAGE_STAT_LABEL_WIDTH,
	MANA2_FLOW_LABEL_WIDTH,
	MANA2_HAND_LABEL_WIDTH,
	MANA2_PAIR_LABEL_WIDTH,
	formatStatLabel,
	type StatsBlockSegment
} from '$lib/statsBlockFormatting';
import { isHigherBetterStatKey } from '$lib/statsSorting';

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

const CYANOPHAGE_RAW_DIFF_KEYS = new Set<CyanophageStatSortKey>([
	'totalWordEffort',
	'effort',
	'distance',
	'distanceLI',
	'distanceLM',
	'distanceLR',
	'distanceLP',
	'distanceLT',
	'distanceRI',
	'distanceRM',
	'distanceRR',
	'distanceRP',
	'distanceRT'
]);

function diffSegment(
	delta: number,
	width: number,
	higherIsBetter: boolean | null,
	format: 'percent' | 'raw'
): StatsBlockSegment {
	const text =
		format === 'raw'
			? formatCyanophageStatDiffField(delta, width)
			: formatStatDiffField(delta, width);
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
		isHigherBetterStatKey(key, CMINI_ANALYZER),
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
		[
			{ text: formatStatLabel('Distance:', CYANOPHAGE_STAT_LABEL_WIDTH) },
			cyanophageDiff(newStats, oldStats, 'distance', 7)
		],
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
