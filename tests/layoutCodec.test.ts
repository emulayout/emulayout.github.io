import { describe, expect, test } from 'bun:test';
import {
	decodeLayout,
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
});
