import { describe, expect, test } from 'bun:test';
import {
	decodeLayout,
	LAYOUT_FLAG_CHIRAL_KEY,
	LAYOUT_FLAG_CHIRAL_KEY_MAPPINGS,
	LAYOUT_FLAG_ADAPTIVE_SWAP,
	LAYOUT_FLAG_ADAPTIVE_SWAP_MAPPINGS,
	LAYOUT_FLAG_ALL_LETTERS,
	LAYOUT_FLAG_CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED,
	LAYOUT_FLAG_INTERNATIONAL,
	LAYOUT_FLAG_MAGIC_KEY,
	LAYOUT_FLAG_MAGIC_KEY_MAPPINGS,
	LAYOUT_FLAG_REPEAT_KEY
} from '$lib/layoutCodec';

describe('layout codec flags', () => {
	test('decodes independent chiral presence and mapping flags, defaulting older tuples to false', () => {
		for (const [flags, present, mapped] of [
			[0, false, false],
			[LAYOUT_FLAG_CHIRAL_KEY, true, false],
			[LAYOUT_FLAG_CHIRAL_KEY | LAYOUT_FLAG_CHIRAL_KEY_MAPPINGS, true, true]
		] as const) {
			const layout = decodeLayout(['chiral', 1, 2, '2026-10-03', flags, ['/'], [0], [0]]);
			expect(layout.hasChiralKey).toBe(present);
			expect(layout.hasChiralKeyMappings).toBe(mapped);
			expect(layout.hasAdaptiveSwap).toBe(false);
		}
	});
	test('decodes magic layout presence separately from known mappings', () => {
		const base = ['magic', 1, 2, '2026-01-01', 0, ['*'], [0], [0]] as const;
		const knownMagic = decodeLayout([
			...base.slice(0, 4),
			LAYOUT_FLAG_ALL_LETTERS | LAYOUT_FLAG_MAGIC_KEY,
			...base.slice(5)
		]);
		const mappedMagic = decodeLayout([
			...base.slice(0, 4),
			LAYOUT_FLAG_ALL_LETTERS | LAYOUT_FLAG_MAGIC_KEY | LAYOUT_FLAG_MAGIC_KEY_MAPPINGS,
			...base.slice(5)
		]);

		expect(knownMagic.hasMagicKey).toBe(true);
		expect(knownMagic.hasRepeatKey).toBe(false);
		expect(knownMagic.hasMagicKeyMappings).toBe(false);
		expect(mappedMagic.hasMagicKey).toBe(true);
		expect(mappedMagic.hasMagicKeyMappings).toBe(true);
		expect(mappedMagic.cyanophageStatsNeedMagicMappings).toBe(false);

		const cyanophageMappingsRequired = decodeLayout([
			...base.slice(0, 4),
			LAYOUT_FLAG_ALL_LETTERS |
				LAYOUT_FLAG_MAGIC_KEY |
				LAYOUT_FLAG_CYANOPHAGE_MAGIC_MAPPINGS_REQUIRED,
			...base.slice(5)
		]);
		expect(cyanophageMappingsRequired.cyanophageStatsNeedMagicMappings).toBe(true);
	});

	test('decodes repeat-key presence independently from the @ character', () => {
		const repeat = decodeLayout([
			'repeat',
			1,
			2,
			'2026-01-01',
			LAYOUT_FLAG_ALL_LETTERS | LAYOUT_FLAG_REPEAT_KEY,
			['@'],
			[0],
			[0]
		]);

		expect(repeat.hasMagicKey).toBe(false);
		expect(repeat.hasRepeatKey).toBe(true);
		expect(repeat.hasMagicKeyMappings).toBe(false);
	});

	test('decodes adaptive presence separately from known mappings', () => {
		const base = ['adaptive', 1, 2, '2026-01-01', 0, ['a'], [0], [0]] as const;
		const knownAdaptive = decodeLayout([
			...base.slice(0, 4),
			LAYOUT_FLAG_ALL_LETTERS | LAYOUT_FLAG_ADAPTIVE_SWAP,
			...base.slice(5)
		]);
		const mappedAdaptive = decodeLayout([
			...base.slice(0, 4),
			LAYOUT_FLAG_ALL_LETTERS | LAYOUT_FLAG_ADAPTIVE_SWAP | LAYOUT_FLAG_ADAPTIVE_SWAP_MAPPINGS,
			...base.slice(5)
		]);

		expect(knownAdaptive.hasAdaptiveSwap).toBe(true);
		expect(knownAdaptive.hasAdaptiveSwapMappings).toBe(false);
		expect(mappedAdaptive.hasAdaptiveSwap).toBe(true);
		expect(mappedAdaptive.hasAdaptiveSwapMappings).toBe(true);
	});

	test('classifies character set from key labels, not a stale international flag', () => {
		const englishWithDiamond = decodeLayout([
			'opal',
			1,
			1,
			'2026-01-01',
			LAYOUT_FLAG_ALL_LETTERS | LAYOUT_FLAG_INTERNATIONAL,
			['a', '◇'],
			[0, 0],
			[0, 1]
		]);
		const internationalLetter = decodeLayout([
			'accented',
			1,
			1,
			'2026-01-01',
			LAYOUT_FLAG_ALL_LETTERS,
			['a', 'é'],
			[0, 0],
			[0, 1]
		]);

		expect(englishWithDiamond.characterSet).toBe('english');
		expect(internationalLetter.characterSet).toBe('international');
	});

	test('preserves AKLDB free positions and duplicate labels from the legacy wire format', () => {
		const layout = decodeLayout([
			'spark',
			'9007199254740993',
			4,
			'2026-09-15T00:00:00Z',
			0,
			['a', '', 'a'],
			[0, 0, 1],
			[0, 1, 0]
		]);

		expect(layout.positionBySlot).toEqual(
			new Map([
				['0,0', 'a'],
				['0,1', ''],
				['1,0', 'a']
			])
		);
		expect(Object.keys(layout.keys)).toEqual(['a']);
	});
});
