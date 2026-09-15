import { describe, expect, test } from 'bun:test';
import { supplementalFromAkldbLayout } from '../bin/akldb-spark.js';

function layout(overrides: Record<string, unknown> = {}) {
	return {
		id: 'id',
		name: 'example',
		owner: '1',
		layoutRev: 1,
		createdAt: '2026-01-01T00:00:00Z',
		modifiedAt: '2026-01-01T00:00:00Z',
		formatModifiedAt: '2026-01-01T00:00:00Z',
		keys: [],
		likes: [],
		likeCount: 0,
		link: null,
		...overrides
	} as never;
}

describe('AKLDB Spark behavior adapter', () => {
	test('uses AKLDB lowering for Magic and chiral triggers', () => {
		const result = supplementalFromAkldbLayout(
			layout({
				magic: {
					magic_keys: [{ key: '*' }],
					chiral_keys: [{ key: 'y' }]
				},
				manaMagic: {
					rules: [
						{ inputs: 'c*', output: 'ck' },
						{ inputs: 'ay', output: 'aa' },
						{ inputs: 'lz', output: 'lj' }
					]
				}
			})
		);
		expect(result.supplemental?.variants[0].magicKeys?.mappings).toEqual({
			'*': { rules: { c: 'k' } },
			y: { rules: { a: 'a' } }
		});
	});

	test('keeps a conventional rule-free @ in the dedicated Repeat model', () => {
		const result = supplementalFromAkldbLayout(
			layout({
				magic: {
					magic_keys: [{ key: '@', default: { kind: 'repeat' }, rules: [], except: [] }]
				},
				manaMagic: { rules: [{ inputs: 'a@', output: 'aa' }] }
			})
		);
		expect(result.repeatTrigger).toBe(true);
		expect(result.supplemental).toBeUndefined();
	});

	test('adapts Spark adaptive swaps independently from lowered Magic rules', () => {
		const result = supplementalFromAkldbLayout(
			layout({
				magic: { adaptive_swaps: [{ trigger: 'L', swap: ['Y', 'J'] }] },
				manaMagic: { rules: [{ inputs: 'ly', output: 'lj' }] }
			})
		);
		expect(result.supplemental?.variants[0].adaptiveSwaps?.mappings).toEqual({
			l: { y: 'j' }
		});
		expect(result.supplemental?.variants[0].magicKeys).toBeUndefined();
	});

	test('preserves case-sensitive lowered contexts and triggers', () => {
		const result = supplementalFromAkldbLayout(
			layout({
				magic: { chiral_keys: [{ key: 'y' }, { key: 'Y' }] },
				manaMagic: {
					rules: [
						{ inputs: 'yy', output: 'y#' },
						{ inputs: 'Yy', output: 'Yy' },
						{ inputs: 'yY', output: 'yy' }
					]
				}
			})
		);

		expect(result.supplemental?.variants[0].magicKeys?.mappings).toEqual({
			y: { rules: { y: '#', Y: 'y' } },
			Y: { rules: { y: 'y' } }
		});
	});
});
