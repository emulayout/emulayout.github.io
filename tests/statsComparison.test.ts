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
	buildBotStatsDiffBlockLines,
	buildCyanophageStatsDiffBlockLines,
	buildMana2StatsDiffBlockLines
} from '$lib/statsComparison';
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

function valueSegment(lines: StatsBlockSegment[][], label: string): StatsBlockSegment {
	const line = lines.find((candidate) =>
		candidate.some((segment) => segment.text.trim() === label)
	);
	const segment = line?.find((candidate) => candidate.tone !== undefined);
	if (!segment) throw new Error(`Expected comparison value for ${label}`);
	return segment;
}

describe('stats comparison formatting', () => {
	test('keeps each analyzer block at its fixed display height', () => {
		expect(buildBotStatsDiffBlockLines(cminiStats(), cminiStats())).toHaveLength(
			STATS_BLOCK_LINE_COUNT
		);
		expect(buildCyanophageStatsDiffBlockLines(cyanophageStats(), cyanophageStats())).toHaveLength(
			CYANOPHAGE_STATS_BLOCK_LINE_COUNT
		);
		expect(buildMana2StatsDiffBlockLines(mana2Stats(), mana2Stats())).toHaveLength(
			MANA2_STATS_BLOCK_LINE_COUNT
		);
	});

	test('marks higher-is-better and lower-is-better cmini changes correctly', () => {
		const previous = cminiStats();
		const next = {
			...previous,
			alternate: previous.alternate + 0.01,
			sfb: previous.sfb + 0.01
		};
		const lines = buildBotStatsDiffBlockLines(next, previous);

		expect(valueSegment(lines, 'Alt:')).toMatchObject({ text: '  1.00%', tone: 'better' });
		expect(valueSegment(lines, 'SFB:')).toMatchObject({ text: '  1.00%', tone: 'worse' });
	});

	test('uses raw delta units for Cyanophage effort/distance and Mana2 stretch', () => {
		const previousCyanophage = cyanophageStats();
		const nextCyanophage = {
			...previousCyanophage,
			totalWordEffort: previousCyanophage.totalWordEffort + 2.5
		};
		const cyanophageLines = buildCyanophageStatsDiffBlockLines(nextCyanophage, previousCyanophage);
		expect(valueSegment(cyanophageLines, 'Total Word Effort:')).toMatchObject({
			text: '   +2.5',
			tone: 'worse'
		});

		const fartherCyanophage = {
			...previousCyanophage,
			distance: previousCyanophage.distance + 3.2
		};
		expect(
			valueSegment(
				buildCyanophageStatsDiffBlockLines(fartherCyanophage, previousCyanophage),
				'Distance:'
			)
		).toMatchObject({
			text: '   +3.2',
			tone: 'worse'
		});

		const previousMana2 = mana2Stats();
		const nextMana2 = { ...previousMana2, lsb: previousMana2.lsb + 0.123 };
		const mana2Lines = buildMana2StatsDiffBlockLines(nextMana2, previousMana2);
		expect(valueSegment(mana2Lines, 'Stretch:')).toMatchObject({
			text: ' +0.123',
			tone: 'worse'
		});
	});

	test('keeps changes that round to a displayed zero neutral', () => {
		const previous = cminiStats();
		const next = { ...previous, alternate: previous.alternate + 0.000001 };
		const segment = valueSegment(buildBotStatsDiffBlockLines(next, previous), 'Alt:');

		expect(segment.text).toBe('  0.00%');
		expect(segment.tone).toBe('neutral');
	});
});
