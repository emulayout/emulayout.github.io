import { expect, test } from 'bun:test';
import { validateSparkLayout } from '$lib/sparkSchema';
import { compileSparkLayout } from '$lib/sparkCompiler';
import { compileLayoutInputRegistry, resolveLayoutInput } from '$lib/layoutInputBehaviors';
import { importAklTryPayload } from '$lib/aklTryImport';
import {
	creatorDraftsFromSupplemental,
	compileCreatorInputProfile
} from '$lib/layoutCreatorMappings';
import { createLayoutFromKeyConfig } from '$lib/layoutCreator';
import { chiralMappingId } from '$lib/chiralKeys';

function layout() {
	return {
		keys: [
			{ char: 'n', row: 2, col: 5, finger: 'RI' },
			{ char: 'a', row: 1, col: 0, finger: 'LP' },
			{ char: 'h', row: 1, col: 5, finger: 'RI' },
			{ char: 'j', row: 1, col: 6, finger: 'RI' },
			{ char: ';', row: 1, col: 9, finger: 'RP' },
			{ char: '/', row: 2, col: 9, finger: 'RP' },
			{ char: 'b', row: 2, col: 4, finger: 'LI' },
			{ char: '@', row: 2, col: 8, finger: 'RR' }
		],
		magic: {
			magic_keys: [
				{
					key: ';',
					default: { kind: 'repeat' },
					rules: [{ after: 'th', emit: 'e' }],
					except: ['q']
				}
			],
			chiral_keys: [
				{
					key: '/',
					same: { kind: 'char', char: 'e' },
					opposite: { kind: 'char', char: 'i' },
					except: ['j']
				}
			],
			adaptive_swaps: [{ trigger: 'n', swap: ['h', 'j'] }],
			rules: [{ inputs: 'ab', output: 'ax', type: 'raw', note: 'Keep me' }]
		}
	};
}

test('shared validation rejects malformed known fields with paths', () => {
	const valid = layout();
	for (const invalid of [
		null,
		[],
		{},
		{ keys: 'a' },
		{ ...valid, schema: 2 },
		{ keys: [{ char: 'ab', row: 0, col: 0, finger: 'LP' }] },
		{ keys: [{ char: 'a', row: 0.5, col: 0, finger: 'LP' }] },
		{ keys: [{ char: 'a', row: 0, col: -1, finger: 'LP' }] },
		{ keys: [{ char: 'a', row: 0, col: 0, finger: 'unknown' }] },
		{ keys: [valid.keys[0], valid.keys[0]] },
		{ keys: [], magic: { magic_keys: [{ key: ';', default: { kind: 'char', char: 'word' } }] } },
		{ keys: [], magic: { magic_keys: [{ key: ';', rules: [{ after: '', emit: 'x' }] }] } },
		{ keys: [], magic: { chiral_keys: [{ key: '/', opposite: { kind: 'other' } }] } },
		{ keys: [], magic: { adaptive_swaps: [{ trigger: 'n', swap: ['h'] }] } },
		{ keys: [], magic: { rules: [{ inputs: 'ab', output: 1 }] } },
		{ keys: [], magic: { rules: null } }
	])
		expect(() => validateSparkLayout(invalid)).toThrow();
	expect(() =>
		validateSparkLayout({ keys: [], magic: { rules: [{ inputs: 'ab', output: 1 }] } })
	).toThrow('magic.rules[0].output');
});

test('source content and extension fields survive compilation unchanged and independently', () => {
	const original = {
		...layout(),
		extension: { future: [1, 2] },
		keys: [
			...layout().keys,
			{ row: 0, col: 1, finger: 'LR', note: 'free' },
			{ char: '1', row: -1, col: 0, finger: 'LP' },
			{ char: 'z', row: 99, col: 999, finger: 'RP' }
		],
		magic: {
			...layout().magic,
			rules: [
				{ inputs: 'ab', output: '', note: 'deletion' },
				{ inputs: ' b', output: ' x', note: 'boundary' }
			]
		}
	};
	const before = JSON.stringify(original);
	const result = compileSparkLayout(original);
	expect(result.document).toEqual(validateSparkLayout(original));
	expect(JSON.stringify(original)).toBe(before);
	expect(result.warnings).toEqual(
		expect.arrayContaining([
			'the number row',
			'keys outside supported keyboard bounds',
			'raw rules that rewrite or delete earlier text'
		])
	);
	expect(result.keys.some((key) => key.inert)).toBe(true);
	(result.document.extension as { future: number[] }).future.push(3);
	expect(original.extension.future).toEqual([1, 2]);
});

