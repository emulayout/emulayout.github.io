import { describe, expect, test } from 'bun:test';
import {
	CMINIBROWSER_CMINI_STAT_KEYS,
	CMINIBROWSER_CMINI_STAT_VALUE_SCALE,
	encodeCminibrowserCminiStats
} from '../bin/cminibrowser-cmini-stats.js';

/** stats/v1-style cmini cell for gallium (percentages are percentage points). */
const GALLIUM_DUMP = {
	roll_in: 19.5797,
	roll_out: 25.1111,
	alt: 32.6619,
	red: 2.0497,
	bad_redirect: 0.2225,
	oneh_in: 0.448,
	oneh_out: 2.2144,
	sfr: 0.097133,
	sfs: 0.050627,
	sfs_alt: 4.2557,
	sfs_red: 0.807,
	sfb: 0.805,
	lh: 46.5512,
	rh: 53.4488,
	pinky: 0.182287,
	fingers: {
		LP: { use: 8.3589, fsp: 0.672545, wfsp: 0.448363, sfb: 0.000082, sfs: 0.001182 },
		LR: { use: 9.4668, fsp: 2.406347, wfsp: 0.66843, sfb: 0.001211, sfs: 0.003011 },
		LM: { use: 15.1044, fsp: 6.471734, wfsp: 1.348278, sfb: 0.00022, sfs: 0.009409 },
		LI: { use: 13.6211, fsp: 9.228712, wfsp: 1.677948, sfb: 0.002862, sfs: 0.011257 },
		RI: { use: 12.4497, fsp: 6.143346, wfsp: 1.116972, sfb: 0.001724, sfs: 0.006504 },
		RM: { use: 16.0652, fsp: 8.578382, wfsp: 1.787163, sfb: 0.000613, sfs: 0.009977 },
		RR: { use: 15.0641, fsp: 3.801502, wfsp: 1.055973, sfb: 0.001234, sfs: 0.006225 },
		RP: { use: 9.8698, fsp: 1.654724, wfsp: 1.10315, sfb: 0.000103, sfs: 0.003682 }
	},
	fspeed: 38.957292,
	fspeed_weighted: 9.206277
};

describe('AKL stats/v1 cmini encoding', () => {
	test('maps gallium cell scalars and finger uses into BOT_STAT_KEYS order', () => {
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

	test('rejects incomplete entries', () => {
		expect(encodeCminibrowserCminiStats({})).toBeNull();
		expect(encodeCminibrowserCminiStats({ ...GALLIUM_DUMP, alt: 0 })).toBeNull();
	});
});
