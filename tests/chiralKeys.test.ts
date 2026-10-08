import { expect, test } from 'bun:test';
import { buildTypingPracticeChiralGroupIndexes } from '../src/lib/typingPracticeMagicGroups';
import { planFeelWord } from '../src/lib/layoutFeel';
import {
	buildLayoutKeyboardFeedback,
	isSpecialTriggerFeedback
} from '../src/lib/layoutKeyboardFeedback';
import {
	chiralMappingId,
	compileChiralKeys,
	resolveChiralKeyOutput,
	validateChiralKeySource
} from '../src/lib/chiralKeys';
import { compileLayoutInputProfile, resolveLayoutInput } from '../src/lib/layoutInputBehaviors';
import { chiralDraftFromSource, chiralSourceFromDraft } from '../src/lib/creatorChiralMappings';
import {
	createDefaultCreatorUrlSnapshot,
	readCreatorUrlSnapshot,
	writeCreatorUrlParams
} from '../src/lib/layoutCreatorUrl';

const source = {
	keys: [
		{
			key: '/',
			same: { kind: 'char' as const, char: 'e' },
			opposite: { kind: 'char' as const, char: 'i' },
			except: ['m']
		}
	]
};
const keys = { a: { col: 0 }, h: { col: 5 }, m: { col: 6 }, '/': { col: 9 } };

test('Space triggers, outputs and exceptions use assigned hands and survive draft URLs', () => {
	const source = validateChiralKeySource({
		keys: [
			{
				key: ' ',
				same: { kind: 'char', char: 'e' },
				opposite: { kind: 'char', char: ' ' },
				except: ['m']
			},
			{ key: '/', same: { kind: 'char', char: ' ' }, opposite: { kind: 'repeat' }, except: [' '] }
		],
		hands: { ' ': 'l' }
	});
	const profile = compileLayoutInputProfile({ chiralKeys: source }, keys);
	expect(resolveLayoutInput(profile, 'a', ' ').text).toBe('e');
	expect(resolveLayoutInput(profile, 'h', ' ').text).toBe(' ');
	expect(resolveLayoutInput(profile, '', ' ').text).toBe(' ');
	expect(resolveLayoutInput(profile, 'm', ' ').text).toBe(' ');
	expect(resolveLayoutInput(profile, 'h', '/').text).toBe(' ');
	expect(resolveLayoutInput(profile, ' ', '/').text).toBe('/');
	expect(resolveLayoutInput(profile, 'a', ' ', new Set([chiralMappingId(' ')])).text).toBe(' ');
	const snapshot = createDefaultCreatorUrlSnapshot();
	snapshot.includeChiralKey = true;
	snapshot.chiralDraft = chiralDraftFromSource(source);
	const params = writeCreatorUrlParams(snapshot);
	const restored = readCreatorUrlSnapshot(params);
	expect(chiralSourceFromDraft(restored.chiralDraft!)?.keys).toEqual(source.keys);
	for (const char of ['\t', '\n', '\u00a0']) {
		expect(() => validateChiralKeySource({ keys: [{ key: char }] })).toThrow();
		expect(() =>
			validateChiralKeySource({ keys: [{ key: '/', same: { kind: 'char', char } }] })
		).toThrow();
		expect(() => validateChiralKeySource({ keys: [{ key: '/', except: [char] }] })).toThrow();
	}
});

test('marks native chiral groups separately, respecting exceptions, disabled keys and Magic priority', () => {
	const profile = compileLayoutInputProfile({ chiralKeys: source }, keys);
	expect([...buildTypingPracticeChiralGroupIndexes('ai', profile)]).toEqual([0, 1]);
	expect([...buildTypingPracticeChiralGroupIndexes('he', profile)]).toEqual([0, 1]);
	expect([...buildTypingPracticeChiralGroupIndexes('me', profile)]).toEqual([]);
	expect([...buildTypingPracticeChiralGroupIndexes('ai', profile, [chiralMappingId('/')])]).toEqual(
		[]
	);
	const shadowed = compileLayoutInputProfile(
		{ chiralKeys: source, magicKeys: { mappings: { '/': { a: 'i' } } } },
		keys
	);
	expect([...buildTypingPracticeChiralGroupIndexes('ai', shadowed)]).toEqual([]);
	const plan = planFeelWord('ai', Object.keys(keys), profile, [], { a: 'a', '/': '/' });
	expect([...plan.chiralIndexes]).toEqual([0, 1]);
	expect([...plan.magicIndexes]).toEqual([]);
});

