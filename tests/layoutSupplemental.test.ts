import { describe, expect, test } from 'bun:test';
import {
	defaultVariant,
	IMPLICIT_VARIANT_ID,
	validateLayoutSupplemental,
	variantLayoutKeys
} from '$lib/layoutSupplemental';

describe('supplemental layout data format', () => {
	test('normalizes the single mapping set shorthand into one variant', () => {
		const supplemental = validateLayoutSupplemental({
			schema: 1,
			magicKeys: { mappings: { '*': { c: 'k' } } },
			adaptiveSwaps: { mappings: { l: { y: 'j' } } }
		});

		expect(supplemental.variants).toEqual([
			{
				id: IMPLICIT_VARIANT_ID,
				magicKeys: { mappings: { '*': { c: 'k' } } },
				adaptiveSwaps: { mappings: { l: { y: 'j' } } }
			}
		]);
		expect(defaultVariant(supplemental)?.id).toBe(IMPLICIT_VARIANT_ID);
	});

	test('keeps alternatives in file order and treats the first as the default', () => {
		const supplemental = validateLayoutSupplemental({
			schema: 1,
			variants: [
				{ id: 'v2', label: '2026 revision', magicKeys: { mappings: { '*': { c: 'k' } } } },
				{
					id: 'v1',
					label: 'Original',
					description: "The author's first published set.",
					outdated: true,
					magicKeys: { mappings: { '*': { c: 'ck' } } }
				}
			]
		});

		expect(supplemental.variants.map((variant) => variant.id)).toEqual(['v2', 'v1']);
		expect(defaultVariant(supplemental)?.label).toBe('2026 revision');
		expect(supplemental.variants[1]).toMatchObject({ outdated: true });
	});

	test('accepts a file that carries only metadata', () => {
		const supplemental = validateLayoutSupplemental({
			schema: 1,
			meta: { homepage: 'https://example.com/sample' }
		});

		expect(supplemental).toEqual({
			schema: 1,
			meta: { homepage: 'https://example.com/sample' },
			variants: []
		});
	});

	test('normalized output validates again so the published payload round-trips', () => {
		const normalized = validateLayoutSupplemental({
			schema: 1,
			meta: { homepage: 'https://example.com/sample' },
			magicKeys: { mappings: { '*': { c: 'k' } } }
		});

		expect(validateLayoutSupplemental(normalized, { derived: true })).toEqual(normalized);
	});

	test('preserves unrecognized meta keys so new facts need no schema change', () => {
		const supplemental = validateLayoutSupplemental({
			schema: 1,
			meta: { homepage: 'https://example.com', keyboardFirmware: 'https://example.com/qmk' }
		});

		expect(supplemental.meta).toMatchObject({ keyboardFirmware: 'https://example.com/qmk' });
	});

	test('rejects a file that mixes the shorthand with variants', () => {
		expect(() =>
			validateLayoutSupplemental({
				schema: 1,
				magicKeys: { mappings: { '*': { c: 'k' } } },
				variants: [{ id: 'v1', label: 'One', magicKeys: { mappings: { '*': { c: 'k' } } } }]
			})
		).toThrow('cannot mix top-level mappings with variants');
	});

	test('rejects typos rather than silently dropping them', () => {
		expect(() => validateLayoutSupplemental({ schema: 1, magicKey: {} })).toThrow(
			'unknown field "magicKey"'
		);
		expect(() =>
			validateLayoutSupplemental({
				schema: 1,
				variants: [{ id: 'v1', label: 'One', magickeys: {} }]
			})
		).toThrow('unknown field "magickeys"');
		expect(() =>
			validateLayoutSupplemental({ magicKeys: { mappings: { '*': { c: 'k' } } } })
		).toThrow('must set "schema": 1');
		expect(() => validateLayoutSupplemental({ schema: 1 })).toThrow(
			'must contain meta, mappings, or variants'
		);
	});

	test('reserves magic-key groups instead of ignoring them', () => {
		expect(() =>
			validateLayoutSupplemental({
				schema: 1,
				magicKeys: { mappings: { '*': { c: 'k' } }, groups: [] }
			})
		).toThrow('groups are reserved');
	});

	test('requires a label and a unique id once a file offers a choice', () => {
		expect(() =>
			validateLayoutSupplemental({
				schema: 1,
				variants: [
					{ id: 'v1', label: 'One', magicKeys: { mappings: { '*': { c: 'k' } } } },
					{ id: 'v2', magicKeys: { mappings: { '*': { c: 'x' } } } }
				]
			})
		).toThrow('must have a nonempty label');
		expect(() =>
			validateLayoutSupplemental({
				schema: 1,
				variants: [
					{ id: 'v1', label: 'One', magicKeys: { mappings: { '*': { c: 'k' } } } },
					{ id: 'v1', label: 'Two', magicKeys: { mappings: { '*': { c: 'x' } } } }
				]
			})
		).toThrow('is duplicated');
	});

	test('lets a lone variant skip the label there is nothing to distinguish', () => {
		const supplemental = validateLayoutSupplemental({
			schema: 1,
			variants: [{ id: 'only', magicKeys: { mappings: { '*': { c: 'k' } } } }]
		});

		expect(supplemental.variants[0]?.label).toBeUndefined();
	});

	test('requires each variant to define at least one feature', () => {
		expect(() =>
			validateLayoutSupplemental({ schema: 1, variants: [{ id: 'v1', label: 'One' }] })
		).toThrow('must define magicKeys or adaptiveSwaps');
	});

	test('accepts sync-derived staleness only when reading published data', () => {
		const published = {
			schema: 1,
			variants: [
				{ id: 'v1', label: 'One', stale: true, magicKeys: { mappings: { '*': { c: 'k' } } } }
			]
		};

		expect(() => validateLayoutSupplemental(published)).toThrow('unknown field "stale"');
		expect(validateLayoutSupplemental(published, { derived: true }).variants[0]).toMatchObject({
			stale: true
		});
	});

	test('collects the layout keys a variant needs, lowercasing adaptive sides', () => {
		const [variant] = validateLayoutSupplemental({
			schema: 1,
			magicKeys: { mappings: { '*': { c: 'k' }, '#': { a: 'o' } } },
			adaptiveSwaps: {
				mappings: { L: { Y: 'j' } },
				groups: [{ id: 'more', label: 'More', mappings: { n: { b: 'p' } } }]
			}
		}).variants;

		expect([...variantLayoutKeys(variant)].sort()).toEqual([
			'#',
			'*',
			'b',
			'j',
			'l',
			'n',
			'p',
			'y'
		]);
	});
});
