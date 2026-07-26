/** cmini stats analyzer. */
export const CMINI_ANALYZER = 'cmini';

/** Default analyzer shown by the frontend. */
export const DEFAULT_STATS_ANALYZER = CMINI_ANALYZER;

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Shown when a layout cannot be linked or measured faithfully in Cyanophage. */
export const CYANOPHAGE_UNSUPPORTED_LABEL = 'Unsupported characters for Cyanophage';

/** Mana2 stats analyzer. */
export const MANA2_ANALYZER = 'mana2';

/** Concrete analyzers that own metric schemas and presentation metadata. */
export const STAT_ANALYZERS = [
	{
		value: CMINI_ANALYZER,
		label: 'cmini',
		shortLabel: 'cmini'
	},
	{
		value: CYANOPHAGE_ANALYZER,
		label: 'Cyanophage',
		shortLabel: 'Cyanophage'
	},
	{
		value: MANA2_ANALYZER,
		label: 'Mana2',
		shortLabel: 'Mana2'
	}
] as const;

export type StatsAnalyzerDefinition = (typeof STAT_ANALYZERS)[number];
export type StatsAnalyzer = StatsAnalyzerDefinition['value'];

/** Toolbar / URL display modes (one concrete analyzer at a time). */
export const STAT_ANALYZER_MODES = STAT_ANALYZERS;

export type StatsAnalyzerMode = StatsAnalyzer;

/** Corpus currently used for cmini and Mana2 generated stats. */
export const MONKEYRACER_CORPUS = 'monkeyracer';

/** Corpora with an explicit frontend identity. */
export const STAT_CORPORA = [
	{
		value: MONKEYRACER_CORPUS,
		label: 'Monkeyracer'
	}
] as const;

export type StatsCorpusDefinition = (typeof STAT_CORPORA)[number];
export type StatsCorpus = StatsCorpusDefinition['value'];

/**
 * A generated stats artifact is analyzer output for a particular corpus.
 * Cyanophage's current bundled word-frequency input has no selectable corpus id yet.
 */
export const STATS_DATASETS = [
	{
		analyzer: CMINI_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: true,
		statsUrl: '/layout-stats.json'
	},
	{
		analyzer: CYANOPHAGE_ANALYZER,
		corpus: null,
		isDefault: true,
		statsUrl: '/layout-stats-cyanophage.json'
	},
	{
		analyzer: MANA2_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: true,
		statsUrl: '/layout-stats-mana2.json'
	}
] as const satisfies readonly {
	analyzer: StatsAnalyzer;
	corpus: StatsCorpus | null;
	isDefault: boolean;
	statsUrl: string;
}[];

export type StatsDatasetDefinition = (typeof STATS_DATASETS)[number];

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

export function getStatsDataset(
	analyzer: StatsAnalyzer,
	corpus?: StatsCorpus
): StatsDatasetDefinition {
	const dataset = STATS_DATASETS.find(
		(entry) =>
			entry.analyzer === analyzer &&
			(corpus === undefined ? entry.isDefault : entry.corpus === corpus)
	);
	if (!dataset) {
		throw new Error(
			`No stats dataset for analyzer ${analyzer}${corpus ? ` and corpus ${corpus}` : ''}.`
		);
	}
	return dataset;
}

/** Resolve the current generated artifact for an analyzer and optional corpus. */
export function getAnalyzerStatsUrl(analyzer: StatsAnalyzer, corpus?: StatsCorpus): string {
	return getStatsDataset(analyzer, corpus).statsUrl;
}

/** Concrete analyzers included in a display mode. */
export function resolveStatsAnalyzers(mode: StatsAnalyzerMode): StatsAnalyzer[] {
	return [mode];
}

/** Whether a concrete analyzer’s stats should render for the current display mode. */
export function showsAnalyzerStats(mode: StatsAnalyzerMode, analyzer: StatsAnalyzer): boolean {
	return mode === analyzer;
}

export function showsCminiStats(mode: StatsAnalyzerMode): boolean {
	return showsAnalyzerStats(mode, CMINI_ANALYZER);
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
