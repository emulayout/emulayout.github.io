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
	magicProfileMappingIds,
	magicRuleMappingId,
	repeatKeyMappingId
} from '$lib/inputMappingControls';
import { validateLayoutSupplemental } from '$lib/layoutSupplemental';
import vyletData from '../data/layouts/vylet.json';
import whirlData from '../data/layouts/whirl.json';
import vyletV4Data from '../data/layouts/vylet-v4.json';

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
	// Normalize first so the registry sees exactly what sync publishes, not the
	// curated source shorthand.
	const profiles = compileLayoutInputRegistry({
		vylet: validateLayoutSupplemental(vyletData),
		whirl: validateLayoutSupplemental(whirlData),
		'vylet-v4': validateLayoutSupplemental(vyletV4Data)
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

		const mappedAt = { schema: 1, magicKeys: { mappings: { '@': { a: 'o' } } } };
		const profile = compileLayoutInputRegistry({ 'mapped-at': mappedAt }, layouts).get(
			'mapped-at'
		)!;
		expect(profile.magicKeys).toBeDefined();
		expect(profile.repeatKey).toBeUndefined();
		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ao');

		const legacyProfile = compileLayoutInputRegistry(
			{ 'mapped-at': mappedAt },
			layouts.map(({ name, keys }) => ({ name, keys }))
		).get('mapped-at')!;
		expect(legacyProfile.repeatKey).toBeUndefined();
	});

	test('preserves authoritative Repeat metadata when an @ sidecar profile is malformed', () => {
		const warning = spyOn(console, 'warn').mockImplementation(() => {});
		const profile = compileLayoutInputRegistry(
			{ 'repeat-layout': { schema: 1, magicKeys: { mappings: { '@': null } } } },
			[
				{
					name: 'repeat-layout',
					keys: {
						a: { row: 0, col: 0 },
						'@': { row: 0, col: 1 }
					},
					hasRepeatKey: true
				}
			]
		).get('repeat-layout')!;

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
				mappings: {
					'*': {
						h: 'x',
						th: 'e',
						a: 'bc',
						bc: 'd'
					}
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
				mappings: {
					'*': { a: 'o' },
					'@': { a: 'e' }
				}
			}
		});

		expect(typeLogicalKeys(profile, ['a', '*']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ae');
	});

	test('treats an explicit @ mapping as magic instead of repeat behavior', () => {
		const profile = compileLayoutInputProfile(
			{
				magicKeys: {
					mappings: { '@': { a: 'o' } }
				}
			},
			{ a: {}, b: {}, '@': {} }
		);

		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['b', '@', '@']).text).toBe('b');
		expect(profile.repeatKey).toBeUndefined();
		expect(resolveLayoutInput(profile, '', '@')).toMatchObject({
			text: '',
			applied: ['magic-key']
		});
	});

	test('allows an @ magic mapping to request repeat-last explicitly', () => {
		const profile = compileLayoutInputProfile(
			{
				magicKeys: {
					mappings: {
						'@': {
							rules: { a: 'o' },
							fallback: 'repeat-last'
						}
					}
				}
			},
			{ a: {}, b: {}, '@': {} }
		);

		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['b', '@', '@']).text).toBe('bbb');
		expect(profile.repeatKey).toBeUndefined();
	});

	test('consumes an unmatched trigger and matches preceding letters case-insensitively', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { a: 'o' } } }
		});

		expect(typeLogicalKeys(profile, ['A', '*']).text).toBe('Ao');
		// The unmatched press types nothing and leaves history alone, so the
		// following trigger still matches the letter typed after it.
		expect(typeLogicalKeys(profile, ['x', '*', 'a', '*']).text).toBe('xao');
		expect(resolveLayoutInput(profile, '', '*')).toMatchObject({
			text: '',
			applied: ['magic-key']
		});
	});

	test('repeats the last emitted character when an extended trigger has no explicit rule', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				mappings: {
					'*': {
						rules: { w: 'h', y: ',' },
						fallback: 'repeat-last'
					}
				}
			}
		});

		expect(typeLogicalKeys(profile, ['a', '*', '*']).text).toBe('aaa');
		expect(typeLogicalKeys(profile, ['A', '*']).text).toBe('AA');
		expect(typeLogicalKeys(profile, ['y', '*', '*']).text).toBe('y,,');
		expect(typeLogicalKeys(profile, ['w', '*']).text).toBe('wh');
		// Nothing to repeat yet, so the press is consumed.
		expect(resolveLayoutInput(profile, '', '*')).toMatchObject({
			text: '',
			applied: ['magic-key']
		});
	});

	test('emits fixed text when a fallback is hard-coded to a letter or word', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				mappings: {
					'*': {
						rules: { w: 'h' },
						fallback: { emit: 'the' }
					}
				}
			}
		});

		expect(typeLogicalKeys(profile, ['w', '*']).text).toBe('wh');
		expect(typeLogicalKeys(profile, ['q', '*']).text).toBe('qthe');
		// Unlike repeat-last, fixed text does not need any history.
		expect(resolveLayoutInput(profile, '', '*')).toMatchObject({
			text: 'the',
			applied: ['magic-key']
		});
	});

	test('types nothing for an explicit no-op fallback and offers no toggle for it', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				mappings: {
					'*': {
						rules: { w: 'h' },
						fallback: 'no-op'
					}
				}
			}
		});

		expect(typeLogicalKeys(profile, ['w', '*']).text).toBe('wh');
		expect(typeLogicalKeys(profile, ['q', '*']).text).toBe('q');
		expect(magicProfileMappingIds(profile.magicKeys)).toEqual([magicRuleMappingId('*', 'w')]);
	});

	test('can disable individual rules and fallback behavior independently', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: {
				mappings: {
					'*': {
						rules: { w: 'h', h: 'x', th: 'e' },
						fallback: 'repeat-last'
					}
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
			'q'
		);
	});

	test('rejects malformed and case-ambiguous profiles', () => {
		expect(() => validateMagicKeyMappings({ '*': null })).toThrow('rules must be an object');
		expect(() => validateMagicKeyMappings({ '*': {} })).toThrow('must have at least one rule');
		expect(() => validateMagicKeyMappings({ '*': { A: 'x', a: 'y' } })).toThrow(
			'repeats preceding sequence'
		);
		expect(() => validateMagicKeyMappings({ '*': { rules: {}, fallback: 'unknown' } })).toThrow(
			'fallback must be "repeat-last", "no-op", or { "emit": "text" }'
		);
		expect(() => validateMagicKeyMappings({ '*': { fallback: 'repeat-last' } })).toThrow(
			'rules must be an object'
		);
		expect(() =>
			validateMagicKeyMappings({ '*': { rules: {}, fallback: 'repeat-last' } })
		).not.toThrow();
	});

	test('rejects a fallback that cannot do anything or is misspelled', () => {
		expect(() => validateMagicKeyMappings({ '*': { rules: {}, fallback: 'no-op' } })).toThrow(
			'must have at least one rule or an emitting fallback'
		);
		expect(() => validateMagicKeyMappings({ '*': { rules: {}, fallback: { emit: '' } } })).toThrow(
			'fallback must emit nonempty text'
		);
		expect(() =>
			validateMagicKeyMappings({ '*': { rules: {}, fallback: { text: 'the' } } })
		).toThrow('fallback has unknown option "text"');
		expect(() =>
			validateMagicKeyMappings({ '*': { rules: {}, fallback: { emit: 'the' } } })
		).not.toThrow();
	});
});

describe('adaptive-swap resolution through the unified engine', () => {
	const profile = compileLayoutInputProfile({
		adaptiveSwaps: validateAdaptiveSwapSource(vyletV4Data.adaptiveSwaps)
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
});

describe('combined layout input behaviors', () => {
	test('lets magic-key output arm an adaptive swap on the next keypress', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { a: 'l' } } },
			adaptiveSwaps: { mappings: { l: { y: 'j' } } }
		});

		const result = typeLogicalKeys(profile, ['a', '*', 'y']);
		expect(result.text).toBe('alj');
		expect(result.applied).toEqual([[], ['magic-key'], ['adaptive-swap']]);
	});

	test('lets an adaptive output become a magic trigger on the same keypress', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { a: 'o' } } },
			adaptiveSwaps: { mappings: { a: { y: '*' } } }
		});

		const result = typeLogicalKeys(profile, ['a', 'y']);
		expect(result.text).toBe('ao');
		expect(result.applied).toEqual([[], ['adaptive-swap', 'magic-key']]);
	});
});
