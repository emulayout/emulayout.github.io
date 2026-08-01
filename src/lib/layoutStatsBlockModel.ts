import type { CompactCyanophageStats, CompactLayoutStats, CompactMana2Stats } from '$lib/layout';
import {
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeCminiStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	CYANOPHAGE_FINGER_STAT_KEYS,
	LEFT_HAND_FINGERS,
	RIGHT_HAND_FINGERS,
	type CyanophageFingerUsageKey
} from '$lib/statsDerivation';
import {
	buildBotStatsBlockLines,
	buildCyanophageStatsBlockLines,
	buildMana2StatsBlockLines,
	formatCyanophageStatsLoadingBlock,
	formatCyanophageStatsUnavailableBlock,
	formatMana2StatsLoadingBlock,
	formatMana2StatsUnavailableBlock,
	formatStatsLoadingBlock,
	formatStatsUnavailableBlock
} from '$lib/statsCardFormatting';
import {
	CYANOPHAGE_ANALYZER,
	CYANOPHAGE_UNSUPPORTED_LABEL,
	MANA2_ANALYZER,
	type StatsAnalyzer
} from '$lib/statsAnalyzers';
import type { getStatCardHighlightState } from '$lib/statsUsage';
import {
	formatStatPercent,
	type StatsBlockSegment,
	type StatsHighlightTone
} from '$lib/statsBlockFormatting';
import { getStatSortFieldsForAnalyzer, type SortOrder } from '$lib/statsSorting';

export type CompactAnalyzerStats = CompactLayoutStats | CompactCyanophageStats | CompactMana2Stats;

export interface LayoutFingerUsageModel {
	usage: Record<CyanophageFingerUsageKey, number>;
	leftTotal: number;
	rightTotal: number;
}

export interface LayoutFingerDistanceModel {
	distance: Record<CyanophageFingerUsageKey, number>;
	leftShare: number;
	rightShare: number;
	total: number;
}

/** Small, semantic metric used by the focused layout-card stats view. */
export interface LayoutCardMetric {
	analyzer: StatsAnalyzer;
	key: string;
	label: string;
	description: string;
	value: string;
	preferredSortOrder: SortOrder;
	/** Optional zero-based position in the focused card's three-column grid. */
	slot?: number;
	highlight?: StatsHighlightTone;
	sortOrder?: SortOrder;
}

export interface LayoutStatsBlockModel {
	analyzer: StatsAnalyzer;
	/** Focused card metrics. Full formatted lines remain available for detailed mode. */
	cardMetrics: LayoutCardMetric[] | null;
	lines: StatsBlockSegment[][] | null;
	fingerUsage: LayoutFingerUsageModel | null;
	fingerDistance: LayoutFingerDistanceModel | null;
	fallback: string;
	loading: boolean;
	mana2: boolean;
}

type StatCardHighlightState = ReturnType<typeof getStatCardHighlightState>;

interface LayoutStatsBlockModelOptions {
	loading?: boolean;
	cyanophageCompatible?: boolean;
	highlights?: StatCardHighlightState;
	sortOrder?: SortOrder | null;
}

function metricHighlight<T extends string>(
	key: T,
	filterKeys: ReadonlySet<T> | undefined,
	sortKey: T | null | undefined,
	filterTone: StatsHighlightTone
): StatsHighlightTone | undefined {
	if (sortKey === key) return 'sort';
	return filterKeys?.has(key) ? filterTone : undefined;
}

function cardMetric<T extends string>(
	key: T,
	label: string,
	description: string,
	value: number,
	filterKeys: ReadonlySet<T> | undefined,
	sortKey: T | null | undefined,
	filterTone: StatsAnalyzer,
	sortOrder?: SortOrder | null,
	slot?: number
): LayoutCardMetric {
	const highlight = metricHighlight(key, filterKeys, sortKey, filterTone);
	return {
		analyzer: filterTone,
		key,
		label,
		description,
		value: formatStatPercent(value),
		preferredSortOrder:
			getStatSortFieldsForAnalyzer(filterTone).find((field) => field.key === key)?.defaultOrder ??
			'asc',
		slot,
		highlight,
		sortOrder: highlight === 'sort' ? (sortOrder ?? undefined) : undefined
	};
}

