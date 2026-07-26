import type { CyanophageStats, Mana2Stats, CminiStats, LayoutData, StatsMaps } from '$lib/layout';
import {
	CMINI_ANALYZER,
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	MANA2_ANALYZER,
	STAT_ANALYZERS,
	analyzerShortLabel,
	resolveStatsAnalyzers,
	type StatsAnalyzer,
	type StatsAnalyzerMode
} from '$lib/statsAnalyzers';
import {
	LEFT_HAND_FINGERS,
	RIGHT_HAND_FINGERS,
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeCminiStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	type CyanophageStatSortKey,
	type DerivedBotStats,
	type DerivedCyanophageStats,
	type DerivedMana2Stats,
	type Mana2StatSortKey,
	type StatSortKey
} from '$lib/statsDerivation';
import {
	getStatSortAnalyzer,
	getStatSortField,
	type SortBy,
	type SortOrder
} from '$lib/statsSorting';
import {
	getStatFilterFieldsForAnalyzer,
	getStatFilterStatKey,
	type StatLimitKey
} from '$lib/statsFiltering';
import {
	CYANOPHAGE_STAT_LABEL_WIDTH,
	CYANOPHAGE_STATS_BLOCK_LINE_COUNT,
	MANA2_FLOW_LABEL_WIDTH,
	MANA2_HAND_LABEL_WIDTH,
	MANA2_PAIR_LABEL_WIDTH,
	MANA2_STATS_BLOCK_LINE_COUNT,
	STATS_BLOCK_LINE_COUNT,
	formatStatLabel,
	formatStatPercent,
	type StatsBlockSegment,
	type StatsHighlightTone
} from '$lib/statsBlockFormatting';

export * from '$lib/statsAnalyzers';
export * from '$lib/statsBlockFormatting';
export * from '$lib/statsComparison';
export * from '$lib/statsDerivation';
export * from '$lib/statsSorting';
export * from '$lib/statsFiltering';

export function getLayoutCyanophageStats(
	statsMaps: StatsMaps,
	layoutName: string
): CyanophageStats | undefined {
	const encoded = statsMaps.cyanophage?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeCyanophageStats(encoded);
}

export function getLayoutMana2Stats(
	statsMaps: StatsMaps,
	layoutName: string
): Mana2Stats | undefined {
	const encoded = statsMaps.mana2?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeMana2Stats(encoded);
}

export function getLayoutAnalyzerStats(
	statsMaps: StatsMaps,
	layoutName: string,
	analyzer: StatsAnalyzer = DEFAULT_STATS_ANALYZER,
	cyanophageCompatible = true
): CminiStats | CyanophageStats | Mana2Stats | undefined {
	if (analyzer === CYANOPHAGE_ANALYZER) {
		if (!cyanophageCompatible) return undefined;
		return getLayoutCyanophageStats(statsMaps, layoutName);
	}
	if (analyzer === MANA2_ANALYZER) {
		return getLayoutMana2Stats(statsMaps, layoutName);
	}

	const encoded = statsMaps.cmini?.[layoutName];
	if (encoded === undefined) return undefined;
	return decodeCminiStats(encoded);
}

export function isAnalyzerStatsReady(statsMaps: StatsMaps, analyzer: StatsAnalyzer): boolean {
	return statsMaps[analyzer] !== undefined;
}

export function getStatSortValue(
	statsMaps: StatsMaps,
	layout: LayoutData,
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): number | null {
	const field = getStatSortField(sortBy, analyzer);
	if (!field) return null;

	const analyzerStats = getLayoutAnalyzerStats(
		statsMaps,
		layout.name,
		field.analyzer,
		layout.cyanophageCompatible
	);
	if (!analyzerStats) return null;

	if (field.analyzer === CYANOPHAGE_ANALYZER) {
		return deriveCyanophageStats(analyzerStats as CyanophageStats)[
			field.key as CyanophageStatSortKey
		];
	}
	if (field.analyzer === MANA2_ANALYZER) {
		return deriveMana2Stats(analyzerStats as Mana2Stats)[field.key as Mana2StatSortKey];
	}

	return deriveBotStats(analyzerStats as CminiStats)[field.key as StatSortKey];
}

function formatStatField(value: number, width: number): string {
	return formatStatPercent(value).padStart(width);
}

