import type { CminiStats, CyanophageStats, LayoutData, Mana2Stats, StatsMaps } from '$lib/layout';
import {
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	MANA2_ANALYZER,
	type StatsAnalyzer
} from '$lib/statsAnalyzers';
import {
	decodeCminiStats,
	decodeCyanophageStats,
	decodeMana2Stats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	type CyanophageStatSortKey,
	type Mana2StatSortKey,
	type StatSortKey
} from '$lib/statsDerivation';
import { getStatSortField, type SortBy } from '$lib/statsSorting';

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
