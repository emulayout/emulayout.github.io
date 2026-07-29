import { describe, expect, spyOn, test } from 'bun:test';
import {
	compileLayoutInputProfile,
	compileLayoutInputRegistry,
	resolveLayoutInput,
	type AppliedLayoutInputBehavior,
	type LayoutInputProfile
} from '$lib/layoutInputBehaviors';
import { validateMagicKeyMappings } from '$lib/magicKeys';
import { compileAdaptiveSwapSource, validateAdaptiveSwapSource } from '$lib/adaptiveSwaps';
import {
	adaptiveRuleMappingId,
	magicFallbackMappingId,
	magicRuleMappingId,
	repeatKeyMappingId
} from '$lib/inputMappingControls';
import vyletMappings from '../data/magic-keys/vylet.json';
import whirlMappings from '../data/magic-keys/whirl.json';
import vyletV4Swaps from '../data/adaptive-swaps/vylet-v4.json';
import { validateMagicKeyMappingsForLayout } from '../bin/magic-key-data.js';
import { validateAdaptiveSwapSourceForLayout } from '../bin/adaptive-swap-data.js';

function typeLogicalKeys(
	profile: LayoutInputProfile,
	keys: string[],
	disabledMappingIds?: ReadonlySet<string>
): { text: string; applied: readonly AppliedLayoutInputBehavior[][] } {
	let text = '';
	let history = '';
	const applied: AppliedLayoutInputBehavior[][] = [];

	for (const key of keys) {
		const result = resolveLayoutInput(profile, history, key, disabledMappingIds);
		text += result.text;
		history = result.nextHistory;
		applied.push([...result.applied]);
	}

	return { text, applied };
}

describe('layout input registry', () => {
	const profiles = compileLayoutInputRegistry({
		vylet: { magicKeys: vyletMappings },
		whirl: { magicKeys: whirlMappings },
		'vylet-v4': { adaptiveSwaps: vyletV4Swaps }
	});

	test('loads each behavior by its Cmini layout name', () => {
		expect(typeLogicalKeys(profiles.get('vylet')!, ['c', '*']).text).toBe('ck');
		expect(typeLogicalKeys(profiles.get('whirl')!, ['w', '*']).text).toBe('wh');
		expect(typeLogicalKeys(profiles.get('vylet-v4')!, ['l', 'y']).text).toBe('lj');
		expect(profiles.has('not-configured')).toBe(false);
	});

	test('chains magic mappings from the previous emitted output', () => {
		const result = typeLogicalKeys(profiles.get('vylet')!, ['y', 'o', 'u', "'", '*', '*']);
		expect(result.text).toBe("you'll");
		expect(result.applied.slice(-2)).toEqual([['magic-key'], ['magic-key']]);
	});

	test('synthesizes default repeat behavior for layouts containing an unclaimed @', () => {
		const repeatProfiles = compileLayoutInputRegistry({}, [
			{
				name: 'repeat-layout',
				keys: {
					a: { row: 0, col: 0 },
					'@': { row: 0, col: 1 }
				}
			}
		]);
		const profile = repeatProfiles.get('repeat-layout')!;

		const result = typeLogicalKeys(profile, ['a', '@', '@']);
		expect(result.text).toBe('aaa');
		expect(result.applied.slice(-2)).toEqual([['repeat-key'], ['repeat-key']]);
		expect(profile.repeatKey).toEqual({ trigger: '@' });
		expect(profile.magicKeys).toBeUndefined();
		expect(typeLogicalKeys(profile, ['a', '@'], new Set([repeatKeyMappingId('@')])).text).toBe(
			'a@'
		);
	});

	test('uses compact metadata to prevent missing mappings from reclassifying @ as Repeat', () => {
		const layouts = [
			{
				name: 'mapped-at',
				keys: {
					a: { row: 0, col: 0 },
					'@': { row: 0, col: 1 }
				},
				hasRepeatKey: false
			}
		];

		expect(compileLayoutInputRegistry({}, layouts).has('mapped-at')).toBe(false);

		const profile = compileLayoutInputRegistry(
			{ 'mapped-at': { magicKeys: { '@': { a: 'o' } } } },
			layouts
		).get('mapped-at')!;
		expect(profile.magicKeys).toBeDefined();
		expect(profile.repeatKey).toBeUndefined();
		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ao');

		const legacyProfile = compileLayoutInputRegistry(
			{ 'mapped-at': { magicKeys: { '@': { a: 'o' } } } },
			layouts.map(({ name, keys }) => ({ name, keys }))
		).get('mapped-at')!;
		expect(legacyProfile.repeatKey).toBeUndefined();
	});

	test('preserves authoritative Repeat metadata when an @ sidecar profile is malformed', () => {
		const warning = spyOn(console, 'warn').mockImplementation(() => {});
		const profile = compileLayoutInputRegistry({ 'repeat-layout': { magicKeys: { '@': null } } }, [
			{
				name: 'repeat-layout',
				keys: {
					a: { row: 0, col: 0 },
					'@': { row: 0, col: 1 }
				},
				hasRepeatKey: true
			}
		]).get('repeat-layout')!;

		expect(profile.repeatKey).toEqual({ trigger: '@' });
		expect(profile.magicKeys).toBeUndefined();
		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('aa');
		expect(warning).toHaveBeenCalled();
		warning.mockRestore();
	});
});

