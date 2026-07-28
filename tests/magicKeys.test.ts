import { describe, expect, test } from 'bun:test';
import {
	compileLayoutInputProfile,
	compileLayoutInputRegistry,
	resolveLayoutInput,
	type AppliedLayoutInputBehavior,
	type LayoutInputProfile
} from '$lib/layoutInputBehaviors';
import { validateMagicKeyMappings } from '$lib/magicKeys';
import { compileAdaptiveSwapSource, validateAdaptiveSwapSource } from '$lib/adaptiveSwaps';
import vyletMappings from '../data/magic-keys/vylet.json';
import vyletV4Swaps from '../data/adaptive-swaps/vylet-v4.json';
import { validateMagicKeyMappingsForLayout } from '../bin/magic-key-data.js';
import { validateAdaptiveSwapSourceForLayout } from '../bin/adaptive-swap-data.js';

function typeLogicalKeys(
	profile: LayoutInputProfile,
	keys: string[]
): { text: string; applied: readonly AppliedLayoutInputBehavior[][] } {
	let text = '';
	let history = '';
	const applied: AppliedLayoutInputBehavior[][] = [];

	for (const key of keys) {
		const result = resolveLayoutInput(profile, history, key);
		text += result.text;
		history = result.nextHistory;
		applied.push([...result.applied]);
	}

	return { text, applied };
}

describe('layout input registry', () => {
	const profiles = compileLayoutInputRegistry({
		vylet: { magicKeys: vyletMappings },
		'vylet-v4': { adaptiveSwaps: vyletV4Swaps }
	});

	test('loads each behavior by its Cmini layout name', () => {
		expect(typeLogicalKeys(profiles.get('vylet')!, ['c', '*']).text).toBe('ck');
		expect(typeLogicalKeys(profiles.get('vylet-v4')!, ['l', 'y']).text).toBe('lj');
		expect(profiles.has('not-configured')).toBe(false);
	});

	test('chains magic mappings from the previous emitted output', () => {
		const result = typeLogicalKeys(profiles.get('vylet')!, ['y', 'o', 'u', "'", '*', '*']);
		expect(result.text).toBe("you'll");
		expect(result.applied.slice(-2)).toEqual([['magic-key'], ['magic-key']]);
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

	test('records unmatched triggers and matches preceding letters case-insensitively', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { '*': { a: 'o', '*': 'z' } }
		});

		expect(typeLogicalKeys(profile, ['x', '*', '*']).text).toBe('x*z');
		expect(typeLogicalKeys(profile, ['A', '*']).text).toBe('Ao');
		expect(resolveLayoutInput(profile, '', '*').text).toBe('*');
	});

	test('rejects malformed and case-ambiguous profiles', () => {
		expect(() => validateMagicKeyMappings({ '*': null })).toThrow('rules must be an object');
		expect(() => validateMagicKeyMappings({ '*': {} })).toThrow('must have at least one rule');
		expect(() => validateMagicKeyMappings({ '*': { A: 'x', a: 'y' } })).toThrow(
			'repeats preceding sequence'
		);
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