const COMPACT_SORT_LABELS: Readonly<Record<string, string>> = {
	totalWordEffort: 'Word effort',
	dsfbRed: 'SFS redirect',
	dsfbAlt: 'SFS alternate',
	rtlIn: 'Total in',
	rtlOut: 'Total out',
	oneIn: 'One in',
	oneOut: 'One out',
	skb: 'SKB',
	sks: 'SKS',
	lsb: 'Stretch',
	vsb: 'Scissor',
	lh: 'LH',
	rh: 'RH'
};

const CYANOPHAGE_RAW_CARD_SORT_KEYS = new Set(['totalWordEffort', 'effort', 'distance']);
const MANA2_RAW_CARD_SORT_KEYS = new Set(['lsb', 'vsb']);

function formatDynamicSortValue(analyzer: StatsAnalyzer, key: string, value: number): string {
	if (analyzer === CYANOPHAGE_ANALYZER && CYANOPHAGE_RAW_CARD_SORT_KEYS.has(key)) {
		return value.toFixed(1);
	}
	if (analyzer === MANA2_ANALYZER && MANA2_RAW_CARD_SORT_KEYS.has(key)) {
		return value.toFixed(3);
	}
	return formatStatPercent(value);
}

function addDynamicSortMetric<T extends string>(
	metrics: LayoutCardMetric[],
	stats: Record<T, number>,
	sortKey: T | null | undefined,
	analyzer: StatsAnalyzer,
	filterKeys: ReadonlySet<T> | undefined,
	filterTone: StatsAnalyzer,
	sortOrder?: SortOrder | null
): LayoutCardMetric[] {
	if (!sortKey || metrics.some((metric) => metric.key === sortKey)) return metrics;

	const sortField = getStatSortFieldsForAnalyzer(analyzer).find((field) => field.key === sortKey);
	const value = stats[sortKey];
	if (!sortField || !Number.isFinite(value)) return metrics;

	const metric = cardMetric(
		sortKey,
		COMPACT_SORT_LABELS[sortKey] ?? sortField.label,
		sortField.label,
		value,
		filterKeys,
		sortKey,
		filterTone,
		sortOrder,
		5
	);
	metric.value = formatDynamicSortValue(analyzer, sortKey, value);
	return [...metrics, metric];
}

export function buildFocusedMetricSlots(
	model: LayoutStatsBlockModel,
	sortMetric: LayoutCardMetric | null = null
): Array<LayoutCardMetric | null> {
	const slots: Array<LayoutCardMetric | null> = Array(6).fill(null);
	for (const [index, metric] of (model.cardMetrics ?? []).entries()) {
		slots[metric.slot ?? index] = metric;
	}
	const alreadyShown =
		sortMetric?.analyzer === model.analyzer &&
		model.cardMetrics?.some((metric) => metric.key === sortMetric.key);
	if (sortMetric && !alreadyShown) slots[5] = sortMetric;
	return slots;
}

function buildFingerUsageModel(
	stats: Record<CyanophageFingerUsageKey | 'lh' | 'rh', number>
): LayoutFingerUsageModel {
	return {
		usage: Object.fromEntries(
			CYANOPHAGE_FINGER_STAT_KEYS.map((finger) => [finger, stats[finger]])
		) as Record<CyanophageFingerUsageKey, number>,
		leftTotal: stats.lh,
		rightTotal: stats.rh
	};
}

