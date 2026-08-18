/** cmini stats analyzer. */
export const CMINI_ANALYZER = 'cmini';

/** Default analyzer shown by the frontend. */
export const DEFAULT_STATS_ANALYZER = CMINI_ANALYZER;

/** Cyanophage stats analyzer. */
export const CYANOPHAGE_ANALYZER = 'cyanophage';

/** Shown when a layout cannot be linked or measured faithfully in Cyanophage. */
export const CYANOPHAGE_UNSUPPORTED_LABEL = 'Unsupported characters for Cyanophage';

/**
 * Shown when a layout has a Magic key but Cyanophage cannot model its exported mappings
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

/** Corpora used for cmini and Mana2 generated stats. */
export const MONKEYRACER_CORPUS = 'monkeyracer';
export const REDDIT_CORPUS = 'reddit';

/** Default corpus when the UI / loader does not select one explicitly. */
export const DEFAULT_STATS_CORPUS = MONKEYRACER_CORPUS;

/** Default Mana2 board / spacegrams context for published dumps. */
export const DEFAULT_MANA2_BOARD = 'rowstag';
export const DEFAULT_MANA2_SPACE = 'none';

/** Corpora with an explicit frontend identity. */
export const STAT_CORPORA = [
	{
		value: MONKEYRACER_CORPUS,
		label: 'Monkeyracer'
	},
	{
		value: REDDIT_CORPUS,
		label: 'Reddit'
	}
] as const;

export type StatsCorpusDefinition = (typeof STAT_CORPORA)[number];
export type StatsCorpus = StatsCorpusDefinition['value'];

/** localStorage key for the dump-backed corpus preference. */
export const STATS_CORPUS_STORAGE_KEY = 'statsCorpus';

const STATS_CORPUS_VALUES = new Set<string>(STAT_CORPORA.map((corpus) => corpus.value));

export function isStatsCorpus(value: string): value is StatsCorpus {
	return STATS_CORPUS_VALUES.has(value);
}

/** Parse a persisted corpus preference, falling back to the default. */
export function parseStatsCorpus(value: string | null | undefined): StatsCorpus {
	if (!value) return DEFAULT_STATS_CORPUS;
	return isStatsCorpus(value) ? value : DEFAULT_STATS_CORPUS;
}

/** Whether this analyzer publishes selectable dump corpora (not Cyanophage). */
export function analyzerUsesSelectableCorpus(analyzer: StatsAnalyzer): boolean {
	return analyzer === CMINI_ANALYZER || analyzer === MANA2_ANALYZER;
}

/** Published compact cmini stats for a corpus. */
export function cminiStatsUrl(corpus: StatsCorpus = DEFAULT_STATS_CORPUS): string {
	return `/layout-stats-cmini-${corpus}.json`;
}

/** Published Mana2 stats for a corpus / board / space context. */
export function mana2StatsUrl(
	corpus: StatsCorpus = DEFAULT_STATS_CORPUS,
	board: string = DEFAULT_MANA2_BOARD,
	space: string = DEFAULT_MANA2_SPACE
): string {
	return `/layout-stats-mana2-${corpus}-${board}-${space}.json`;
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
		analyzer: CMINI_ANALYZER,
		corpus: REDDIT_CORPUS,
		isDefault: false,
		statsUrl: cminiStatsUrl(REDDIT_CORPUS)
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
		statsUrl: mana2StatsUrl(MONKEYRACER_CORPUS, DEFAULT_MANA2_BOARD, DEFAULT_MANA2_SPACE)
	},
	{
		analyzer: MANA2_ANALYZER,
		corpus: REDDIT_CORPUS,
		isDefault: false,
		statsUrl: mana2StatsUrl(REDDIT_CORPUS, DEFAULT_MANA2_BOARD, DEFAULT_MANA2_SPACE)
	}
] as const satisfies readonly {
	analyzer: StatsAnalyzer;
	corpus: StatsCorpus | null;
	isDefault: boolean;
	statsUrl: string;
}[];

export type StatsDatasetDefinition = (typeof STATS_DATASETS)[number];

/** Dump-backed corpora published for an analyzer (excludes Cyanophage). */
export function dumpSyncedCorpora(analyzer: StatsAnalyzer): StatsCorpus[] {
	const corpora: StatsCorpus[] = [];
	for (const entry of STATS_DATASETS) {
		if (entry.analyzer !== analyzer || entry.corpus === null) continue;
		if (!corpora.includes(entry.corpus)) corpora.push(entry.corpus);
	}
	return corpora;
}

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
