import type { CompactCyanophageStats, CompactLayoutStats, CompactMana2Stats } from '$lib/layout';
import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
import {
	buildBotStatsBlockLines,
	buildCyanophageStatsBlockLines,
	buildMana2StatsBlockLines,
	CYANOPHAGE_ANALYZER,
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeMonkeyracerStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	formatCyanophageStatsLoadingBlock,
	formatCyanophageStatsUnavailableBlock,
	formatMana2StatsLoadingBlock,
	formatMana2StatsUnavailableBlock,
	formatStatsLoadingBlock,
	formatStatsUnavailableBlock,
	MANA2_ANALYZER,
	type getStatCardHighlightState,
	type SortOrder,
	type StatsAnalyzer,
	type StatsBlockSegment
} from '$lib/layoutStats';

export type CompactAnalyzerStats = CompactLayoutStats | CompactCyanophageStats | CompactMana2Stats;

export interface LayoutStatsBlockModel {
	lines: StatsBlockSegment[][] | null;
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
		return {
			lines: decoded
				? buildCyanophageStatsBlockLines(
						deriveCyanophageStats(decoded),
						highlights?.cyanophageFilterHighlightKeys,
						highlights?.cyanophageSortHighlightKey,
						sortOrder
					)
				: null,
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
		return {
			lines: decoded
				? buildMana2StatsBlockLines(
						deriveMana2Stats(decoded),
						highlights?.mana2FilterHighlightKeys,
						highlights?.mana2SortHighlightKey,
						sortOrder
					)
				: null,
			fallback: loading ? formatMana2StatsLoadingBlock() : formatMana2StatsUnavailableBlock(),
			loading,
			mana2: true
		};
	}

	const decoded = compactStats
		? decodeMonkeyracerStats(compactStats as CompactLayoutStats)
		: undefined;
	return {
		lines: decoded
			? buildBotStatsBlockLines(
					deriveBotStats(decoded),
					highlights?.botFilterHighlightKeys,
					highlights?.botSortHighlightKey,
					sortOrder
				)
			: null,
		fallback: loading ? formatStatsLoadingBlock() : formatStatsUnavailableBlock(),
		loading,
		mana2: false
	};
}
