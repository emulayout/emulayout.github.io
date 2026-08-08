import { STAT_ANALYZERS, isStatsAnalyzer, type StatsAnalyzer } from '$lib/statsAnalyzers';

export const LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY = 'layoutDetailStatsAnalyzers';

export function normalizeLayoutDetailStatsAnalyzers(
	values: Iterable<StatsAnalyzer>
): StatsAnalyzer[] {
	const selected = new Set(values);
	return STAT_ANALYZERS.map((analyzer) => analyzer.value).filter((analyzer) =>
		selected.has(analyzer)
	);
}

/** Null means the user has not saved a detail-page analyzer selection yet. */
export function parseLayoutDetailStatsAnalyzers(value: string | null): StatsAnalyzer[] | null {
	if (value === null) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return null;
		return normalizeLayoutDetailStatsAnalyzers(
			parsed.filter((analyzer): analyzer is StatsAnalyzer =>
				typeof analyzer === 'string' ? isStatsAnalyzer(analyzer) : false
			)
		);
	} catch {
		return null;
	}
}
