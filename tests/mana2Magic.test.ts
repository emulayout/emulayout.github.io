import { describe, expect, test } from 'bun:test';
import {
	encodeMana2StatsResult,
	mana2MagicEngineFailure,
	mana2MagicMappingsUnavailable,
	prepareMana2Magic
} from '../bin/mana2-magic.js';
import { buildMana2LayoutHash } from '../bin/mana2-stats.js';
import vyletMappings from '../data/magic-keys/vylet.json';

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

	const unsupportedCases = [
		[{ '*': { a: 'o' }, '@': { a: 'e' } }, 'multiple-magic-keys', { ...layoutKeys, '@': {} }],
		[{ '*': { th: 'e' } }, 'multi-key-input', layoutKeys],
		[{ '*': { t: 'ion' } }, 'multi-character-output', layoutKeys],
		[{ '*': { t: ['i', 'o'] } }, 'multiple-outputs-per-input', layoutKeys],
		[{ '@': { a: 'o' } }, 'magic-key-not-on-layout', layoutKeys],
		[{ '*': { '?': 'l' } }, 'input-key-not-on-layout', layoutKeys]
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
		expect(encodeMana2StatsResult(stats, included)).toEqual({
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
	});

	test('scopes magic profile cache invalidation to the affected layout hash', () => {
		const source = '{"name":"magic"}';
		const standardLayout = '{"magic":{"magicKeys":null,"rules":[]}}';
		const includedLayout = '{"magic":{"magicKeys":null,"rules":[{"inputs":"c*","output":"ck"}]}}';
		const unavailable = mana2MagicMappingsUnavailable();
		const included = { status: 'included', engine: 'extended' } as const;

		const before = buildMana2LayoutHash(source, standardLayout, 'standard', unavailable);
		const after = buildMana2LayoutHash(source, includedLayout, 'extended', included);
		const ordinary = buildMana2LayoutHash(source, standardLayout, 'standard', null);

		expect(after).not.toBe(before);
		expect(ordinary).not.toBe(before);
		expect(buildMana2LayoutHash(source, standardLayout, 'standard', null)).toBe(ordinary);
	});
});
