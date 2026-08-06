/** cmini stats analyzer. */
export const CMINI_ANALYZER = 'cmini';

/** Default analyzer shown by the frontend. */
export const DEFAULT_STATS_ANALYZER = CMINI_ANALYZER;

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Shown when a layout cannot be linked or measured faithfully in Cyanophage. */
export const CYANOPHAGE_UNSUPPORTED_LABEL = 'Unsupported characters for Cyanophage';

/**
 * Shown when a layout has a Magic key but Cyanophage stats need curated mappings
 * before Emulayout will measure it.
 */
export const CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED_LABEL = 'Cyanophage stats need Magic key mappings';

/**
 * Prefer a Magic-mappings explanation over the generic unsupported-characters
 * label when both apply (layouts with `*` are also playground-incompatible).
 */
export function getCyanophageStatsUnavailableReason(layout: {
	cyanophageCompatible: boolean;
	cyanophageStatsNeedMagicMappings: boolean;
}): string | undefined {
	if (layout.cyanophageStatsNeedMagicMappings) {
		return CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED_LABEL;
	}
	if (!layout.cyanophageCompatible) {
		return CYANOPHAGE_UNSUPPORTED_LABEL;
	}
	return undefined;
}
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

/** Default corpus when the UI / loader does not select one explicitly. */
export const DEFAULT_STATS_CORPUS = MONKEYRACER_CORPUS;

/** Corpora with an explicit frontend identity. */
export const STAT_CORPORA = [
	{
		value: MONKEYRACER_CORPUS,
		label: 'Monkeyracer'
	}
] as const;

export type StatsCorpusDefinition = (typeof STAT_CORPORA)[number];
export type StatsCorpus = StatsCorpusDefinition['value'];

/** Published compact cmini stats for a corpus. */
export function cminiStatsUrl(corpus: StatsCorpus = DEFAULT_STATS_CORPUS): string {
	return `/layout-stats-cmini-${corpus}.json`;
}

/** Published Mana2 stats for a corpus. */
export function mana2StatsUrl(corpus: StatsCorpus = DEFAULT_STATS_CORPUS): string {
	return `/layout-stats-mana2-${corpus}.json`;
}

/**
 * A generated stats artifact is analyzer output for a particular corpus.
 * Cyanophage's current bundled word-frequency input has no selectable corpus id yet.
 */
export const STATS_DATASETS = [
	{
		analyzer: CMINI_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: true,
		statsUrl: cminiStatsUrl(MONKEYRACER_CORPUS)
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
		statsUrl: mana2StatsUrl(MONKEYRACER_CORPUS)
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

/** Parse a toolbar/URL analyzer, falling back to the default. */
export function parseStatsAnalyzerMode(value: string | null | undefined): StatsAnalyzerMode {
	if (!value) return DEFAULT_STATS_ANALYZER;
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
