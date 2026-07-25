import { describe, expect, test } from 'bun:test';
import {
	CMINI_ANALYZER,
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	MANA2_ANALYZER,
	MONKEYRACER_CORPUS,
	STAT_ANALYZERS,
	STATS_DATASETS,
	analyzerShortLabel,
	getAnalyzerStatsUrl,
	getStatsDataset,
	isStatsAnalyzer,
	parseStatsAnalyzerMode,
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
		expect(getAnalyzerStatsUrl(CMINI_ANALYZER)).toBe('/layout-stats.json');
		expect(getAnalyzerStatsUrl(CYANOPHAGE_ANALYZER)).toBe('/layout-stats-cyanophage.json');
		expect(getAnalyzerStatsUrl(MANA2_ANALYZER)).toBe('/layout-stats-mana2.json');
		expect(analyzerShortLabel(CMINI_ANALYZER)).toBe('cmini');
	});

	test('models generated artifacts separately from analyzer identities', () => {
		expect(STATS_DATASETS).toContainEqual({
			analyzer: CMINI_ANALYZER,
			corpus: MONKEYRACER_CORPUS,
			isDefault: true,
			statsUrl: '/layout-stats.json'
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
		expect(getAnalyzerStatsUrl(CMINI_ANALYZER, MONKEYRACER_CORPUS)).toBe('/layout-stats.json');
		expect(() => getStatsDataset(CYANOPHAGE_ANALYZER, MONKEYRACER_CORPUS)).toThrow();
	});

	test('parses analyzer modes without treating a corpus as an analyzer', () => {
		expect(isStatsAnalyzer(DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(CYANOPHAGE_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(MANA2_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(MONKEYRACER_CORPUS)).toBe(false);
		expect(isStatsAnalyzer('unknown')).toBe(false);
		expect(parseStatsAnalyzerMode(CYANOPHAGE_ANALYZER)).toBe(CYANOPHAGE_ANALYZER);
		expect(parseStatsAnalyzerMode(MONKEYRACER_CORPUS)).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode('all')).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode('unknown')).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode(null)).toBe(DEFAULT_STATS_ANALYZER);
	});

	test('resolves single-analyzer display modes and visibility', () => {
		expect(resolveStatsAnalyzers(MANA2_ANALYZER)).toEqual([MANA2_ANALYZER]);
		expect(showsCminiStats(DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(showsCyanophageStats(CYANOPHAGE_ANALYZER)).toBe(true);
		expect(showsMana2Stats(MANA2_ANALYZER)).toBe(true);
		expect(showsMana2Stats(DEFAULT_STATS_ANALYZER)).toBe(false);
	});
});
