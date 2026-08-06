import { describe, expect, test } from 'bun:test';
import {
	BOT_STAT_KEYS,
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_STAT_KEYS,
	MANA2_COMPACT_STAT_FIELD_COUNT,
	MANA2_STAT_KEYS,
	decodeCyanophageStats,
	decodeMana2Stats,
	decodeCminiStats,
	deriveBotStats,
	deriveCyanophageStats,
	deriveMana2Stats
} from '$lib/statsDerivation';

function setCompactValue(
	values: number[],
	keys: readonly string[],
	key: string,
	value: number
): void {
	const index = keys.indexOf(key);
	if (index === -1) throw new Error(`Unknown compact stat key: ${key}`);
	values[index] = value;
}

describe('frontend stats decoding and derivation', () => {
	test('rejects malformed or empty compact analyzer arrays', () => {
		expect(decodeCminiStats([])).toBeUndefined();
		expect(decodeCminiStats(Array(COMPACT_STAT_FIELD_COUNT).fill(0))).toBeUndefined();
		expect(decodeCyanophageStats([])).toBeUndefined();
		expect(
			decodeCyanophageStats(Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(0))
		).toBeUndefined();
		expect(decodeMana2Stats([])).toBeUndefined();
		expect(decodeMana2Stats(Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(0))).toBeUndefined();
	});

	test('maps and derives cmini values from the local compact-array contract', () => {
		const compact = Array(COMPACT_STAT_FIELD_COUNT).fill(0);
		setCompactValue(compact, BOT_STAT_KEYS, 'alternate', 1_000);
		setCompactValue(compact, BOT_STAT_KEYS, 'roll-in', 2_000);
		setCompactValue(compact, BOT_STAT_KEYS, 'roll-out', 3_000);
		setCompactValue(compact, BOT_STAT_KEYS, 'oneh-in', 4_000);
		setCompactValue(compact, BOT_STAT_KEYS, 'oneh-out', 5_000);
		setCompactValue(compact, BOT_STAT_KEYS, 'redirect', 6_000);
		setCompactValue(compact, BOT_STAT_KEYS, 'bad-redirect', 700);
		setCompactValue(compact, BOT_STAT_KEYS, 'dsfb-red', 800);
		setCompactValue(compact, BOT_STAT_KEYS, 'dsfb-alt', 900);
		setCompactValue(compact, BOT_STAT_KEYS, 'LI', 1_100);

		const decoded = decodeCminiStats(compact);
		expect(decoded).toBeDefined();
		const derived = deriveBotStats(decoded!);
		expect(derived.alternate).toBeCloseTo(0.1);
		expect(derived.roll).toBeCloseTo(0.5);
		expect(derived.one).toBeCloseTo(0.9);
		expect(derived.rtl).toBeCloseTo(1.4);
		expect(derived.red).toBeCloseTo(0.67);
		expect(derived.sfs).toBeCloseTo(0.17);
		expect(derived.LI).toBeCloseTo(0.11);
	});

	test('maps Cyanophage values and exposes camel-case derived fields', () => {
		const compact = Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(0);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'total-word-effort', 50_000);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'effort', 25_000);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'distance', 1_234_000);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'distance-LI', 123_000);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'sfb', 100);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'alt-sfs', 200);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'roll-in', 300);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'roll-out', 400);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'roll-in-2', 500);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'roll-out-2', 600);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'roll-in-3', 700);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'roll-out-3', 800);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'redirect-weak', 900);
		setCompactValue(compact, CYANOPHAGE_STAT_KEYS, 'LI', 1_500);

		const decoded = decodeCyanophageStats(compact);
		expect(decoded).toBeDefined();
		const derived = deriveCyanophageStats(decoded!);
		expect(derived.totalWordEffort).toBe(5);
		expect(derived.effort).toBe(2.5);
		expect(derived.distance).toBe(123.4);
		expect(derived.distanceLI).toBe(12.3);
		expect(derived.sfb).toBeCloseTo(0.01);
		expect(derived.altSfs).toBeCloseTo(0.02);
		expect(derived.rollIn).toBeCloseTo(0.03);
		expect(derived.rollOut).toBeCloseTo(0.04);
		expect(derived.rollIn2).toBeCloseTo(0.05);
		expect(derived.rollOut2).toBeCloseTo(0.06);
		expect(derived.rollIn3).toBeCloseTo(0.07);
		expect(derived.rollOut3).toBeCloseTo(0.08);
		expect(derived.redirectWeak).toBeCloseTo(0.09);
		expect(derived.LI).toBeCloseTo(0.15);
	});

	test('normalizes Mana2 percentage-points while preserving raw stretch values', () => {
		const compact = Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(0);
		setCompactValue(compact, MANA2_STAT_KEYS, 'sfb', 25_000);
		setCompactValue(compact, MANA2_STAT_KEYS, 'lsb', 12_340);
		setCompactValue(compact, MANA2_STAT_KEYS, 'finger-usage-LP', 100_000);
		setCompactValue(compact, MANA2_STAT_KEYS, 'finger-usage-LT', 50_000);
		setCompactValue(compact, MANA2_STAT_KEYS, 'finger-usage-RP', 80_000);
		setCompactValue(compact, MANA2_STAT_KEYS, 'finger-usage-RT', 20_000);

		const decoded = decodeMana2Stats(compact);
		expect(decoded).toBeDefined();
		expect(decoded?.sfb).toBeCloseTo(0.025);
		expect(decoded?.lsb).toBeCloseTo(1.234);

		const derived = deriveMana2Stats(decoded!);
		expect(derived.lh).toBeCloseTo(0.15);
		expect(derived.rh).toBeCloseTo(0.1);
		expect(derived.LP).toBeCloseTo(0.1);
		expect(derived.RP).toBeCloseTo(0.08);
	});
});