describe('magic-key resolution through the unified engine', () => {
	test('supports multi-character output and longest-suffix matching', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				'*': {
					h: 'x',
					th: 'e',
					a: 'bc',
					bc: 'd'
				}
			}
		});

		expect(typeLogicalKeys(profile, ['t', 'h', '*']).text).toBe('the');
		expect(typeLogicalKeys(profile, ['x', 'h', '*']).text).toBe('xhx');
		expect(typeLogicalKeys(profile, ['a', '*', '*']).text).toBe('abcd');
	});

	test('keeps separate mappings for separate magic keys', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				'*': { a: 'o' },
				'@': { a: 'e' }
			}
		});

		expect(typeLogicalKeys(profile, ['a', '*']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ae');
	});

	test('treats an explicit @ mapping as magic instead of repeat behavior', () => {
		const profile = compileLayoutInputProfile(
			{
				magicKeys: {
					'@': { a: 'o' }
				}
			},
			{ a: {}, b: {}, '@': {} }
		);

		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['b', '@', '@']).text).toBe('b@@');
		expect(profile.repeatKey).toBeUndefined();
		expect(resolveLayoutInput(profile, '', '@')).toMatchObject({
			text: '@',
			applied: []
		});
	});

	test('allows an @ magic mapping to request repeat-last explicitly', () => {
		const profile = compileLayoutInputProfile(
			{
				magicKeys: {
					'@': {
						mappings: { a: 'o' },
						fallback: 'repeat-last'
					}
				}
			},
			{ a: {}, b: {}, '@': {} }
		);

		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['b', '@', '@']).text).toBe('bbb');
		expect(profile.repeatKey).toBeUndefined();
	});

	test('records unmatched triggers and matches preceding letters case-insensitively', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { '*': { a: 'o', '*': 'z' } }
		});

		expect(typeLogicalKeys(profile, ['x', '*', '*']).text).toBe('x*z');
		expect(typeLogicalKeys(profile, ['A', '*']).text).toBe('Ao');
		expect(resolveLayoutInput(profile, '', '*').text).toBe('*');
	});

	test('repeats the last emitted character when an extended trigger has no explicit rule', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				'*': {
					mappings: { w: 'h', y: ',' },
					fallback: 'repeat-last'
				}
			}
		});

		expect(typeLogicalKeys(profile, ['a', '*', '*']).text).toBe('aaa');
		expect(typeLogicalKeys(profile, ['A', '*']).text).toBe('AA');
		expect(typeLogicalKeys(profile, ['y', '*', '*']).text).toBe('y,,');
		expect(typeLogicalKeys(profile, ['w', '*']).text).toBe('wh');
		expect(resolveLayoutInput(profile, '', '*')).toMatchObject({
			text: '*',
			applied: []
		});
	});

	test('can disable individual rules and fallback behavior independently', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				'*': {
					mappings: { w: 'h', h: 'x', th: 'e' },
					fallback: 'repeat-last'
				}
			}
		});

		expect(
			typeLogicalKeys(profile, ['t', 'h', '*'], new Set([magicRuleMappingId('*', 'th')])).text
		).toBe('thx');
		expect(typeLogicalKeys(profile, ['w', '*'], new Set([magicRuleMappingId('*', 'w')])).text).toBe(
			'ww'
		);
		expect(typeLogicalKeys(profile, ['q', '*'], new Set([magicFallbackMappingId('*')])).text).toBe(
			'q*'
		);
	});

	test('rejects malformed and case-ambiguous profiles', () => {
		expect(() => validateMagicKeyMappings({ '*': null })).toThrow('rules must be an object');
		expect(() => validateMagicKeyMappings({ '*': {} })).toThrow('must have at least one rule');
		expect(() => validateMagicKeyMappings({ '*': { A: 'x', a: 'y' } })).toThrow(
			'repeats preceding sequence'
		);
		expect(() => validateMagicKeyMappings({ '*': { mappings: {}, fallback: 'unknown' } })).toThrow(
			'fallback must be "repeat-last"'
		);
		expect(() => validateMagicKeyMappings({ '*': { fallback: 'repeat-last' } })).toThrow(
			'mappings must be an object'
		);
		expect(() =>
			validateMagicKeyMappings({ '*': { mappings: {}, fallback: 'repeat-last' } })
		).not.toThrow();
	});

	test('validates profile identity and triggers against its Cmini layout', () => {
		const layout = {
			name: 'vylet',
			keys: {
				'*': { row: 2, col: 6 },
				c: { row: 0, col: 1 }
			}
		};

		expect(() =>
			validateMagicKeyMappingsForLayout('vylet', { '*': { c: 'k' } }, layout)
		).not.toThrow();
		expect(() => validateMagicKeyMappingsForLayout('other', { '*': { c: 'k' } }, layout)).toThrow(
			'matched layout named'
		);
		expect(() => validateMagicKeyMappingsForLayout('vylet', { '@': { c: 'k' } }, layout)).toThrow(
			'trigger "@" that is not on the layout'
		);
	});
});