/** Asc/desc marker used in place of `:` on the active sort field’s label. */
function sortOrderSuffix(sorted: boolean, sortOrder?: SortOrder | null): string {
	if (!sorted || !sortOrder) return ':';
	return sortOrder === 'asc' ? '▲' : '▼';
}

/** Like {@link formatStatLabel}, but swaps a trailing `:` for ▲/▼ when sorted. */
function formatSortStatLabel(
	labelWithColon: string,
	sorted: boolean,
	sortOrder?: SortOrder | null,
	width?: number
): string {
	const suffix = sortOrderSuffix(sorted, sortOrder);
	const label = sorted ? labelWithColon.replace(/:$/, suffix) : labelWithColon;
	return formatStatLabel(label, width);
}

function formatFingerSortLabel(
	finger: string,
	sorted: boolean,
	sortOrder?: SortOrder | null
): string {
	return `${finger}${sortOrderSuffix(sorted, sortOrder)} `;
}

function toHighlightKeySet<T extends string>(keys?: ReadonlySet<T> | T | null): ReadonlySet<T> {
	if (keys == null) return new Set();
	if (typeof keys === 'string') return new Set([keys]);
	return keys;
}

/**
 * Derived-stat keys with an active limit for the given analyzer.
 * Pass applied (debounced) limits so card highlights match the filtered list/chips.
 */
export function getActiveFilterStatKeys(
	limits: Record<StatLimitKey, { value: string }>,
	analyzer: StatsAnalyzer
): Set<StatSortKey | CyanophageStatSortKey | Mana2StatSortKey> {
	const keys = new Set<StatSortKey | CyanophageStatSortKey | Mana2StatSortKey>();
	for (const field of getStatFilterFieldsForAnalyzer(analyzer)) {
		if (!limits[field.key]?.value.trim()) continue;
		const statKey = getStatFilterStatKey(field);
		if (statKey === 'likes') continue;
		keys.add(statKey);
	}
	return keys;
}

/** Count applied (debounced) stat-limit filters for one analyzer. */
export function countActiveStatFiltersForAnalyzer(
	limits: Record<StatLimitKey, { value: string }>,
	analyzer: StatsAnalyzer,
	options?: { includeLikes?: boolean }
): number {
	let count = 0;
	for (const field of getStatFilterFieldsForAnalyzer(analyzer)) {
		if (limits[field.key]?.value.trim()) count += 1;
	}
	if (options?.includeLikes && limits.likes?.value.trim()) count += 1;
	return count;
}

/** Analyzers that have at least one non-empty limit in `limits`. */
export function analyzersNeededForLimits(
	limits: Record<StatLimitKey, { value: string }>
): StatsAnalyzer[] {
	const needed: StatsAnalyzer[] = [];
	for (const { value: analyzer } of STAT_ANALYZERS) {
		const hasLimits = getStatFilterFieldsForAnalyzer(analyzer).some(
			(field) => limits[field.key]?.value.trim() !== ''
		);
		if (hasLimits) needed.push(analyzer);
	}
	return needed;
}

export type AnalyzersNeededForLoadOptions = {
	/** When true, include analyzers shown by `displayMode`. */
	showStats?: boolean;
	displayMode?: StatsAnalyzerMode;
	/** Applied (or draft) limits — analyzers with active values are included. */
	limits?: Record<StatLimitKey, { value: string }>;
	/** Include the analyzer that owns this sort key, if any. */
	sortBy?: SortBy;
};

/**
 * Concrete analyzers that must be loaded for display, filtering, and/or sort.
 * Order follows `STAT_ANALYZERS`.
 */
export function analyzersNeededForLoad(options: AnalyzersNeededForLoadOptions): StatsAnalyzer[] {
	const needed = new Set<StatsAnalyzer>();

	if (options.showStats && options.displayMode) {
		for (const analyzer of resolveStatsAnalyzers(options.displayMode)) {
			needed.add(analyzer);
		}
	}

	if (options.limits) {
		for (const analyzer of analyzersNeededForLimits(options.limits)) {
			needed.add(analyzer);
		}
	}

	if (options.sortBy) {
		const sortAnalyzer = getStatSortAnalyzer(options.sortBy);
		if (sortAnalyzer) needed.add(sortAnalyzer);
	}

	return STAT_ANALYZERS.map((entry) => entry.value).filter((analyzer) => needed.has(analyzer));
}

