import { expect, test } from 'bun:test';
import { formatMagicContext, parseMagicPattern, matchesMagicContext } from '$lib/magicContext';
import { compileMagicKeyMappings, resolveMagicKeyOutput } from '$lib/magicKeys';
import { validateSparkLayout, type SparkLayout } from '$lib/sparkSchema';
import { compileSparkLayout } from '$lib/sparkCompiler';
import { magicRuleMappingId, magicFallbackMappingId } from '$lib/inputMappingControls';
import { resolveLayoutInput } from '$lib/layoutInputBehaviors';
import { buildMagicKeyboardFeedback } from '$lib/layoutKeyboardFeedback';
import { buildTypingPracticeMagicGroupIndexes } from '$lib/typingPracticeMagicGroups';
import { planFeelWord } from '$lib/layoutFeel';
import { importAklTryPayload } from '$lib/aklTryImport';
import { buildCreatorDocument, readCreatorDocument } from '$lib/creatorDocument';
import { magicSourceFromDraft, compileCreatorInputProfile } from '$lib/layoutCreatorMappings';

const source: SparkLayout = {
	keys: [
		{ char: 'h', row: 1, col: 5, finger: 'RI' },
		{ char: 'a', row: 1, col: 0, finger: 'LP' },
		{ char: ';', row: 1, col: 9, finger: 'RP' },
		{ char: '/', row: 2, col: 9, finger: 'RP' }
	],
	magic: {
		magic_keys: [
			{ key: ';', rules: [{ after: ['h', null], emit: 'h', note: 'keep' }] },
			{ key: '/', default: { kind: 'skip_repeat' } }
		]
	}
};

test('Spark retains wildcard contexts and skip-repeat while dropping future shapes', () => {
	const result = validateSparkLayout(source);
	expect(result.layout).toEqual(source);
	expect(result.dropped).toEqual([]);
	result.layout.magic!.magic_keys![0].rules![0].emit = 'x';
	expect(source.magic!.magic_keys![0].rules![0].emit).toBe('h');
	const malformed = validateSparkLayout({
		keys: [],
		magic: {
			magic_keys: [
				{
					key: '*',
					rules: [
						{ after: ['ab', null], emit: 'x' },
						{ after: [], emit: 'x' },
						{ after: [4, null], emit: 'x' },
						{ after: 'h', emit: 'e' }
					]
				}
			]
		}
	});
	expect(malformed.dropped).toHaveLength(3);
	expect(malformed.layout.magic?.magic_keys?.[0].rules).toEqual([{ after: 'h', emit: 'e' }]);
});

test('wildcards consume one Unicode character, preserve literals, and require complete history', () => {
	for (const history of ['ha', 'h ', 'h😀'])
		expect(matchesMagicContext(history, ['h', null])).toBe(true);
	for (const history of ['', 'h', 'haa', 'Ha'])
		expect(matchesMagicContext(history, ['h', null])).toBe(false);
	expect(matchesMagicContext('ha', 'h?')).toBe(false);
	expect(parseMagicPattern('h?')).toEqual(['h', null]);
	expect(parseMagicPattern('h\\?')).toEqual(['h', '?']);
	expect(parseMagicPattern('h\\')).toBeNull();
	const context = ['?', '\\', null, '😀'];
	expect(parseMagicPattern(formatMagicContext(context))).toEqual(context);
});

test('longest context wins, then specificity, then source order; disabling exposes the next match', () => {
	const profile = compileMagicKeyMappings({
		'*': {
			rules: [
				{ after: [null, null], emit: 'wild' },
				{ after: ['h', null], emit: 'first' },
				{ after: [null, 'a'], emit: 'second' },
				{ after: 'ha', emit: 'exact' },
				{ after: ['x', null, null], emit: 'long' }
			]
		}
	});
	expect(resolveMagicKeyOutput(profile, 'ha', '*').text).toBe('exact');
	expect(resolveMagicKeyOutput(profile, 'xha', '*').text).toBe('long');
	const disabled = new Set([magicRuleMappingId('*', 'ha')]);
	expect(resolveMagicKeyOutput(profile, 'ha', '*', disabled).text).toBe('first');
	disabled.add(magicRuleMappingId('*', ['h', null]));
	expect(resolveMagicKeyOutput(profile, 'ha', '*', disabled).text).toBe('second');
	expect(magicRuleMappingId('*', 'h?')).not.toBe(magicRuleMappingId('*', ['h', null]));
});