function buildFingerDistanceModel(
	stats: ReturnType<typeof deriveCyanophageStats>
): LayoutFingerDistanceModel {
	const distance = Object.fromEntries(
		CYANOPHAGE_FINGER_STAT_KEYS.map((finger) => [finger, stats[`distance${finger}`]])
	) as Record<CyanophageFingerUsageKey, number>;
	const leftDistance = LEFT_HAND_FINGERS.reduce((sum, finger) => sum + distance[finger], 0);
	const rightDistance = RIGHT_HAND_FINGERS.reduce((sum, finger) => sum + distance[finger], 0);
	const total = Math.max(0, stats.distance);

	return {
		distance,
		leftShare: total > 0 ? leftDistance / total : 0,
		rightShare: total > 0 ? rightDistance / total : 0,
		total
	};
}

export function buildLayoutStatsBlockModel(
	analyzer: StatsAnalyzer,
	compactStats: CompactAnalyzerStats | null | undefined,
	options: LayoutStatsBlockModelOptions = {}
): LayoutStatsBlockModel {
	const loading = options.loading ?? false;
	const cyanophageCompatible = options.cyanophageCompatible ?? true;
	const { highlights, sortOrder } = options;

	if (analyzer === CYANOPHAGE_ANALYZER) {
		const decoded =
			cyanophageCompatible && compactStats
				? decodeCyanophageStats(compactStats as CompactCyanophageStats)
				: undefined;
		const stats = decoded ? deriveCyanophageStats(decoded) : null;
		return {
			analyzer,
			cardMetrics: stats
				? addDynamicSortMetric(
						[
							cardMetric(
								'sfb',
								'SFB',
								'Same-finger bigrams',
								stats.sfb,
								highlights?.cyanophageFilterHighlightKeys,
								highlights?.cyanophageSortHighlightKey,
								'cyanophage',
								sortOrder
							),
							cardMetric(
								'sfs',
								'SFS',
								'Skip bigrams',
								stats.sfs,
								highlights?.cyanophageFilterHighlightKeys,
								highlights?.cyanophageSortHighlightKey,
								'cyanophage',
								sortOrder
							),
							cardMetric(
								'rollIn',
								'Roll in',
								'Inward rolls (two- and three-key)',
								stats.rollIn,
								highlights?.cyanophageFilterHighlightKeys,
								highlights?.cyanophageSortHighlightKey,
								'cyanophage',
								sortOrder
							),
							cardMetric(
								'redirect',
								'Redirect',
								'Direction-changing trigrams',
								stats.redirect,
								highlights?.cyanophageFilterHighlightKeys,
								highlights?.cyanophageSortHighlightKey,
								'cyanophage',
								sortOrder,
								3
							),
							cardMetric(
								'alternate',
								'Alt',
								'Alternating-hand trigrams',
								stats.alternate,
								highlights?.cyanophageFilterHighlightKeys,
								highlights?.cyanophageSortHighlightKey,
								'cyanophage',
								sortOrder,
								4
							)
						],
						stats,
						highlights?.cyanophageSortHighlightKey,
						analyzer,
						highlights?.cyanophageFilterHighlightKeys,
						'cyanophage',
						sortOrder
					)
				: null,
			lines: stats
				? buildCyanophageStatsBlockLines(
						stats,
						highlights?.cyanophageFilterHighlightKeys,
						highlights?.cyanophageSortHighlightKey,
						sortOrder
					)
				: null,
			fingerUsage: stats ? buildFingerUsageModel(stats) : null,
			fingerDistance: stats ? buildFingerDistanceModel(stats) : null,
			fallback: loading
				? formatCyanophageStatsLoadingBlock()
				: formatCyanophageStatsUnavailableBlock(
						cyanophageCompatible ? undefined : CYANOPHAGE_UNSUPPORTED_LABEL
					),
			loading,
			mana2: false
		};
	}

	if (analyzer === MANA2_ANALYZER) {
		const decoded = compactStats ? decodeMana2Stats(compactStats as CompactMana2Stats) : undefined;
		const stats = decoded ? deriveMana2Stats(decoded) : null;
		return {
			analyzer,
			cardMetrics: stats
				? addDynamicSortMetric(
						[
							cardMetric(
								'sfb',
								'SFB',
								'Same-finger bigrams',
								stats.sfb,
								highlights?.mana2FilterHighlightKeys,
								highlights?.mana2SortHighlightKey,
								'mana2',
								sortOrder
							),
							cardMetric(
								'sfs',
								'SFS',
								'Same-finger skips',
								stats.sfs,
								highlights?.mana2FilterHighlightKeys,
								highlights?.mana2SortHighlightKey,
								'mana2',
								sortOrder
							),
							cardMetric(
								'inroll2',
								'Roll in',
								'Two-key inward rolls',
								stats.inroll2,
								highlights?.mana2FilterHighlightKeys,
								highlights?.mana2SortHighlightKey,
								'mana2',
								sortOrder
							),
							cardMetric(
								'redirect',
								'Redirect',
								'Direction-changing trigrams',
								stats.redirect,
								highlights?.mana2FilterHighlightKeys,
								highlights?.mana2SortHighlightKey,
								'mana2',
								sortOrder
							),
							cardMetric(
								'alt',
								'Alt',
								'Alternating-hand trigrams',
								stats.alt,
								highlights?.mana2FilterHighlightKeys,
								highlights?.mana2SortHighlightKey,
								'mana2',
								sortOrder
							)
						],
						stats,
						highlights?.mana2SortHighlightKey,
						analyzer,
						highlights?.mana2FilterHighlightKeys,
						'mana2',
						sortOrder
					)
				: null,
			lines: stats
				? buildMana2StatsBlockLines(
						stats,
						highlights?.mana2FilterHighlightKeys,
						highlights?.mana2SortHighlightKey,
						sortOrder
					)
				: null,
			fingerUsage: stats ? buildFingerUsageModel(stats) : null,
			fingerDistance: null,
			fallback: loading ? formatMana2StatsLoadingBlock() : formatMana2StatsUnavailableBlock(),
			loading,
			mana2: true
		};
	}

	const decoded = compactStats ? decodeCminiStats(compactStats as CompactLayoutStats) : undefined;
	const stats = decoded ? deriveBotStats(decoded) : null;
	return {
		analyzer,
		cardMetrics: stats
			? addDynamicSortMetric(
					[
						cardMetric(
							'sfb',
							'SFB',
							'Same-finger bigrams',
							stats.sfb,
							highlights?.botFilterHighlightKeys,
							highlights?.botSortHighlightKey,
							'cmini',
							sortOrder
						),
						cardMetric(
							'sfs',
							'SFS',
							'Same-finger skips',
							stats.sfs,
							highlights?.botFilterHighlightKeys,
							highlights?.botSortHighlightKey,
							'cmini',
							sortOrder
						),
						cardMetric(
							'rollIn',
							'Roll in',
							'Inward rolls',
							stats.rollIn,
							highlights?.botFilterHighlightKeys,
							highlights?.botSortHighlightKey,
							'cmini',
							sortOrder
						),
						cardMetric(
							'red',
							'Redirect',
							'Direction-changing trigrams',
							stats.red,
							highlights?.botFilterHighlightKeys,
							highlights?.botSortHighlightKey,
							'cmini',
							sortOrder
						),
						cardMetric(
							'alternate',
							'Alt',
							'Alternating-hand trigrams',
							stats.alternate,
							highlights?.botFilterHighlightKeys,
							highlights?.botSortHighlightKey,
							'cmini',
							sortOrder
						)
					],
					stats,
					highlights?.botSortHighlightKey,
					analyzer,
					highlights?.botFilterHighlightKeys,
					'cmini',
					sortOrder
				)
			: null,
		lines: stats
			? buildBotStatsBlockLines(
					stats,
					highlights?.botFilterHighlightKeys,
					highlights?.botSortHighlightKey,
					sortOrder
				)
			: null,
		fingerUsage: stats ? buildFingerUsageModel(stats) : null,
		fingerDistance: null,
		fallback: loading ? formatStatsLoadingBlock() : formatStatsUnavailableBlock(),
		loading,
		mana2: false
	};
}
