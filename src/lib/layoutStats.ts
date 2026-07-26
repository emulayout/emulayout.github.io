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
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeCminiStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	type CyanophageStatSortKey,
	type Mana2StatSortKey,
	type StatSortKey
} from '$lib/statsDerivation';
import { getStatSortAnalyzer, getStatSortField, type SortBy } from '$lib/statsSorting';
import {
	getStatFilterFieldsForAnalyzer,
	getStatFilterStatKey,
	type StatLimitKey
} from '$lib/statsFiltering';

export * from '$lib/statsAnalyzers';
export * from '$lib/statsBlockFormatting';
export * from '$lib/statsCardFormatting';
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