test('keeps chiral keyboard presentation distinct from Magic and removes it when disabled', () => {
	const chiralKeys = compileChiralKeys(source, keys);
	expect(buildLayoutKeyboardFeedback({ chiralKeys, inputHistory: 'a' }).get('/')).toEqual({
		kind: 'chiral',
		value: 'i',
		active: true
	});
	expect(isSpecialTriggerFeedback('chiral')).toBe(true);
	expect(
		buildLayoutKeyboardFeedback({
			chiralKeys,
			inputHistory: 'a',
			disabledMappingIds: [chiralMappingId('/')]
		}).has('/')
	).toBe(false);
});

test('resolves native chirals with literal exceptions, empty and unknown context', () => {
	const profile = compileChiralKeys(source, keys);
	for (const [previous, expected] of [
		['a', 'i'],
		['h', 'e'],
		['m', '/'],
		['', '/'],
		[' ', '/'],
		['🙂', '/'],
		['A', 'i']
	]) {
		expect(resolveChiralKeyOutput(profile, previous, '/').text).toBe(expected);
	}
	expect(resolveChiralKeyOutput(profile, 'a', '/', new Set([chiralMappingId('/')]))).toEqual({
		text: '/',
		matched: false
	});
});

test('recompiles hands after edits and honors explicit primary hand assignments', () => {
	expect(
		resolveChiralKeyOutput(compileChiralKeys(source, { ...keys, a: { col: 7 } }), 'a', '/').text
	).toBe('e');
	expect(
		resolveChiralKeyOutput(
			compileChiralKeys(source, { ...keys, a: { col: 7, hand: 'l' } }),
			'a',
			'/'
		).text
	).toBe('i');
	const custom = compileChiralKeys({ ...source, hands: { a: 'r', A: 'l' } }, keys);
	expect(resolveChiralKeyOutput(custom, 'a', '/').text).toBe('e');
	expect(resolveChiralKeyOutput(custom, 'A', '/').text).toBe('i');
});

test('supports repeat and Unicode without recursively interpreting emitted text', () => {
	const profile = compileLayoutInputProfile(
		{
			chiralKeys: {
				keys: [{ key: '@', same: { kind: 'repeat' }, opposite: { kind: 'char', char: '🙂' } }]
			}
		},
		{ '@': { col: 9 }, é: { col: 8 }, a: { col: 0 } }
	);
	expect(profile.repeatKey).toBeUndefined();
	expect(resolveLayoutInput(profile, 'é', '@').text).toBe('é');
	expect(resolveLayoutInput(profile, 'a', '@')).toMatchObject({
		text: '🙂',
		nextHistory: '🙂',
		applied: ['chiral-key']
	});
});

test('composes adaptive then Magic then chiral and respects Magic priority', () => {
	const profile = compileLayoutInputProfile(
		{
			chiralKeys: source,
			adaptiveSwaps: { mappings: { a: { h: '/' } } }
		},
		keys
	);
	expect(resolveLayoutInput(profile, 'a', 'h')).toMatchObject({
		text: 'i',
		applied: ['adaptive-swap', 'chiral-key']
	});
	const magic = compileLayoutInputProfile(
		{
			chiralKeys: source,
			magicKeys: { mappings: { '/': { rules: { a: 'x' }, fallback: { emit: '/' } } } }
		},
		keys
	);
	expect(resolveLayoutInput(magic, 'a', '/').text).toBe('x');
});

test('round-trips compact creator definitions and custom hands without Magic expansion', () => {
	const snapshot = createDefaultCreatorUrlSnapshot();
	snapshot.includeChiralKey = true;
	snapshot.chiralDraft = chiralDraftFromSource(source);
	snapshot.keyConfig.keys[0].hand = 'r';
	const params = writeCreatorUrlParams(snapshot);
	expect(params.has('document')).toBe(true);
	expect(params.has('magic')).toBe(false);
	const restored = readCreatorUrlSnapshot(params);
	expect(chiralSourceFromDraft(restored.chiralDraft!)).toEqual(source);
	expect(restored.keyConfig.keys[0].hand).toBe('r');
	expect(readCreatorUrlSnapshot(new URLSearchParams('chiral=garbage')).includeChiralKey).toBe(
		false
	);
});

test('rejects malformed outputs and duplicated native triggers', () => {
	expect(() =>
		validateChiralKeySource({ keys: [{ key: '/', same: { kind: 'char', char: 'ab' } }] })
	).toThrow();
	expect(() => validateChiralKeySource({ keys: [source.keys[0], source.keys[0]] })).toThrow();
});
