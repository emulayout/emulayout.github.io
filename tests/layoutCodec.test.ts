import { describe, expect, test } from 'bun:test';
import {
	decodeLayout,
	LAYOUT_FLAG_ADAPTIVE_SWAP,
	LAYOUT_FLAG_ADAPTIVE_SWAP_MAPPINGS,
	LAYOUT_FLAG_ALL_LETTERS,
	LAYOUT_FLAG_MAGIC_KEY,
	LAYOUT_FLAG_MAGIC_KEY_MAPPINGS
} from '$lib/layoutCodec';

describe('layout codec flags', () => {
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
		expect(knownMagic.hasMagicKeyMappings).toBe(false);
		expect(mappedMagic.hasMagicKey).toBe(true);
		expect(mappedMagic.hasMagicKeyMappings).toBe(true);
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
});
