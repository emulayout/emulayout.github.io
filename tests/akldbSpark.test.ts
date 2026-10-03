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
	test('omits identity adaptive swaps without rejecting the layout', () => {
		const result = supplementalFromAkldbLayout(
			layout({
				magic: {
					adaptive_swaps: [
						{ trigger: 'a', swap: ['y', 'y'] },
						{ trigger: 'a', swap: ['h', 'j'] }
					]
				}
			})
		);
		expect(result.supplemental?.variants[0].adaptiveSwaps?.mappings).toEqual({ a: { h: 'j' } });
	});

	test('keeps Space outputs native with explicit Space hands', () => {
		const result = supplementalFromAkldbLayout(
			layout({
				keys: [{ char: ' ', row: 3, col: 0, finger: 'LT' }],
				magic: {
					chiral_keys: [
						{ key: '_', same: { kind: 'char', char: '^' }, opposite: { kind: 'char', char: ' ' } },
						{ key: '/', same: { kind: 'repeat' } }
					]
				},
				manaMagic: {
					rules: [
						{ inputs: 'a_', output: 'a ' },
						{ inputs: 'a/', output: 'aa' }
					]
				}
			})
		);
		expect(result.supplemental?.variants[0].magicKeys).toBeUndefined();
		expect(result.supplemental?.variants[0].chiralKeys?.keys).toEqual([
			{ key: '_', same: { kind: 'char', char: '^' }, opposite: { kind: 'char', char: ' ' } },
			{ key: '/', same: { kind: 'repeat' } }
		]);
		expect(result.supplemental?.variants[0].chiralKeys?.hands).toEqual({ ' ': 'l' });
	});

	test('normalizes nullable chiral branches without changing Spark source', () => {
		const source = layout({
			magic: {
				chiral_keys: [
					{ key: '/', same: null, opposite: { kind: 'char', char: 'e' } },
					{ key: ';', same: { kind: 'repeat' }, opposite: null }
				]
			}
		});
		const before = JSON.stringify(source);
		const result = supplementalFromAkldbLayout(source);
		expect(result.supplemental?.variants[0].chiralKeys?.keys).toEqual([
			{ key: '/', opposite: { kind: 'char', char: 'e' } },
			{ key: ';', same: { kind: 'repeat' } }
		]);
		expect(JSON.stringify(source)).toBe(before);
	});

	test('preserves bare @ Repeat behavior without an explicit Spark declaration', () => {
		const result = supplementalFromAkldbLayout(
			layout({ keys: [{ char: '@', row: 3, col: 4, finger: 'LT' }] })
		);
		expect(result.repeatTrigger).toBe(true);
		expect(result.supplemental).toBeUndefined();
		expect(supplementalFromAkldbLayout(layout()).repeatTrigger).toBe(false);
	});

	test.each(['magic_keys', 'chiral_keys'])(
		'%s claiming @ overrides conventional Repeat',
		(field) => {
			const result = supplementalFromAkldbLayout(
				layout({
					keys: [{ char: '@', row: 3, col: 4, finger: 'LT' }],
					magic: { [field]: [{ key: '@' }] },
					manaMagic: { rules: [{ inputs: 'a@', output: 'ao' }] }
				})
			);
			expect(result.repeatTrigger).toBe(false);
			expect(result.analyzerMappings).toEqual({
				'@': { rules: { a: 'o' } }
			});
		}
	);

	test('preserves native chirals while keeping authoritative lowering for analyzers', () => {
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
			'*': { rules: { c: 'k' } }
		});
		expect(result.supplemental?.variants[0].chiralKeys?.keys).toEqual([{ key: 'y' }]);
		expect(result.analyzerMappings?.y).toEqual({ rules: { a: 'a' } });
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

		expect(result.analyzerMappings).toEqual({
			y: { rules: { y: '#', Y: 'y' } },
			Y: { rules: { y: 'y' } }
		});
	});
});
