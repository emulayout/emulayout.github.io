import { describe, expect, test } from 'bun:test';
import type { CminiStats, CyanophageStats, Mana2Stats } from '$lib/layout';
import {
	BOT_STAT_KEYS,
	CYANOPHAGE_STAT_KEYS,
	MANA2_STAT_KEYS,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	type DerivedBotStats,
	type DerivedCyanophageStats,
	type DerivedMana2Stats
} from '$lib/statsDerivation';
import {
	buildBotStatsBlockLines,
	buildCyanophageStatsBlockLines,
	buildMana2StatsBlockLines,
	formatCyanophageStatsUnavailableBlock,
	formatMana2StatsLoadingBlock,
	formatStatsUnavailableBlock
} from '$lib/statsCardFormatting';
import {
	CYANOPHAGE_STATS_BLOCK_LINE_COUNT,
	MANA2_STATS_BLOCK_LINE_COUNT,
	STATS_BLOCK_LINE_COUNT,
	type StatsBlockSegment
} from '$lib/statsBlockFormatting';

function cminiStats(value = 0.1): DerivedBotStats {
	const stats = Object.fromEntries(
		BOT_STAT_KEYS.map((key) => [key, value])
	) as unknown as CminiStats;
	return deriveBotStats(stats);
}

function cyanophageStats(value = 0.1): DerivedCyanophageStats {
	const stats = Object.fromEntries(
		CYANOPHAGE_STAT_KEYS.map((key) => [key, value])
	) as unknown as CyanophageStats;
	return deriveCyanophageStats(stats);
}

function mana2Stats(value = 0.1): DerivedMana2Stats {
	const stats = Object.fromEntries(MANA2_STAT_KEYS.map((key) => [key, value])) as Mana2Stats;
	return deriveMana2Stats(stats);
}

function lineForLabel(lines: StatsBlockSegment[][], label: string): StatsBlockSegment[] {
	const line = lines.find((candidate) =>
		candidate.some((segment) => segment.text.trim() === label)
	);
	if (!line) throw new Error(`Expected stats line for ${label}`);
	return line;
}

describe('stats card formatting', () => {
	test('keeps analyzer blocks and fallbacks at their fixed display heights', () => {
		expect(buildBotStatsBlockLines(cminiStats())).toHaveLength(STATS_BLOCK_LINE_COUNT);
		expect(buildCyanophageStatsBlockLines(cyanophageStats())).toHaveLength(
			CYANOPHAGE_STATS_BLOCK_LINE_COUNT
		);
		expect(buildMana2StatsBlockLines(mana2Stats())).toHaveLength(MANA2_STATS_BLOCK_LINE_COUNT);

		expect(formatStatsUnavailableBlock().split('\n')).toHaveLength(STATS_BLOCK_LINE_COUNT);
		expect(formatCyanophageStatsUnavailableBlock().split('\n')).toHaveLength(
			CYANOPHAGE_STATS_BLOCK_LINE_COUNT
		);
		expect(formatMana2StatsLoadingBlock().split('\n')).toHaveLength(MANA2_STATS_BLOCK_LINE_COUNT);
	});

	test('applies independent cmini filter and sort highlights', () => {
		const lines = buildBotStatsBlockLines(cminiStats(), new Set(['sfb']), 'rollIn', 'asc');
		const rollLine = lineForLabel(lines, 'Rol▲');
		const sfbLine = lineForLabel(lines, 'SFB:');

		expect(rollLine[0]).toMatchObject({ text: 'Rol▲ ', highlight: 'sort' });
		expect(sfbLine.some((segment) => segment.highlight === 'cmini')).toBe(true);
	});

	test('preserves raw Cyanophage and Mana2 values while formatting percentages', () => {
		const cyanophage = { ...cyanophageStats(), totalWordEffort: 12.34, distance: 345.67 };
		const cyanophageLines = buildCyanophageStatsBlockLines(cyanophage);
		const cyanophageValue = lineForLabel(cyanophageLines, 'Total Word Effort:')[1].text;
		expect(cyanophageValue.trim()).toBe('12.3');
		expect(cyanophageValue).not.toContain('%');
		expect(lineForLabel(cyanophageLines, 'Distance:')[1].text.trim()).toBe('345.7');

		const mana2 = { ...mana2Stats(), lsb: 1.2345, lss: 2.3456 };
		const stretchLine = lineForLabel(buildMana2StatsBlockLines(mana2), 'Stretch:');
		expect(stretchLine[1].text.trim()).toBe('1.234');
		expect(stretchLine[3].text.trim()).toBe('2.346');
		expect(lineForLabel(buildMana2StatsBlockLines(mana2), 'Same Finger:')[1].text).toContain('%');
	});

	test('uses the supplied unavailable reason without changing placeholder height', () => {
		const fallback = formatCyanophageStatsUnavailableBlock('layout is incompatible');
		expect(fallback.split('\n')).toHaveLength(CYANOPHAGE_STATS_BLOCK_LINE_COUNT);
		expect(fallback).toContain('layout is incompatible');
	});
});
