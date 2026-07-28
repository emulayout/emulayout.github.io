import { describe, expect, test } from 'bun:test';
import { compileMagicKeyRegistry } from '$lib/magicKeyRegistry';
import {
	compileMagicKeyMappings,
	resolveMagicKeyInput,
	type MagicKeyProfile,
	validateMagicKeyMappings
} from '$lib/magicKeys';
import vyletMappings from '../data/magic-keys/vylet.json';
import { validateMagicKeyMappingsForLayout } from '../bin/magic-key-data.js';

const profiles = compileMagicKeyRegistry({ vylet: vyletMappings });

function typeLogicalKeys(profile: MagicKeyProfile, keys: string[]): { text: string } {
	let text = '';
	let history = '';

	for (const key of keys) {
		const result = resolveMagicKeyInput(profile, history, key);
		text += result.text;
		history = result.nextHistory;
	}

	return { text };
}

describe('magic-key registry', () => {
	test('loads Vylet by its Cmini layout name', () => {
		expect(typeLogicalKeys(profiles.get('vylet')!, ['c', '*']).text).toBe('ck');
		expect(profiles.has('vylet')).toBe(true);
		expect(profiles.has('magic-sturdy')).toBe(false);
		expect(profiles.has('not-configured')).toBe(false);
		expect(profiles.get('not-configured')).toBeUndefined();
	});

	test('chains Vylet mappings from the output of the previous magic key', () => {
		const profile = profiles.get('vylet')!;
		expect(typeLogicalKeys(profile, ['y', 'o', 'u', "'", '*', '*']).text).toBe("you'll");
	});
});

describe('magic-key input resolution', () => {
	test('supports multi-character output', () => {
		const profile = compileMagicKeyMappings({ '*': { t: 'ion' } });
		expect(typeLogicalKeys(profile, ['t', '*']).text).toBe('tion');
	});

	test('uses multi-character magic output as history for another magic press', () => {
		const profile = compileMagicKeyMappings({
			'*': {
				a: 'bc',
				bc: 'd'
			}
		});

		expect(typeLogicalKeys(profile, ['a', '*', '*']).text).toBe('abcd');
	});

	test('keeps bounded history and chooses the longest matching sequence', () => {
		const profile = compileMagicKeyMappings({
			'*': {
				h: 'x',
				th: 'e'
			}
		});

		expect(typeLogicalKeys(profile, ['t', 'h', '*']).text).toBe('the');
		expect(typeLogicalKeys(profile, ['x', 'h', '*']).text).toBe('xhx');
	});

	test('keeps separate mappings for separate magic keys', () => {
		const profile = compileMagicKeyMappings({
			'*': { a: 'o' },
			'@': { a: 'e' }
		});

		expect(typeLogicalKeys(profile, ['a', '*']).text).toBe('ao');
		expect(typeLogicalKeys(profile, ['a', '@']).text).toBe('ae');
	});

	test('emits an unmatched trigger literally and records that output', () => {
		const profile = compileMagicKeyMappings({ '*': { a: 'o', '*': 'z' } });
		const first = typeLogicalKeys(profile, ['x', '*']);
		expect(first.text).toBe('x*');
		expect(typeLogicalKeys(profile, ['x', '*', '*']).text).toBe('x*z');
	});

	test('matches letter rules without depending on Shift casing', () => {
		const profile = compileMagicKeyMappings({ '*': { a: 'o' } });
		expect(typeLogicalKeys(profile, ['A', '*']).text).toBe('Ao');
	});

	test('uses only the supplied logical input history', () => {
		const profile = compileMagicKeyMappings({ '*': { a: 'o', c: 'k' } });
		expect(resolveMagicKeyInput(profile, 'c', '*').text).toBe('k');
		expect(resolveMagicKeyInput(profile, 'a', '*').text).toBe('o');
		expect(resolveMagicKeyInput(profile, '', '*').text).toBe('*');
	});

	test('rejects malformed and ambiguous profiles', () => {
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