/** Caution when a hidden analyzer still has active applied filters. */
export function getHiddenAnalyzerFilterCaution(
	displayMode: StatsAnalyzerMode,
	limits: Record<StatLimitKey, { value: string }>,
	options?: { includeLikes?: boolean }
): { analyzer: StatsAnalyzer; count: number; text: string } | null {
	const visible = new Set(resolveStatsAnalyzers(displayMode));
	for (const { value: analyzer } of STAT_ANALYZERS) {
		if (visible.has(analyzer)) continue;
		const count = countActiveStatFiltersForAnalyzer(limits, analyzer, {
			includeLikes: Boolean(options?.includeLikes) && analyzer === CMINI_ANALYZER
		});
		if (count === 0) continue;
		const label = analyzerShortLabel(analyzer);
		return {
			analyzer,
			count,
			text: `${label} stats are hidden, but its filters (${count}) still affect which layouts appear.`
		};
	}
	return null;
}

/** Shared filter/sort highlight keys for layout cards (compute once per list). */
export function getStatCardHighlightState(
	limits: Record<StatLimitKey, { value: string }>,
	sortBy: SortBy
): {
	botFilterHighlightKeys: Set<StatSortKey>;
	cyanophageFilterHighlightKeys: Set<CyanophageStatSortKey>;
	mana2FilterHighlightKeys: Set<Mana2StatSortKey>;
	botSortHighlightKey: StatSortKey | null;
	cyanophageSortHighlightKey: CyanophageStatSortKey | null;
	mana2SortHighlightKey: Mana2StatSortKey | null;
} {
	const sortField = getStatSortField(sortBy);
	return {
		botFilterHighlightKeys: getActiveFilterStatKeys(limits, CMINI_ANALYZER) as Set<StatSortKey>,
		cyanophageFilterHighlightKeys: getActiveFilterStatKeys(
			limits,
			CYANOPHAGE_ANALYZER
		) as Set<CyanophageStatSortKey>,
		mana2FilterHighlightKeys: getActiveFilterStatKeys(
			limits,
			MANA2_ANALYZER
		) as Set<Mana2StatSortKey>,
		botSortHighlightKey:
			sortField?.analyzer === CMINI_ANALYZER ? (sortField.key as StatSortKey) : null,
		cyanophageSortHighlightKey:
			sortField?.analyzer === CYANOPHAGE_ANALYZER ? (sortField.key as CyanophageStatSortKey) : null,
		mana2SortHighlightKey:
			sortField?.analyzer === MANA2_ANALYZER ? (sortField.key as Mana2StatSortKey) : null
	};
}

