import { describe, expect, test } from 'bun:test';
import { normalizeCminibrowserMagicRules } from '../bin/cminibrowser-magic-rules.js';

describe('cminibrowser Magic and Adaptive mappings', () => {
	test('adapts full Magic outputs, defaults, and uppercase Adaptive swaps', () => {
		const result = normalizeCminibrowserMagicRules({
			sample: {
				magic_keys: [
					{
						key: '*',
						default: 'repeat_previous',
						rules: [
							{ after: 'c', output: 'ck' },
							{ after: 'th', output: 'the' }
						]
					},
					{ key: '#', default: 'y', rules: [] }
				],
				adaptive_swaps: [{ trigger: 'L', swap: ['Y', 'J'] }]
			}
		});

		expect(result.layoutIds).toEqual(new Set(['sample']));
		expect(result.supplementalByLayoutId.get('sample')).toEqual({
			schema: 1,
			variants: [
				{
					id: 'default',
					magicKeys: {
						mappings: {
							'*': {
								rules: { c: 'k', th: 'e' },
								fallback: 'repeat-last'
							},
							'#': { rules: {}, fallback: { emit: 'y' } }
						}
					},
					adaptiveSwaps: { mappings: { l: { y: 'j' } } }
				}
			]
		});
	});

	test('keeps a rule-free conventional @ in the dedicated Repeat model', () => {
		const result = normalizeCminibrowserMagicRules({
			repeat: {
				magic_keys: [{ key: '@', default: 'repeat_previous', rules: [] }],
				adaptive_swaps: []
			}
		});

		expect(result.layoutIds).toEqual(new Set(['repeat']));
		expect(result.supplementalByLayoutId.has('repeat')).toBe(false);
	});

	test('keeps mapped @ as Magic and imports an explicit no-op default', () => {
		const result = normalizeCminibrowserMagicRules({
			mapped: {
				magic_keys: [
					{
						key: '@',
						default: 'none',
						rules: [{ after: 'a', output: 'ao' }]
					}
				]
			}
		});

		expect(result.supplementalByLayoutId.get('mapped')?.variants[0]?.magicKeys?.mappings).toEqual({
			'@': { rules: { a: 'o' }, fallback: 'no-op' }
		});
	});

	test('rejects a Magic output that does not preserve its preceding context', () => {
		expect(() =>
			normalizeCminibrowserMagicRules({
				broken: {
					magic_keys: [{ key: '*', default: 'none', rules: [{ after: 'c', output: 'k' }] }]
				}
			})
		).toThrow('output "k" must start with "c"');
	});

	test('rejects conflicting Adaptive swaps', () => {
		expect(() =>
			normalizeCminibrowserMagicRules({
				broken: {
					adaptive_swaps: [
						{ trigger: 'n', swap: ['l', 'b'] },
						{ trigger: 'n', swap: ['b', 'c'] }
					]
				}
			})
		).toThrow('assigns a key to multiple swaps');
	});
});
