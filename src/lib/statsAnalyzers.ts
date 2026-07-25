/** Default analyzer for layout stats (matches common cmini bot preference). */
export const DEFAULT_STATS_ANALYZER = 'monkeyracer';

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Mana2 stats analyzer. */
export const MANA2_ANALYZER = 'mana2';

/** Concrete analyzers that own a stats JSON map. */
export const STAT_ANALYZERS = [
	{
		value: DEFAULT_STATS_ANALYZER,
		label: 'cmini (monkeyracer)',
		shortLabel: 'cmini',
		statsUrl: '/layout-stats.json'
	},
	{
		value: CYANOPHAGE_ANALYZER,
		label: 'Cyanophage',
		shortLabel: 'Cyanophage',
		statsUrl: '/layout-stats-cyanophage.json'
	},
	{
		value: MANA2_ANALYZER,
		label: 'Mana2',
		shortLabel: 'Mana2',
		statsUrl: '/layout-stats-mana2.json'
	}
] as const;

export type StatsAnalyzerDefinition = (typeof STAT_ANALYZERS)[number];
export type StatsAnalyzer = StatsAnalyzerDefinition['value'];

/** Toolbar / URL display modes (one concrete analyzer at a time). */
export const STAT_ANALYZER_MODES = STAT_ANALYZERS;

export type StatsAnalyzerMode = StatsAnalyzer;

const STATS_ANALYZER_BY_VALUE = new Map<StatsAnalyzer, StatsAnalyzerDefinition>(
	STAT_ANALYZERS.map((analyzer) => [analyzer.value, analyzer])
);
const STATS_ANALYZER_VALUES = new Set<string>(STAT_ANALYZERS.map((analyzer) => analyzer.value));

export function isStatsAnalyzer(value: string): value is StatsAnalyzer {
	return STATS_ANALYZER_VALUES.has(value);
}

export function isStatsAnalyzerMode(value: string): value is StatsAnalyzerMode {
	return isStatsAnalyzer(value);
}

/** Parse toolbar/URL analyzer; legacy `all` maps to the default analyzer. */
export function parseStatsAnalyzerMode(value: string | null | undefined): StatsAnalyzerMode {
	if (!value || value === 'all') return DEFAULT_STATS_ANALYZER;
	return isStatsAnalyzer(value) ? value : DEFAULT_STATS_ANALYZER;
}

export function getAnalyzerDefinition(analyzer: StatsAnalyzer): StatsAnalyzerDefinition {
	const definition = STATS_ANALYZER_BY_VALUE.get(analyzer);
	if (!definition) {
		throw new Error(`Unknown stats analyzer: ${analyzer}`);
	}
	return definition;
}

export function analyzerShortLabel(analyzer: StatsAnalyzer): string {
	return getAnalyzerDefinition(analyzer).shortLabel;
}

export function getAnalyzerStatsUrl(analyzer: StatsAnalyzer): string {
	return getAnalyzerDefinition(analyzer).statsUrl;
}

/** Concrete analyzers included in a display mode. */
export function resolveStatsAnalyzers(mode: StatsAnalyzerMode): StatsAnalyzer[] {
	return [mode];
}

/** Whether a concrete analyzer’s stats should render for the current display mode. */
export function showsAnalyzerStats(mode: StatsAnalyzerMode, analyzer: StatsAnalyzer): boolean {
	return mode === analyzer;
}

export function showsMonkeyracerStats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, DEFAULT_STATS_ANALYZER);
}

export function showsCyanophageStats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, CYANOPHAGE_ANALYZER);
}

export function showsMana2Stats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, MANA2_ANALYZER);
}

/** Concrete analyzer used when disambiguating sort fields for a display mode. */
export function concreteAnalyzerForSort(mode: StatsAnalyzerMode): StatsAnalyzer {
	return mode;
}