export function getStatSortHighlightKey(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatSortKey | CyanophageStatSortKey | Mana2StatSortKey | undefined {
	return getStatSortField(sortBy, analyzer)?.key;
}

export function formatCyanophageStatValue(value: number): string {
	return value.toFixed(1);
}

function formatMana2RawValue(value: number): string {
	return value.toFixed(3);
}

export function buildMana2StatsBlockLines(
	stats: DerivedMana2Stats,
	highlightKeys?: ReadonlySet<Mana2StatSortKey> | Mana2StatSortKey | null,
	sortHighlightKey?: Mana2StatSortKey | null,
	sortOrder?: SortOrder | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: Mana2StatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'mana2' : undefined;
	const sortHl = (...candidates: Mana2StatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;
	const sortLabel = (
		labelWithColon: string,
		width: number | undefined,
		...candidates: Mana2StatSortKey[]
	): StatsBlockSegment => {
		const highlight = sortHl(...candidates);
		return {
			text: formatSortStatLabel(labelWithColon, Boolean(highlight), sortOrder, width),
			highlight
		};
	};

	const pair = (
		label: string,
		bigKey: Mana2StatSortKey,
		bigVal: number,
		skipKey: Mana2StatSortKey,
		skipVal: number,
		raw = false
	): StatsBlockSegment[] => [
		sortLabel(`${label}:`, MANA2_PAIR_LABEL_WIDTH, bigKey, skipKey),
		{
			text: (raw ? formatMana2RawValue(bigVal) : formatStatPercent(bigVal)).padStart(7),
			highlight: filterHl(bigKey)
		},
		{ text: ' | ' },
		{
			text: (raw ? formatMana2RawValue(skipVal) : formatStatPercent(skipVal)).padStart(7),
			highlight: filterHl(skipKey)
		}
	];

	return [
		pair('Same Finger', 'sfb', stats.sfb, 'sfs', stats.sfs),
		pair('Same Key', 'skb', stats.skb, 'sks', stats.sks),
		pair('Stretch', 'lsb', stats.lsb, 'lss', stats.lss, true),
		pair('Scissor', 'vsb', stats.vsb, 'vss', stats.vss, true),
		[{ text: '' }],
		[
			sortLabel('Alt:', MANA2_FLOW_LABEL_WIDTH, 'alt'),
			{ text: formatStatField(stats.alt, 7), highlight: filterHl('alt') },
			{ text: ' (noT ' },
			{ text: formatStatField(stats.altNoThumbs, 7), highlight: filterHl('altNoThumbs') },
			{ text: ')' }
		],
		[
			sortLabel('Alt&SFS:', MANA2_FLOW_LABEL_WIDTH, 'altSfs'),
			{ text: formatStatField(stats.altSfs, 7), highlight: filterHl('altSfs') }
		],
		[
			sortLabel('Redirect:', MANA2_FLOW_LABEL_WIDTH, 'redirect'),
			{ text: formatStatField(stats.redirect, 7), highlight: filterHl('redirect') },
			{ text: ' (noT ' },
			{
				text: formatStatField(stats.redirectNoThumbs, 7),
				highlight: filterHl('redirectNoThumbs')
			},
			{ text: ')' }
		],
		[
			sortLabel(
				'R&S/Wk:',
				MANA2_FLOW_LABEL_WIDTH,
				'redirectSfs',
				'redirectWeak',
				'redirectSfsWeak'
			),
			{ text: formatStatField(stats.redirectSfs, 6), highlight: filterHl('redirectSfs') },
			{ text: ' | ' },
			{ text: formatStatField(stats.redirectWeak, 6), highlight: filterHl('redirectWeak') },
			{ text: ' | ' },
			{
				text: formatStatField(stats.redirectSfsWeak, 6),
				highlight: filterHl('redirectSfsWeak')
			}
		],
		[
			sortLabel('Roll:', MANA2_FLOW_LABEL_WIDTH, 'roll'),
			{ text: formatStatField(stats.roll, 7), highlight: filterHl('roll') },
			{ text: ' (noT ' },
			{ text: formatStatField(stats.rollNoThumbs, 7), highlight: filterHl('rollNoThumbs') },
			{ text: ')' }
		],
		[
			sortLabel('In/Out:', MANA2_FLOW_LABEL_WIDTH, 'inroll2', 'outroll2', 'inroll3', 'outroll3'),
			{ text: formatStatField(stats.inroll2, 6), highlight: filterHl('inroll2') },
			{ text: ' | ' },
			{ text: formatStatField(stats.outroll2, 6), highlight: filterHl('outroll2') },
			{ text: ' | ' },
			{ text: formatStatField(stats.inroll3, 6), highlight: filterHl('inroll3') },
			{ text: ' | ' },
			{ text: formatStatField(stats.outroll3, 6), highlight: filterHl('outroll3') }
		],
		[{ text: '' }],
		[
			sortLabel('LH/RH:', MANA2_HAND_LABEL_WIDTH, 'lh', 'rh'),
			{ text: formatStatField(stats.lh, 7), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 7), highlight: filterHl('rh') }
		],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			const leftHl = sortHl(left);
			const rightHl = sortHl(right);
			return [
				{
					text: formatFingerSortLabel(left, Boolean(leftHl), sortOrder),
					highlight: leftHl
				},
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{
					text: formatFingerSortLabel(right, Boolean(rightHl), sortOrder),
					highlight: rightHl
				},
				{ text: formatStatField(stats[right], 6), highlight: filterHl(right) }
			];
		}),
		(() => {
			const ltHl = sortHl('LT');
			const rtHl = sortHl('RT');
			return [
				{ text: formatFingerSortLabel('LT', Boolean(ltHl), sortOrder), highlight: ltHl },
				{ text: formatStatField(stats.LT, 6), highlight: filterHl('LT') },
				{ text: '    ' },
				{ text: formatFingerSortLabel('RT', Boolean(rtHl), sortOrder), highlight: rtHl },
				{ text: formatStatField(stats.RT, 6), highlight: filterHl('RT') }
			];
		})()
	];
}

