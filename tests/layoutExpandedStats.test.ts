import { describe, expect, test } from 'bun:test';
import { buildExpandedStatsTables } from '$lib/layoutExpandedStats';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeCminiStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats,
	MANA2_COMPACT_STAT_FIELD_COUNT
} from '$lib/statsDerivation';

function makeStats() {
	const cmini = decodeCminiStats(Array(COMPACT_STAT_FIELD_COUNT).fill(10_000));
	const cyanophage = decodeCyanophageStats(Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000));
	const mana2 = decodeMana2Stats(Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000));
	if (!cmini || !cyanophage || !mana2) throw new Error('Expected valid compact test stats');
	return {
		cminiStats: deriveBotStats(cmini),
		cyanophageStats: deriveCyanophageStats(cyanophage),
		mana2Stats: deriveMana2Stats(mana2)
	};
}

describe('expanded layout stats tables', () => {
	test('maps shared, paired, raw, and hand metrics across analyzers', () => {
		const tables = buildExpandedStatsTables({
			...makeStats(),
			cminiLoading: false,
			cyanophageLoading: false,
			mana2Loading: false
		});

		expect(tables.sharedRows).toHaveLength(13);
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
		expect(rollPair?.cmini).toContain(' | ');
		expect(rollPair?.cyanophage).toContain(' | ');
		expect(rollPair?.mana2).toContain(' | ');

		const recoveredCells = [
			['Same-finger skip', 'cmini'],
			['Alt & SFS', 'cyanophage'],
			['Roll in / out (total)', 'cyanophage'],
			['Roll in / out (3)', 'cyanophage'],
			['Weak / bad redirect', 'cyanophage']
		] as const;
		for (const [label, analyzer] of recoveredCells) {
			expect(tables.sharedRows.find((row) => row.label === label)?.[analyzer]).not.toBe('—');
		}

		const unavailableCells = tables.sharedRows.flatMap((row) =>
			(['cmini', 'cyanophage', 'mana2'] as const)
				.filter((analyzer) => row[analyzer] === '—')
				.map((analyzer) => `${row.label}:${analyzer}`)
		);
		expect(unavailableCells).toEqual([
			'Redirect & SFS:cyanophage',
			'Lat stretch bigrams:cmini',
			'Scissors:cmini'
		]);

		const lateralStretch = tables.sharedRows.find((row) => row.label === 'Lat stretch bigrams');
		expect(lateralStretch?.cmini).toBe('—');
		expect(lateralStretch?.mana2).toBe('1.000');
	});

	test('uses loading and unavailable markers per analyzer', () => {
		const { cminiStats } = makeStats();
		const tables = buildExpandedStatsTables({
			cminiStats,
			cyanophageStats: null,
			mana2Stats: null,
			cminiLoading: true,
			cyanophageLoading: false,
			mana2Loading: true
		});

		const first = tables.sharedRows[0];
		expect(first.cmini).toBe('…');
		expect(first.cyanophage).toBe('—');
		expect(first.mana2).toBe('…');
	});
});
