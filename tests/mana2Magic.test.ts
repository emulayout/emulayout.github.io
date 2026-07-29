import { describe, expect, test } from 'bun:test';
import {
	encodeMana2StatsResult,
	mana2MagicEngineFailure,
	mana2MagicMappingsUnavailable,
	prepareMana2InputBehaviors,
	prepareMana2Magic,
	mana2InputEngineFailure
} from '../bin/mana2-magic.js';
import { buildMana2LayoutHash } from '../bin/mana2-stats.js';
import vyletMappings from '../data/magic-keys/vylet.json';
import whirlMappings from '../data/magic-keys/whirl.json';

const layoutKeys = Object.fromEntries(
	[..."abcdefghijklmnopqrstuvwxyz*'"].map((key) => [key, { row: 0, col: 0 }])
);

describe('Mana2 magic-key adaptation', () => {
	test('translates Vylet-style mappings into Mana2 bigram rules', () => {
		const prepared = prepareMana2Magic(vyletMappings, layoutKeys);

		expect(prepared).toMatchObject({
			engine: 'extended',
			analysis: { status: 'included', engine: 'extended' }
		});
		expect(prepared.rules).toHaveLength(14);
		expect(prepared.rules).toContainEqual({ inputs: 'c*', output: 'ck' });
		expect(prepared.rules).toContainEqual({ inputs: "'*", output: "'l" });
		expect(prepared.rules).toContainEqual({ inputs: 'l*', output: 'll' });
	});

	test('expands repeat-last fallbacks while preserving explicit mappings', () => {
		const prepared = prepareMana2Magic(whirlMappings, { ...layoutKeys, ',': {} });

		expect(prepared).toMatchObject({
			engine: 'extended',
			analysis: { status: 'included', engine: 'extended' }
		});
		expect(prepared.rules).toContainEqual({ inputs: 'w*', output: 'wh' });
		expect(prepared.rules).not.toContainEqual({ inputs: 'w*', output: 'ww' });
		expect(prepared.rules).toContainEqual({ inputs: 'a*', output: 'aa' });
		expect(prepared.rules).toContainEqual({ inputs: ',*', output: ',,' });
	});

	test('includes default @ repeat behavior for standalone Repeat-key layouts', () => {
		const prepared = prepareMana2InputBehaviors(undefined, {
			a: {},
			b: {},
			'@': {}
		});

		expect(prepared).toMatchObject({
			engine: 'extended',
			analyses: {
				repeatKey: { status: 'included', engine: 'extended' }
			}
		});
		expect(prepared?.rules).toContainEqual({ inputs: 'a@', output: 'aa' });
		expect(prepared?.rules).toContainEqual({ inputs: 'b@', output: 'bb' });
	});

	test('does not partially analyze layouts whose * mappings remain unavailable', () => {
		const prepared = prepareMana2InputBehaviors(undefined, {
			a: {},
			'*': {},
			'@': {}
		});

		expect(prepared).toMatchObject({
			engine: 'standard',
			analyses: {
				magicKeys: {
					status: 'excluded',
					reason: 'mappings-unavailable'
				},
				repeatKey: {
					status: 'excluded',
					reason: 'combined-input-behaviors'
				}
			}
		});
		expect(prepared?.rules).toEqual([]);
	});

	test('lets an explicit @ magic mapping override repeat-key classification', () => {
		const prepared = prepareMana2InputBehaviors({ '@': { a: 'o' } }, { a: {}, b: {}, '@': {} });

		expect(prepared).toMatchObject({
			engine: 'extended',
			analyses: {
				magicKeys: { status: 'included', engine: 'extended' }
			}
		});
		expect(prepared?.analyses.repeatKey).toBeUndefined();
	});

	const unsupportedCases = [
		[{ '*': { a: 'o' }, '@': { a: 'e' } }, 'multiple-magic-keys', { ...layoutKeys, '@': {} }],
		[{ '*': { th: 'e' } }, 'multi-key-input', layoutKeys],
		[{ '*': { t: 'ion' } }, 'multi-character-output', layoutKeys],
		[{ '*': { t: ['i', 'o'] } }, 'multiple-outputs-per-input', layoutKeys],
		[{ '@': { a: 'o' } }, 'magic-key-not-on-layout', layoutKeys],
		[{ '*': { '?': 'l' } }, 'input-key-not-on-layout', layoutKeys],
		[{ '*': { fallback: 'repeat-last' } }, 'invalid-profile', layoutKeys]
	] as const;

	for (const [mappings, reason, keys] of unsupportedCases) {
		test(`falls back with reason ${reason}`, () => {
			const prepared = prepareMana2Magic(mappings, keys);
			expect(prepared.engine).toBe('standard');
			expect(prepared.rules).toEqual([]);
			expect(prepared.analysis).toMatchObject({
				status: 'excluded',
				engine: 'standard',
				reason
			});
		});
	}

	test('attaches magic status to both mapped and unmapped magic layouts', () => {
		const stats = [1, 2, 3];
		const included = { status: 'included', engine: 'extended' } as const;
		expect(encodeMana2StatsResult(stats, null)).toEqual(stats);
		expect(encodeMana2StatsResult(stats, { magicKeys: included })).toEqual({
			stats,
			magicKeys: included
		});
		expect(mana2MagicEngineFailure('CLI returned no stats')).toMatchObject({
			status: 'excluded',
			engine: 'standard',
			reason: 'extended-engine-failed'
		});
		expect(mana2MagicMappingsUnavailable()).toMatchObject({
			status: 'excluded',
			engine: 'standard',
			reason: 'mappings-unavailable'
		});
		expect(
			mana2InputEngineFailure({ repeatKey: { status: 'included', engine: 'extended' } }, 'failed')
		).toMatchObject({
			repeatKey: {
				status: 'excluded',
				reason: 'extended-engine-failed'
			}
		});
	});

	test('scopes magic profile cache invalidation to the affected layout hash', () => {
		const source = '{"name":"magic"}';
		const standardLayout = '{"magic":{"magicKeys":null,"rules":[]}}';
		const includedLayout = '{"magic":{"magicKeys":null,"rules":[{"inputs":"c*","output":"ck"}]}}';
		const unavailable = mana2MagicMappingsUnavailable();
		const included = { status: 'included', engine: 'extended' } as const;

		const before = buildMana2LayoutHash(source, standardLayout, 'standard', {
			magicKeys: unavailable
		});
		const after = buildMana2LayoutHash(source, includedLayout, 'extended', {
			magicKeys: included
		});
		const ordinary = buildMana2LayoutHash(source, standardLayout, 'standard', null);

		expect(after).not.toBe(before);
		expect(ordinary).not.toBe(before);
		expect(buildMana2LayoutHash(source, standardLayout, 'standard', null)).toBe(ordinary);
	});
});
