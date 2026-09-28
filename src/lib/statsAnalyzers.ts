import { DEFAULT_KEYBOARD_GEOMETRY, type KeyboardGeometry } from '$lib/keyboardGeometry';

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

/** akl.gg board contexts corresponding to Emulayout's presentation geometries. */
export const STATS_BOARD_BY_GEOMETRY = {
	'column-stagger': 'ortho',
	'row-stagger': 'rowstag'
} as const satisfies Record<KeyboardGeometry, string>;

export type StatsBoard = (typeof STATS_BOARD_BY_GEOMETRY)[KeyboardGeometry];

/** Spacegram context used by both API-backed analyzers. */
export const DEFAULT_STATS_SPACE = 'none';

export function statsBoardForGeometry(geometry: KeyboardGeometry): StatsBoard {
	return STATS_BOARD_BY_GEOMETRY[geometry];
}

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

/** localStorage key for the API-backed corpus preference. */
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

/** Whether this analyzer publishes selectable API corpora (not Cyanophage). */
export function analyzerUsesSelectableCorpus(analyzer: StatsAnalyzer): boolean {
	return analyzer === CMINI_ANALYZER || analyzer === MANA2_ANALYZER;
}

/** Published compact cmini stats for a corpus and keyboard geometry. */
export function cminiStatsUrl(
	corpus: StatsCorpus = DEFAULT_STATS_CORPUS,
	geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY
): string {
	return `/layout-stats-cmini-${corpus}-${statsBoardForGeometry(geometry)}-${DEFAULT_STATS_SPACE}.json`;
}

/** Published Cyanophage stats for a viewer-selected keyboard geometry. */
export function cyanophageStatsUrl(geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY): string {
	return `/layout-stats-cyanophage-${geometry}.json`;
}

/** Published Mana2 stats for a corpus and keyboard geometry. */
export function mana2StatsUrl(
	corpus: StatsCorpus = DEFAULT_STATS_CORPUS,
	geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY
): string {
	return `/layout-stats-mana2-${corpus}-${statsBoardForGeometry(geometry)}-${DEFAULT_STATS_SPACE}.json`;
}

/**
 * A generated stats artifact is analyzer output for a particular corpus or geometry.
 * Cyanophage's bundled word-frequency input has no selectable corpus id, but its physical
 * measurements are published once per viewer geometry.
 */
export const STATS_DATASETS = [
	{
		analyzer: CMINI_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: false,
		geometry: 'column-stagger',
		statsUrl: cminiStatsUrl(MONKEYRACER_CORPUS, 'column-stagger')
	},
	{
		analyzer: CMINI_ANALYZER,
		corpus: REDDIT_CORPUS,
		isDefault: false,
		geometry: 'column-stagger',
		statsUrl: cminiStatsUrl(REDDIT_CORPUS, 'column-stagger')
	},
	{
		analyzer: CMINI_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: true,
		geometry: 'row-stagger',
		statsUrl: cminiStatsUrl(MONKEYRACER_CORPUS, 'row-stagger')
	},
	{
		analyzer: CMINI_ANALYZER,
		corpus: REDDIT_CORPUS,
		isDefault: false,
		geometry: 'row-stagger',
		statsUrl: cminiStatsUrl(REDDIT_CORPUS, 'row-stagger')
	},
	{
		analyzer: CYANOPHAGE_ANALYZER,
		corpus: null,
		isDefault: false,
		geometry: 'column-stagger',
		statsUrl: cyanophageStatsUrl('column-stagger')
	},
	{
		analyzer: CYANOPHAGE_ANALYZER,
		corpus: null,
		isDefault: true,
		geometry: 'row-stagger',
		statsUrl: cyanophageStatsUrl('row-stagger')
	},
	{
		analyzer: MANA2_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: false,
		geometry: 'column-stagger',
		statsUrl: mana2StatsUrl(MONKEYRACER_CORPUS, 'column-stagger')
	},
	{
		analyzer: MANA2_ANALYZER,
		corpus: REDDIT_CORPUS,
		isDefault: false,
		geometry: 'column-stagger',
		statsUrl: mana2StatsUrl(REDDIT_CORPUS, 'column-stagger')
	},
	{
		analyzer: MANA2_ANALYZER,
		corpus: MONKEYRACER_CORPUS,
		isDefault: true,
		geometry: 'row-stagger',
		statsUrl: mana2StatsUrl(MONKEYRACER_CORPUS, 'row-stagger')
	},
	{
		analyzer: MANA2_ANALYZER,
		corpus: REDDIT_CORPUS,
		isDefault: false,
		geometry: 'row-stagger',
		statsUrl: mana2StatsUrl(REDDIT_CORPUS, 'row-stagger')
	}
] as const satisfies readonly {
	analyzer: StatsAnalyzer;
	corpus: StatsCorpus | null;
	isDefault: boolean;
	statsUrl: string;
	geometry: KeyboardGeometry;
}[];

export type StatsDatasetDefinition = (typeof STATS_DATASETS)[number];

/** Dump-backed corpora published for an analyzer (excludes Cyanophage). */
export function apiSyncedCorpora(analyzer: StatsAnalyzer): StatsCorpus[] {
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
	corpus?: StatsCorpus,
	geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY
): StatsDatasetDefinition {
	const resolvedCorpus = corpus ?? DEFAULT_STATS_CORPUS;
	const dataset = STATS_DATASETS.find(
		(entry) =>
			entry.analyzer === analyzer &&
			entry.geometry === geometry &&
			(analyzer === CYANOPHAGE_ANALYZER ? entry.corpus === null : entry.corpus === resolvedCorpus)
	);
	if (!dataset) {
		throw new Error(
			`No stats dataset for analyzer ${analyzer}${corpus ? ` and corpus ${corpus}` : ''}.`
		);
	}
	return dataset;
}

/** Resolve the current generated artifact for an analyzer, corpus, and geometry. */
export function getAnalyzerStatsUrl(
	analyzer: StatsAnalyzer,
	corpus?: StatsCorpus,
	geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY
): string {
	return getStatsDataset(analyzer, corpus, geometry).statsUrl;
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
