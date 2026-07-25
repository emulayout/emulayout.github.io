import { describe, expect, test } from 'bun:test';
import { buildExpandedStatsTables } from '$lib/layoutExpandedStats';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeMonkeyracerStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	MANA2_COMPACT_STAT_FIELD_COUNT
} from '$lib/layoutStats';

function makeStats() {
	const monkey = decodeMonkeyracerStats(Array(COMPACT_STAT_FIELD_COUNT).fill(10_000));
	const cyanophage = decodeCyanophageStats(Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000));
	const mana2 = decodeMana2Stats(Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000));
	if (!monkey || !cyanophage || !mana2) throw new Error('Expected valid compact test stats');
	return {
		monkeyStats: deriveBotStats(monkey),
		cyanophageStats: deriveCyanophageStats(cyanophage),
		mana2Stats: deriveMana2Stats(mana2)
	};
}

describe('expanded layout stats tables', () => {
	test('maps shared, paired, raw, and hand metrics across analyzers', () => {
		const tables = buildExpandedStatsTables({
			...makeStats(),
			monkeyLoading: false,
			cyanophageLoading: false,
			mana2Loading: false
		});

		expect(tables.sharedRows).toHaveLength(12);
		expect(tables.leftHandRows.map((row) => row.label)).toEqual([
			'Hand',
			'Index',
			'Middle',
			'Ring',
			'Pinky',
			'Thumb'
		]);
		expect(tables.rightHandRows.map((row) => row.label)).toEqual([
			'Hand',
			'Index',
			'Middle',
			'Ring',
			'Pinky',
			'Thumb'
		]);

		const rollPair = tables.sharedRows.find((row) => row.label === 'Roll in / out (2)');
		expect(rollPair?.monkey).toContain(' | ');
		expect(rollPair?.mana2).toContain(' | ');

		const lateralStretch = tables.sharedRows.find((row) => row.label === 'Lat stretch bigrams');
		expect(lateralStretch?.monkey).toBe('—');
		expect(lateralStretch?.mana2).toBe('1.000');
	});

	test('uses loading and unavailable markers per analyzer', () => {
		const { monkeyStats } = makeStats();
		const tables = buildExpandedStatsTables({
			monkeyStats,
			cyanophageStats: null,
			mana2Stats: null,
			monkeyLoading: true,
			cyanophageLoading: false,
			mana2Loading: true
		});

		const first = tables.sharedRows[0];
		expect(first.monkey).toBe('…');
		expect(first.cyanophage).toBe('—');
		expect(first.mana2).toBe('…');
	});
});
