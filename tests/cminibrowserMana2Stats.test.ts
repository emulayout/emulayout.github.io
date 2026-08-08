import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	CMINIBROWSER_MANA2_STAT_KEYS,
	CMINIBROWSER_MANA2_STAT_VALUE_SCALE,
	encodeCminibrowserMana2Stats,
	extractCminibrowserMana2Extended,
	indexCminibrowserMana2Dump,
	lookupCminibrowserMana2Stats
} from '../bin/cminibrowser-mana2-stats.js';

const GALLIUM_DUMP = JSON.parse(
	readFileSync(join(import.meta.dirname, 'fixtures/cminibrowser-mana2-gallium.json'), 'utf-8')
);

describe('cminibrowser mana2 dump encoding', () => {
	test('maps gallium dump buckets into MANA2_STAT_KEYS order', () => {
		const compact = encodeCminibrowserMana2Stats(GALLIUM_DUMP);
		expect(compact).toBeArrayOfSize(CMINIBROWSER_MANA2_STAT_KEYS.length);

		const byKey = Object.fromEntries(
			CMINIBROWSER_MANA2_STAT_KEYS.map((key, i) => [key, compact![i]])
		);
		expect(byKey['finger-usage-LP']).toBe(
			Math.round(GALLIUM_DUMP.fu.LP * CMINIBROWSER_MANA2_STAT_VALUE_SCALE)
		);
		expect(byKey.sfb).toBe(Math.round(GALLIUM_DUMP.big.sfs * CMINIBROWSER_MANA2_STAT_VALUE_SCALE));
		expect(byKey.sfs).toBe(Math.round(GALLIUM_DUMP.skip.sfs * CMINIBROWSER_MANA2_STAT_VALUE_SCALE));
		expect(byKey.alt).toBe(Math.round(GALLIUM_DUMP.tri.alt * CMINIBROWSER_MANA2_STAT_VALUE_SCALE));
		expect(byKey.altnothumbs).toBe(
			Math.round(GALLIUM_DUMP.trin.alt * CMINIBROWSER_MANA2_STAT_VALUE_SCALE)
		);
		expect(Object.hasOwn(byKey, 'offpinky')).toBe(false);
		expect(Object.hasOwn(byKey, 'goodroll')).toBe(false);
	});

	test('indexes dumps for case-insensitive lookup and keeps extended fields', () => {
		expect(encodeCminibrowserMana2Stats({})).toBeNull();
		expect(extractCminibrowserMana2Extended(GALLIUM_DUMP)?.fsp).toEqual(GALLIUM_DUMP.fsp);

		const index = indexCminibrowserMana2Dump({ Gallium: GALLIUM_DUMP });
		const hit = lookupCminibrowserMana2Stats(index, 'gallium');
		expect(hit?.dumpId).toBe('Gallium');
		expect(hit?.compact).toEqual(encodeCminibrowserMana2Stats(GALLIUM_DUMP)!);
		expect(hit?.extended.hb).toEqual(GALLIUM_DUMP.hb);
	});
});