/** Placeholder with the same line count as a mana2 stats block. */
export function formatMana2StatsLoadingBlock(): string {
	return [
		'LOADING STATS',
		'…',
		...Array(Math.max(0, MANA2_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Placeholder when mana2 has no stats for this layout. */
export function formatMana2StatsUnavailableBlock(): string {
	return [
		'STATS UNAVAILABLE',
		'no mana2 stats for this layout',
		...Array(Math.max(0, MANA2_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

export function buildCyanophageStatsBlockLines(
	stats: DerivedCyanophageStats,
	highlightKeys?: ReadonlySet<CyanophageStatSortKey> | CyanophageStatSortKey | null,
	sortHighlightKey?: CyanophageStatSortKey | null,
	sortOrder?: SortOrder | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: CyanophageStatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'cyanophage' : undefined;
	const sortHl = (...candidates: CyanophageStatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;
	const sortLabel = (
		labelWithColon: string,
		width: number | undefined,
		...candidates: CyanophageStatSortKey[]
	): StatsBlockSegment => {
		const highlight = sortHl(...candidates);
		return {
			text: formatSortStatLabel(labelWithColon, Boolean(highlight), sortOrder, width),
			highlight
		};
	};

	return [
		[
			sortLabel('Total Word Effort:', CYANOPHAGE_STAT_LABEL_WIDTH, 'totalWordEffort'),
			{
				text: formatCyanophageStatValue(stats.totalWordEffort).padStart(6),
				highlight: filterHl('totalWordEffort')
			}
		],
		[
			sortLabel('Effort:', CYANOPHAGE_STAT_LABEL_WIDTH, 'effort'),
			{
				text: formatCyanophageStatValue(stats.effort).padStart(6),
				highlight: filterHl('effort')
			}
		],
		[{ text: '' }],
		[
			sortLabel('Same Finger Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH, 'sfb'),
			{ text: formatStatField(stats.sfb, 6), highlight: filterHl('sfb') }
		],
		[
			sortLabel('Skip Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH, 'sfs'),
			{ text: formatStatField(stats.sfs, 6), highlight: filterHl('sfs') }
		],
		[
			sortLabel('Lat Stretch Bigrams:', CYANOPHAGE_STAT_LABEL_WIDTH, 'lsb'),
			{ text: formatStatField(stats.lsb, 6), highlight: filterHl('lsb') }
		],
		[
			sortLabel('Scissors:', CYANOPHAGE_STAT_LABEL_WIDTH, 'scissors'),
			{ text: formatStatField(stats.scissors, 6), highlight: filterHl('scissors') }
		],
		[{ text: '' }],
		[
			sortLabel('LH/RH:', undefined, 'lh', 'rh'),
			{ text: formatStatField(stats.lh, 6), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: filterHl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			const leftHl = sortHl(left);
			const rightHl = sortHl(right);
			return [
				{
					text: formatFingerSortLabel(left, Boolean(leftHl), sortOrder),
					highlight: leftHl
				},
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{
					text: formatFingerSortLabel(right, Boolean(rightHl), sortOrder),
					highlight: rightHl
				},
				{ text: formatStatField(stats[right], 6), highlight: filterHl(right) }
			];
		})
	];
}

/** Placeholder with the same line count as a cyanophage stats block. */
export function formatCyanophageStatsLoadingBlock(): string {
	return [
		'LOADING STATS',
		'…',
		...Array(Math.max(0, CYANOPHAGE_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Placeholder with the same line count as a cyanophage stats block. */
export function formatCyanophageStatsUnavailableBlock(reason?: string): string {
	return [
		'STATS UNAVAILABLE',
		reason ?? 'no Cyanophage stats for this layout',
		...Array(Math.max(0, CYANOPHAGE_STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}

/** Lines of segments for rendering; optional highlight on filtered/sorted stats. */
export function buildBotStatsBlockLines(
	stats: DerivedBotStats,
	highlightKeys?: ReadonlySet<StatSortKey> | StatSortKey | null,
	sortHighlightKey?: StatSortKey | null,
	sortOrder?: SortOrder | null
): StatsBlockSegment[][] {
	const keys = toHighlightKeySet(highlightKeys);
	const filterHl = (key: StatSortKey): StatsHighlightTone | undefined =>
		keys.has(key) ? 'cmini' : undefined;
	const sortHl = (...candidates: StatSortKey[]): StatsHighlightTone | undefined =>
		sortHighlightKey && candidates.includes(sortHighlightKey) ? 'sort' : undefined;
	const sortLabel = (labelWithColon: string, ...candidates: StatSortKey[]): StatsBlockSegment => {
		const highlight = sortHl(...candidates);
		return {
			text: formatSortStatLabel(labelWithColon, Boolean(highlight), sortOrder),
			highlight
		};
	};

	const badHl = sortHl('badRedirect');

	return [
		[
			sortLabel('Alt:', 'alternate'),
			{ text: formatStatField(stats.alternate, 6), highlight: filterHl('alternate') }
		],
		[
			sortLabel('Rol:', 'roll', 'rollIn', 'rollOut'),
			{ text: formatStatField(stats.roll, 6), highlight: filterHl('roll') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rollIn, 6), highlight: filterHl('rollIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rollOut, 6), highlight: filterHl('rollOut') },
			{ text: ')' }
		],
		[
			sortLabel('One:', 'one', 'oneIn', 'oneOut'),
			{ text: formatStatField(stats.one, 6), highlight: filterHl('one') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.oneIn, 6), highlight: filterHl('oneIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.oneOut, 6), highlight: filterHl('oneOut') },
			{ text: ')' }
		],
		[
			sortLabel('Rtl:', 'rtl', 'rtlIn', 'rtlOut'),
			{ text: formatStatField(stats.rtl, 6), highlight: filterHl('rtl') },
			{ text: ' (In/Out: ' },
			{ text: formatStatField(stats.rtlIn, 6), highlight: filterHl('rtlIn') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rtlOut, 6), highlight: filterHl('rtlOut') },
			{ text: ')' }
		],
		[
			sortLabel('Red:', 'red'),
			{ text: formatStatField(stats.red, 6), highlight: filterHl('red') },
			{ text: ' (' },
			{
				text: `Bad${sortOrderSuffix(Boolean(badHl), sortOrder)}`,
				highlight: badHl
			},
			{ text: ' ' },
			{ text: formatStatField(stats.badRedirect, 9), highlight: filterHl('badRedirect') },
			{ text: ')' }
		],
		[{ text: '' }],
		[sortLabel('SFB:', 'sfb'), { text: formatStatField(stats.sfb, 6), highlight: filterHl('sfb') }],
		[
			sortLabel('SFS:', 'sfs', 'dsfbRed', 'dsfbAlt'),
			{ text: formatStatField(stats.sfs, 6), highlight: filterHl('sfs') },
			{ text: ' (Red/Alt: ' },
			{ text: formatStatField(stats.dsfbRed, 5), highlight: filterHl('dsfbRed') },
			{ text: ' | ' },
			{ text: formatStatField(stats.dsfbAlt, 5), highlight: filterHl('dsfbAlt') },
			{ text: ')' }
		],
		[
			sortLabel('LH/RH:', 'lh', 'rh'),
			{ text: formatStatField(stats.lh, 6), highlight: filterHl('lh') },
			{ text: ' | ' },
			{ text: formatStatField(stats.rh, 6), highlight: filterHl('rh') }
		],
		[{ text: '' }],
		...LEFT_HAND_FINGERS.map((left, index) => {
			const right = RIGHT_HAND_FINGERS[index];
			const leftHl = sortHl(left);
			const rightHl = sortHl(right);
			return [
				{
					text: formatFingerSortLabel(left, Boolean(leftHl), sortOrder),
					highlight: leftHl
				},
				{ text: formatStatField(stats[left], 6), highlight: filterHl(left) },
				{ text: '    ' },
				{
					text: formatFingerSortLabel(right, Boolean(rightHl), sortOrder),
					highlight: rightHl
				},
				{ text: formatStatField(stats[right], 6), highlight: filterHl(right) }
			];
		})
	];
}

/** Fixed-width block matching the cmini Discord bot layout. */
export function formatBotStatsBlock(stats: DerivedBotStats): string {
	return buildBotStatsBlockLines(stats)
		.map((line) => line.map((segment) => segment.text).join(''))
		.join('\n');
}

/** Placeholder with the same line count as a full stats block. */
export function formatStatsLoadingBlock(): string {
	return ['LOADING STATS', '…', ...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')].join(
		'\n'
	);
}

/** Placeholder with the same line count as a full stats block. */
export function formatStatsUnavailableBlock(): string {
	return [
		'STATS UNAVAILABLE',
		'no cmini cache for this layout',
		...Array(Math.max(0, STATS_BLOCK_LINE_COUNT - 2)).fill('')
	].join('\n');
}