test('shared compiler and legacy creator bridge agree on supported runtime behavior', () => {
	const document = layout();
	const compiled = compileSparkLayout(document);
	const snapshot = importAklTryPayload({
		v: 1,
		format: 'spark/1',
		name: 'Test',
		board: 'ortho',
		layout: document
	}).snapshot!;
	const keys = createLayoutFromKeyConfig(snapshot.keyConfig).keys;
	const legacy = compileCreatorInputProfile(
		snapshot.includeMagicKey,
		snapshot.magicDraft,
		snapshot.includeAdaptiveKey,
		snapshot.adaptiveDraft,
		Object.keys(keys),
		snapshot.chiralDraft,
		keys
	);
	for (const [history, key, output] of [
		['th', ';', 'e'],
		['q', ';', ';'],
		['a', ';', 'a'],
		['a', '/', 'i'],
		['h', '/', 'e'],
		['j', '/', '/'],
		['', '/', '/'],
		['n', 'h', 'j'],
		['n', 'j', 'h'],
		['n', 'H', 'J'],
		['a', 'b', 'x'],
		['', 'b', 'b']
	]) {
		expect(resolveLayoutInput(compiled.profile, history, key).text).toBe(output);
		expect(resolveLayoutInput(legacy, history, key).text).toBe(output);
	}
	expect(resolveLayoutInput(compiled.profile, 'a', '/', new Set([chiralMappingId('/')])).text).toBe(
		'/'
	);
	expect(resolveLayoutInput(compiled.profile, 'a', '@').text).toBe('a');
});

test('duplicate characters retain first-occurrence hands, and nullable chiral branches stay literal', () => {
	const result = compileSparkLayout({
		keys: [
			{ char: 'a', row: 1, col: 9, finger: 'RP' },
			{ char: 'a', row: 1, col: 0, finger: 'LP' },
			{ char: '/', row: 2, col: 9, finger: 'RP' }
		],
		magic: { chiral_keys: [{ key: '/', same: { kind: 'char', char: 'e' }, opposite: null }] }
	});
	expect(result.keys[0].primary).toBe(true);
	expect(resolveLayoutInput(result.profile, 'a', '/').text).toBe('e');
	expect(result.document.magic?.chiral_keys?.[0].opposite).toBeNull();
});

test('unsupported conflicts are reported without corrupting supported behavior', () => {
	const document = layout();
	document.magic.adaptive_swaps.push({ trigger: 'n', swap: ['h', 'b'] });
	const result = compileSparkLayout(document);
	expect(result.warnings).toContain('conflicting Adaptive swaps');
	expect(result.document.magic?.adaptive_swaps).toHaveLength(2);
	expect(resolveLayoutInput(result.profile, 'n', 'h').text).toBe('j');
	expect(compileSparkLayout({ keys: [] }).profile).toBeUndefined();
});

test('catalog, imports, and creator seeding preserve literal whitespace contexts', () => {
	const document = layout();
	document.magic.magic_keys[0].rules = [{ after: ' a', emit: 'x' }];
	const transport = { format: 'spark/1' as const, layout: validateSparkLayout(document) };
	const compiled = compileSparkLayout(document);
	const keys = Object.fromEntries(document.keys.map((key) => [key.char, key]));
	const catalog = compileLayoutInputRegistry({ example: transport }, [
		{ name: 'example', keys }
	]).get('example');
	const drafts = creatorDraftsFromSupplemental({ example: transport }, 'example');
	const seeded = compileCreatorInputProfile(
		true,
		drafts.magicDraft,
		true,
		drafts.adaptiveDraft,
		Object.keys(keys),
		drafts.chiralDraft,
		keys
	);
	const snapshot = importAklTryPayload({
		v: 1,
		format: 'spark/1',
		name: 'example',
		board: 'ortho',
		layout: document
	}).snapshot!;
	const imported = compileCreatorInputProfile(
		true,
		snapshot.magicDraft,
		true,
		snapshot.adaptiveDraft,
		Object.keys(keys),
		snapshot.chiralDraft,
		keys
	);
	for (const profile of [compiled.profile, catalog, seeded, imported]) {
		expect(resolveLayoutInput(profile, ' a', ';').text).toBe('x');
		expect(resolveLayoutInput(profile, 'a', ';').text).toBe('a');
	}
});

test('Spark claims suppress bare Repeat while conventional declarations retain it', () => {
	const document = layout();
	document.magic.magic_keys = [{ key: '@', default: { kind: 'repeat' }, rules: [], except: [] }];
	const conventional = compileSparkLayout(document);
	expect(conventional.source.magicKeys?.mappings['@']).toBeUndefined();
	expect(resolveLayoutInput(conventional.profile, 'a', '@').text).toBe('a');
	const claimed = compileSparkLayout({
		keys: document.keys,
		magic: { magic_keys: [{ key: '@' }] }
	});
	expect(claimed.profile?.repeatKey).toBeUndefined();
});
