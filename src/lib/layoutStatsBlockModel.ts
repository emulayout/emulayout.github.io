import type { CompactCyanophageStats, CompactLayoutStats, CompactMana2Stats } from '$lib/layout';
import {
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeCminiStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	CYANOPHAGE_FINGER_STAT_KEYS,
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
import type { StatsBlockSegment } from '$lib/statsBlockFormatting';
import type { SortOrder } from '$lib/statsSorting';

export type CompactAnalyzerStats = CompactLayoutStats | CompactCyanophageStats | CompactMana2Stats;

export interface LayoutFingerUsageModel {
	usage: Record<CyanophageFingerUsageKey, number>;
	leftTotal: number;
	rightTotal: number;
}

export interface LayoutStatsBlockModel {
	analyzer: StatsAnalyzer;
	lines: StatsBlockSegment[][] | null;
	fingerUsage: LayoutFingerUsageModel | null;
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
			lines: stats
				? buildCyanophageStatsBlockLines(
						stats,
						highlights?.cyanophageFilterHighlightKeys,
						highlights?.cyanophageSortHighlightKey,
						sortOrder
					)
				: null,
			fingerUsage: stats ? buildFingerUsageModel(stats) : null,
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
			lines: stats
				? buildMana2StatsBlockLines(
						stats,
						highlights?.mana2FilterHighlightKeys,
						highlights?.mana2SortHighlightKey,
						sortOrder
					)
				: null,
			fingerUsage: stats ? buildFingerUsageModel(stats) : null,
			fallback: loading ? formatMana2StatsLoadingBlock() : formatMana2StatsUnavailableBlock(),
			loading,
			mana2: true
		};
	}

	const decoded = compactStats ? decodeCminiStats(compactStats as CompactLayoutStats) : undefined;
	const stats = decoded ? deriveBotStats(decoded) : null;
	return {
		analyzer,
		lines: stats
			? buildBotStatsBlockLines(
					stats,
					highlights?.botFilterHighlightKeys,
					highlights?.botSortHighlightKey,
					sortOrder
				)
			: null,
		fingerUsage: stats ? buildFingerUsageModel(stats) : null,
		fallback: loading ? formatStatsLoadingBlock() : formatStatsUnavailableBlock(),
		loading,
		mana2: false
	};
}
