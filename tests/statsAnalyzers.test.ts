import { describe, expect, test } from 'bun:test';
import {
	CMINI_ANALYZER,
	CYANOPHAGE_ANALYZER,
	CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED_LABEL,
	CYANOPHAGE_UNSUPPORTED_LABEL,
	DEFAULT_STATS_ANALYZER,
	MANA2_ANALYZER,
	MONKEYRACER_CORPUS,
	REDDIT_CORPUS,
	STAT_ANALYZERS,
	STAT_CORPORA,
	STATS_DATASETS,
	analyzerShortLabel,
	analyzerUsesSelectableCorpus,
	dumpSyncedCorpora,
	getAnalyzerStatsUrl,
	getCyanophageStatsUnavailableReason,
	getStatsDataset,
	isStatsAnalyzer,
	isStatsCorpus,
	parseStatsAnalyzerMode,
	parseStatsCorpus,
	resolveStatsAnalyzers,
	showsCyanophageStats,
	showsMana2Stats,
	showsCminiStats
} from '$lib/statsAnalyzers';

describe('stats analyzer catalog', () => {
	test('defines each concrete analyzer independently of its dataset', () => {
		expect(STAT_ANALYZERS.map(({ value }) => value)).toEqual([
			CMINI_ANALYZER,
			CYANOPHAGE_ANALYZER,
			MANA2_ANALYZER
		]);
		expect(DEFAULT_STATS_ANALYZER).toBe(CMINI_ANALYZER);
		expect(getAnalyzerStatsUrl(CMINI_ANALYZER)).toBe('/layout-stats-cmini-monkeyracer.json');
		expect(getAnalyzerStatsUrl(CYANOPHAGE_ANALYZER)).toBe('/layout-stats-cyanophage.json');
		expect(getAnalyzerStatsUrl(MANA2_ANALYZER)).toBe(
			'/layout-stats-mana2-monkeyracer-rowstag-none.json'
		);
		expect(analyzerShortLabel(CMINI_ANALYZER)).toBe('cmini');
	});

	test('models generated artifacts separately from analyzer identities', () => {
		expect(STAT_CORPORA.map(({ value }) => value)).toEqual([MONKEYRACER_CORPUS, REDDIT_CORPUS]);
		expect(STATS_DATASETS).toContainEqual({
			analyzer: CMINI_ANALYZER,
			corpus: MONKEYRACER_CORPUS,
			isDefault: true,
			statsUrl: '/layout-stats-cmini-monkeyracer.json'
		});
		expect(STATS_DATASETS).toContainEqual({
			analyzer: CMINI_ANALYZER,
			corpus: REDDIT_CORPUS,
			isDefault: false,
			statsUrl: '/layout-stats-cmini-reddit.json'
		});
		expect(STATS_DATASETS).toContainEqual({
			analyzer: MANA2_ANALYZER,
			corpus: REDDIT_CORPUS,
			isDefault: false,
			statsUrl: '/layout-stats-mana2-reddit-rowstag-none.json'
		});
		expect(
			STAT_ANALYZERS.every(
				({ value }) =>
					STATS_DATASETS.filter((dataset) => dataset.analyzer === value && dataset.isDefault)
						.length === 1
			)
		).toBe(true);
		expect(getStatsDataset(MANA2_ANALYZER).corpus).toBe(MONKEYRACER_CORPUS);
		expect(getStatsDataset(CYANOPHAGE_ANALYZER).corpus).toBeNull();
		expect(getAnalyzerStatsUrl(CMINI_ANALYZER, MONKEYRACER_CORPUS)).toBe(
			'/layout-stats-cmini-monkeyracer.json'
		);
		expect(getAnalyzerStatsUrl(CMINI_ANALYZER, REDDIT_CORPUS)).toBe(
			'/layout-stats-cmini-reddit.json'
		);
		expect(getAnalyzerStatsUrl(MANA2_ANALYZER, MONKEYRACER_CORPUS)).toBe(
			'/layout-stats-mana2-monkeyracer-rowstag-none.json'
		);
		expect(getAnalyzerStatsUrl(MANA2_ANALYZER, REDDIT_CORPUS)).toBe(
			'/layout-stats-mana2-reddit-rowstag-none.json'
		);
		expect(dumpSyncedCorpora(CMINI_ANALYZER)).toEqual([MONKEYRACER_CORPUS, REDDIT_CORPUS]);
		expect(dumpSyncedCorpora(MANA2_ANALYZER)).toEqual([MONKEYRACER_CORPUS, REDDIT_CORPUS]);
		expect(dumpSyncedCorpora(CYANOPHAGE_ANALYZER)).toEqual([]);
		expect(() => getStatsDataset(CYANOPHAGE_ANALYZER, MONKEYRACER_CORPUS)).toThrow();
	});

	test('parses analyzer modes without treating a corpus as an analyzer', () => {
		expect(isStatsAnalyzer(DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(CYANOPHAGE_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(MANA2_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(MONKEYRACER_CORPUS)).toBe(false);
		expect(isStatsAnalyzer('all')).toBe(false);
		expect(isStatsAnalyzer('unknown')).toBe(false);
		expect(parseStatsAnalyzerMode(CYANOPHAGE_ANALYZER)).toBe(CYANOPHAGE_ANALYZER);
		expect(parseStatsAnalyzerMode(MONKEYRACER_CORPUS)).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode('unknown')).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode(null)).toBe(DEFAULT_STATS_ANALYZER);
	});

	test('parses selectable corpora and marks dump-backed analyzers', () => {
		expect(isStatsCorpus(MONKEYRACER_CORPUS)).toBe(true);
		expect(isStatsCorpus(REDDIT_CORPUS)).toBe(true);
		expect(isStatsCorpus(CMINI_ANALYZER)).toBe(false);
		expect(parseStatsCorpus(REDDIT_CORPUS)).toBe(REDDIT_CORPUS);
		expect(parseStatsCorpus('unknown')).toBe(MONKEYRACER_CORPUS);
		expect(parseStatsCorpus(null)).toBe(MONKEYRACER_CORPUS);
		expect(analyzerUsesSelectableCorpus(CMINI_ANALYZER)).toBe(true);
		expect(analyzerUsesSelectableCorpus(MANA2_ANALYZER)).toBe(true);
		expect(analyzerUsesSelectableCorpus(CYANOPHAGE_ANALYZER)).toBe(false);
	});

	test('resolves single-analyzer display modes and visibility', () => {
		expect(resolveStatsAnalyzers(MANA2_ANALYZER)).toEqual([MANA2_ANALYZER]);
		expect(showsCminiStats(DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(showsCyanophageStats(CYANOPHAGE_ANALYZER)).toBe(true);
		expect(showsMana2Stats(MANA2_ANALYZER)).toBe(true);
		expect(showsMana2Stats(DEFAULT_STATS_ANALYZER)).toBe(false);
	});

	test('prefers Magic-mappings explanation over unsupported characters', () => {
		expect(
			getCyanophageStatsUnavailableReason({
				cyanophageCompatible: false,
				cyanophageStatsNeedMagicMappings: true
			})
		).toBe(CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED_LABEL);
		expect(
			getCyanophageStatsUnavailableReason({
				cyanophageCompatible: false,
				cyanophageStatsNeedMagicMappings: false
			})
		).toBe(CYANOPHAGE_UNSUPPORTED_LABEL);
		expect(
			getCyanophageStatsUnavailableReason({
				cyanophageCompatible: true,
				cyanophageStatsNeedMagicMappings: false
			})
		).toBeUndefined();
	});
});
