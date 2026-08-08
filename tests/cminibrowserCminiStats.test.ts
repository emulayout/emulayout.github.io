import { describe, expect, test } from 'bun:test';
import {
	CMINIBROWSER_CMINI_STAT_KEYS,
	CMINIBROWSER_CMINI_STAT_VALUE_SCALE,
	encodeCminibrowserCminiDump,
	encodeCminibrowserCminiStats,
	indexCminibrowserCminiDump,
	lookupCminibrowserCminiStats
} from '../bin/cminibrowser-cmini-stats.js';

/** Sample from cminibrowser `/data/stats/monkeyracer.json` → `gallium`. */
const GALLIUM_DUMP = {
	roll_in: 0.195797,
	roll_out: 0.251111,
	alt: 0.326619,
	redirect: 0.020497,
	bad_redirect: 0.002225,
	oneh_in: 0.00448,
	oneh_out: 0.022144,
	sfr: 0.097133,
	sfs: 0.050627,
	sfs_alt: 0.042557,
	sfs_red: 0.00807,
	sfb: 0.00805,
	lh: 0.465512,
	rh: 0.534488,
	pinky: 0.182287,
	fingers: {
		LP: { use: 0.083589, fsp: 0.672545, wfsp: 0.448363, sfb: 0.000082, sfs: 0.001182 },
		LR: { use: 0.094668, fsp: 2.406347, wfsp: 0.66843, sfb: 0.001211, sfs: 0.003011 },
		LM: { use: 0.151044, fsp: 6.471734, wfsp: 1.348278, sfb: 0.00022, sfs: 0.009409 },
		LI: { use: 0.136211, fsp: 9.228712, wfsp: 1.677948, sfb: 0.002862, sfs: 0.011257 },
		RI: { use: 0.124497, fsp: 6.143346, wfsp: 1.116972, sfb: 0.001724, sfs: 0.006504 },
		RM: { use: 0.160652, fsp: 8.578382, wfsp: 1.787163, sfb: 0.000613, sfs: 0.009977 },
		RR: { use: 0.150641, fsp: 3.801502, wfsp: 1.055973, sfb: 0.001234, sfs: 0.006225 },
		RP: { use: 0.098698, fsp: 1.654724, wfsp: 1.10315, sfb: 0.000103, sfs: 0.003682 }
	},
	fspeed: 38.957292,
	fspeed_weighted: 9.206277
};

describe('cminibrowser cmini dump encoding', () => {
	test('maps gallium dump scalars and finger uses into BOT_STAT_KEYS order', () => {
		const compact = encodeCminibrowserCminiStats(GALLIUM_DUMP);
		expect(compact).toBeArrayOfSize(CMINIBROWSER_CMINI_STAT_KEYS.length);

		const byKey = Object.fromEntries(
			CMINIBROWSER_CMINI_STAT_KEYS.map((key, i) => [key, compact![i]])
		);
		expect(byKey.alternate).toBe(Math.round(0.326619 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey['roll-in']).toBe(Math.round(0.195797 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey['dsfb-alt']).toBe(Math.round(0.042557 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey['dsfb-red']).toBe(Math.round(0.00807 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey.sfb).toBe(Math.round(0.00805 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey.LI).toBe(Math.round(0.136211 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey.LP).toBe(Math.round(0.083589 * CMINIBROWSER_CMINI_STAT_VALUE_SCALE));
		expect(byKey.LT).toBe(0);
		expect(byKey.RT).toBe(0);
		expect(byKey.TB).toBe(0);
	});

	test('rejects incomplete entries and encodes a dump map', () => {
		expect(encodeCminibrowserCminiStats({})).toBeNull();
		expect(encodeCminibrowserCminiStats({ ...GALLIUM_DUMP, alt: 0 })).toBeNull();

		const encoded = encodeCminibrowserCminiDump({
			gallium: GALLIUM_DUMP,
			broken: { alt: 0.1 }
		});
		expect(encoded.size).toBe(1);
		expect(encoded.has('gallium')).toBe(true);
	});

	test('supports case-insensitive indexed lookup', () => {
		const index = indexCminibrowserCminiDump({ Gallium: GALLIUM_DUMP });
		const hit = lookupCminibrowserCminiStats(index, 'gallium');
		expect(hit?.dumpId).toBe('Gallium');
		expect(hit?.compact).toEqual(encodeCminibrowserCminiStats(GALLIUM_DUMP)!);
	});
});