test('skip repeat uses emitted history, chains, respects disabled mappings, and never falls back to bare @', () => {
	const { profile } = compileSparkLayout(source);
	let history = '';
	let output = '';
	for (const key of 'ha//') {
		const result = resolveLayoutInput(profile, history, key);
		history = result.nextHistory;
		output += result.text;
	}
	expect(output).toBe('haha');
	for (const history of ['', 'h'])
		expect(resolveMagicKeyOutput(profile?.magicKeys, history, '/').text).toBe('');
	expect(resolveMagicKeyOutput(profile?.magicKeys, '😀a', '/').text).toBe('😀');
	expect(
		resolveMagicKeyOutput(profile?.magicKeys, 'ha', '/', new Set([magicFallbackMappingId('/')]))
			.text
	).toBe('');
	const at = compileSparkLayout({
		keys: [{ char: '@', row: 0, col: 0, finger: 'LP' }],
		magic: { magic_keys: [{ key: '@', default: { kind: 'skip_repeat' } }] }
	});
	expect(at.profile?.repeatKey).toBeUndefined();
	expect(resolveMagicKeyOutput(at.profile?.magicKeys, 'ab', '@').text).toBe('a');
	const explicit = compileMagicKeyMappings({
		'*': { rules: { ab: 'x' }, fallback: 'skip-repeat' }
	});
	expect(resolveMagicKeyOutput(explicit, 'ab', '*').text).toBe('x');
});

test('keyboard previews, lesson groups, and Feel planning use wildcard and skip-repeat behavior', () => {
	const { profile } = compileSparkLayout(source);
	for (const key of [';', '/'])
		expect(buildMagicKeyboardFeedback(profile?.magicKeys, 'ha').get(key)).toEqual({
			kind: 'magic',
			value: 'h',
			active: true
		});
	expect(buildMagicKeyboardFeedback(profile?.magicKeys, 'h').get('/')).toEqual({ kind: 'magic' });
	expect([...buildTypingPracticeMagicGroupIndexes('hah', profile?.magicKeys)]).toEqual([0, 1, 2]);
	const plan = planFeelWord('hah', ['h', 'a', ';', '/'], profile, [], {});
	expect(plan.keystrokes.map((key) => key.emitted).join('')).toBe('hah');
	expect(plan.keystrokes.at(-1)?.applied).toContain('magic-key');
	expect([...plan.magicIndexes]).toEqual([0, 1, 2]);
});

test('creator imports, edits, and document round trips preserve wildcard identity and metadata', () => {
	const imported = importAklTryPayload({
		v: 1,
		format: 'spark/1',
		name: 'Skip',
		board: 'ortho',
		layout: source
	});
	const snapshot = imported.snapshot!;
	expect(imported.notice).not.toContain('without');
	expect(snapshot.magicDraft.sections[0].rules[0]).toMatchObject({ after: 'h?', wildcard: true });
	expect(snapshot.magicDraft.sections[1].fallbackKind).toBe('skip-repeat');
	snapshot.magicDraft.sections[0].rules[0].emit = 'a';
	const document = buildCreatorDocument(snapshot);
	expect(document.layout.magic?.magic_keys?.[0].rules?.[0]).toEqual({
		after: ['h', null],
		emit: 'a',
		note: 'keep'
	});
	const restored = readCreatorDocument(JSON.parse(JSON.stringify(document)))!;
	expect(restored).not.toBeNull();
	expect(restored.magicDraft.sections[0].rules[0]).toMatchObject({
		after: 'h?',
		wildcard: true,
		emit: 'a'
	});
	const runtime = compileCreatorInputProfile(
		true,
		restored.magicDraft,
		false,
		restored.adaptiveDraft
	);
	expect(resolveMagicKeyOutput(runtime?.magicKeys, 'ha', ';').text).toBe('a');
	expect(resolveMagicKeyOutput(runtime?.magicKeys, 'ha', '/').text).toBe('h');
	restored.magicDraft.sections[0].rules[0].wildcard = false;
	const exact = magicSourceFromDraft(restored.magicDraft)!;
	expect(resolveMagicKeyOutput(compileMagicKeyMappings(exact.mappings), 'ha', ';').text).toBe('');
});