describe('adaptive-swap resolution through the unified engine', () => {
	const profile = compileLayoutInputProfile({
		adaptiveSwaps: validateAdaptiveSwapSource(vyletV4Swaps)
	});

	test('compiles both directions and all stored groups', () => {
		expect(typeLogicalKeys(profile, ['l', 'y']).text).toBe('lj');
		expect(typeLogicalKeys(profile, ['l', 'j']).text).toBe('ly');
		expect(typeLogicalKeys(profile, ['n', 'l']).text).toBe('nb');
		expect(typeLogicalKeys(profile, ['n', 'b']).text).toBe('nl');
		expect(typeLogicalKeys(profile, ['w', 's']).text).toBe('wm');
		expect(typeLogicalKeys(profile, ['w', 'm']).text).toBe('ws');
	});

	test('preserves uppercase intent and consumes context on an ordinary key', () => {
		expect(typeLogicalKeys(profile, ['n', 'Y']).text).toBe('nR');
		expect(typeLogicalKeys(profile, ['l', 'x', 'y']).text).toBe('lxy');
	});

	test('reports the behavior applied to each logical keypress', () => {
		expect(typeLogicalKeys(profile, ['l', 'y']).applied).toEqual([[], ['adaptive-swap']]);
	});

	test('can disable baseline and grouped swaps independently', () => {
		const baselineRule = profile.adaptiveSwaps!.rules.find(
			(rule) => rule.trigger === 'l' && rule.left === 'y'
		)!;
		const groupedRule = profile
			.adaptiveSwaps!.groups.flatMap((group) => group.rules.map((rule) => ({ group, rule })))
			.find(({ rule }) => rule.trigger === 'w' && rule.left === 's')!;

		expect(
			typeLogicalKeys(
				profile,
				['l', 'y'],
				new Set([adaptiveRuleMappingId(undefined, baselineRule)])
			).text
		).toBe('ly');
		expect(
			typeLogicalKeys(
				profile,
				['w', 's'],
				new Set([adaptiveRuleMappingId(groupedRule.group.id, groupedRule.rule)])
			).text
		).toBe('ws');
	});

	test('rejects empty, malformed, duplicate, and conflicting swaps', () => {
		expect(() => validateAdaptiveSwapSource({})).toThrow('must contain mappings');
		expect(() => validateAdaptiveSwapSource({ mappings: { long: { y: 'j' } } })).toThrow(
			'must be one character'
		);
		expect(() =>
			compileAdaptiveSwapSource({
				mappings: { n: { l: 'b' } },
				groups: [{ id: 'more', label: 'More', mappings: { n: { b: 'l' } } }]
			})
		).toThrow('repeats swap');
		expect(() => compileAdaptiveSwapSource({ mappings: { n: { l: 'b', b: 'c' } } })).toThrow(
			'assigns a key to multiple swaps'
		);
	});

	test('validates adaptive keys against the matching Cmini layout', () => {
		const layout = {
			name: 'sample',
			keys: {
				l: { row: 0, col: 0 },
				y: { row: 0, col: 1 },
				j: { row: 0, col: 2 }
			}
		};
		const source = { mappings: { l: { y: 'j' } } };

		expect(() => validateAdaptiveSwapSourceForLayout('sample', source, layout)).not.toThrow();
		expect(() => validateAdaptiveSwapSourceForLayout('other', source, layout)).toThrow(
			'matched layout named'
		);
		expect(() =>
			validateAdaptiveSwapSourceForLayout('sample', { mappings: { l: { y: 'x' } } }, layout)
		).toThrow('which is not on the layout');
	});
});

describe('combined layout input behaviors', () => {
	test('lets magic-key output arm an adaptive swap on the next keypress', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { '*': { a: 'l' } },
			adaptiveSwaps: { mappings: { l: { y: 'j' } } }
		});

		const result = typeLogicalKeys(profile, ['a', '*', 'y']);
		expect(result.text).toBe('alj');
		expect(result.applied).toEqual([[], ['magic-key'], ['adaptive-swap']]);
	});

	test('lets an adaptive output become a magic trigger on the same keypress', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { '*': { a: 'o' } },
			adaptiveSwaps: { mappings: { a: { y: '*' } } }
		});

		const result = typeLogicalKeys(profile, ['a', 'y']);
		expect(result.text).toBe('ao');
		expect(result.applied).toEqual([[], ['adaptive-swap', 'magic-key']]);
	});
});
