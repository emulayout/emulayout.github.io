import { describe, expect, test } from 'bun:test';
import type { LayoutData } from '$lib/layout';
import { getLatestLayoutDayKey, isNewSinceLastSync, localDayKey } from '$lib/recentLayouts';

function makeLayout(updatedAt: string): LayoutData {
	return {
		name: 'example',
		user: '1',
		keys: {},
		positionBySlot: new Map(),
		thumbKeysByHand: { l: [], r: [] },
		hasThumbKeys: false,
		characterSet: 'english',
		hasAllLetters: true,
		hasMagicKey: false,
		hasRepeatKey: false,
		hasMagicKeyMappings: false,
		cyanophageStatsNeedMagicMappings: false,
		hasAdaptiveSwap: false,
		hasChiralKey: false,
		hasAdaptiveSwapMappings: false,
		hasChiralKeyMappings: false,
		cyanophageCompatible: true,
		updatedAt
	};
}

describe('recentLayouts', () => {
	test('returns an empty key for invalid dates instead of throwing or polluting max comparison', () => {
		expect(localDayKey(new Date('not-a-date'))).toBe('');
		const validDay = localDayKey(new Date('2026-04-01T12:00:00Z'));
		const layouts = [makeLayout('not-a-date'), makeLayout('2026-04-01T12:00:00Z')];

		expect(getLatestLayoutDayKey(layouts)).toBe(validDay);
		expect(isNewSinceLastSync(layouts[0], validDay)).toBe(false);
		expect(isNewSinceLastSync(layouts[1], validDay)).toBe(true);
	});

	test('returns null when every layout timestamp is invalid', () => {
		expect(getLatestLayoutDayKey([makeLayout('bad')])).toBeNull();
	});
});
