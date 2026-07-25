import { describe, expect, test } from 'bun:test';
import {
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	MANA2_ANALYZER,
	STAT_ANALYZERS,
	analyzerShortLabel,
	getAnalyzerStatsUrl,
	isStatsAnalyzer,
	parseStatsAnalyzerMode,
	resolveStatsAnalyzers,
	showsCyanophageStats,
	showsMana2Stats,
	showsMonkeyracerStats
} from '$lib/statsAnalyzers';

describe('stats analyzer catalog', () => {
	test('defines each concrete analyzer and its generated artifact', () => {
		expect(STAT_ANALYZERS.map(({ value }) => value)).toEqual([
			DEFAULT_STATS_ANALYZER,
			CYANOPHAGE_ANALYZER,
			MANA2_ANALYZER
		]);
		expect(getAnalyzerStatsUrl(DEFAULT_STATS_ANALYZER)).toBe('/layout-stats.json');
		expect(getAnalyzerStatsUrl(CYANOPHAGE_ANALYZER)).toBe('/layout-stats-cyanophage.json');
		expect(getAnalyzerStatsUrl(MANA2_ANALYZER)).toBe('/layout-stats-mana2.json');
		expect(analyzerShortLabel(DEFAULT_STATS_ANALYZER)).toBe('cmini');
	});

	test('parses supported modes and normalizes legacy or invalid values', () => {
		expect(isStatsAnalyzer(DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(CYANOPHAGE_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer(MANA2_ANALYZER)).toBe(true);
		expect(isStatsAnalyzer('unknown')).toBe(false);
		expect(parseStatsAnalyzerMode(CYANOPHAGE_ANALYZER)).toBe(CYANOPHAGE_ANALYZER);
		expect(parseStatsAnalyzerMode('all')).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode('unknown')).toBe(DEFAULT_STATS_ANALYZER);
		expect(parseStatsAnalyzerMode(null)).toBe(DEFAULT_STATS_ANALYZER);
	});

	test('resolves single-analyzer display modes and visibility', () => {
		expect(resolveStatsAnalyzers(MANA2_ANALYZER)).toEqual([MANA2_ANALYZER]);
		expect(showsMonkeyracerStats(DEFAULT_STATS_ANALYZER)).toBe(true);
		expect(showsCyanophageStats(CYANOPHAGE_ANALYZER)).toBe(true);
		expect(showsMana2Stats(MANA2_ANALYZER)).toBe(true);
		expect(showsMana2Stats(DEFAULT_STATS_ANALYZER)).toBe(false);
	});
});
