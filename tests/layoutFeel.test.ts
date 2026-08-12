import { describe, expect, test } from 'bun:test';
import { decodeLayout } from '$lib/layoutCodec';
import {
	createDefaultKeyboardInputConfig,
	createKeyboardInputConfigFromLayout
} from '$lib/keyboardInputConfig';
import {
	applyAnglemodToDisplayRows,
	computeDisplayRows,
	displayRowsToString
} from '$lib/layoutDisplay';
import {
	buildFeelCharMap,
	buildFeelInputKeyMaps,
	feelCorrectPrefixLength,
	feelCorrectInputPrefix,
	countFeelInputAttempts,
	feelHighlightKeys,
	feelNextTargetKeys,
	feelSourceCorrectCharacterCount,
	FEEL_SIMULATED_THUMB_MARKER,
	feelKeystrokeAccepts,
	hasFeelInputError,
	isFeelWordComplete,
	planFeelWord,
	shouldIgnoreFeelWrongKeyPress,
	translateFeelWord,
	translateFeelWords,
	withSimulatedThumbFeelMarkers
} from '$lib/layoutFeel';
import { createLayoutTestKeyMaps, withKeyboardInputConfig } from '$lib/layoutTestEmulator';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';

const colemakDh = decodeLayout([
	'Colemak-DH',
	1,
	2,
	'2023-05-03T21:22:37+00:00',
	18,
	[
		'q',
		'w',
		'f',
		'p',
		'b',
		'j',
		'l',
		'u',
		'y',
		';',
		'a',
		'r',
		's',
		't',
		'g',
		'm',
		'n',
		'e',
		'i',
		'o',
		"'",
		'z',
		'x',
		'c',
		'd',
		'v',
		'k',
		'h',
		',',
		'.',
		'/'
	],
	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
	[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
]);

const qwerty = decodeLayout([
	'QWERTY',
	1,
	1,
	'2023-05-16T00:00:01+00:00',
	2,
	[
		'q',
		'w',
		'e',
		'r',
		't',
		'y',
		'u',
		'i',
		'o',
		'p',
		'[',
		']',
		'\\',
		'a',
		's',
		'd',
		'f',
		'g',
		'h',
		'j',
		'k',
		'l',
		';',
		"'",
		'z',
		'x',
		'c',
		'v',
		'b',
		'n',
		'm',
		',',
		'.',
		'/'
	],
	[
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2,
		2, 2
	],
	[
		0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6,
		7, 8, 9
	]
]);

function feelMapsFor(layout: ReturnType<typeof decodeLayout>) {
	const rows = computeDisplayRows(layout);
	const keyMaps = createLayoutTestKeyMaps(displayRowsToString(rows), { layout, rows });
	return { layout, keyMaps };
}

describe('layout feel translation', () => {
	test('rewrites target-layout words into known-layout physical labels', () => {
		const { layout, keyMaps } = feelMapsFor(colemakDh);
		const feelMap = buildFeelCharMap(keyMaps, createDefaultKeyboardInputConfig(), layout);

		expect(translateFeelWord('hello', feelMap)).toBe('mkuu;');
		expect(translateFeelWords(['hello', 'world'], feelMap)).toEqual(['mkuu;', 'w;suv']);
	});

	test('keeps words unchanged when the known layout matches the target', () => {
		const { layout, keyMaps } = feelMapsFor(qwerty);
		const feelMap = buildFeelCharMap(keyMaps, createKeyboardInputConfigFromLayout(layout), layout);

		expect(translateFeelWord('hello', feelMap)).toBe('hello');
	});

	test('leaves unmapped characters intact', () => {
		const feelMap = { h: 'm', e: 'k' };
		expect(translateFeelWord('he!', feelMap)).toBe('mk!');
	});

	test('marks simulated thumb keystrokes as underscores while leaving space alone', () => {
		const marked = withSimulatedThumbFeelMarkers({ r: 't', e: 'k', ' ': ' ' }, ['r', ' ']);
		expect(marked.r).toBe(FEEL_SIMULATED_THUMB_MARKER);
		expect(marked[' ']).toBe(' ');
		expect(marked.e).toBe('k');

		const plan = planFeelWord('rare', ['r', 'a', 'r', 'e'], undefined, [], marked);
		expect(plan.keystrokes.map((step) => step.feel)).toEqual([
			FEEL_SIMULATED_THUMB_MARKER,
			'a',
			FEEL_SIMULATED_THUMB_MARKER,
			'k'
		]);
		expect(plan.feelWord).toBe(`${FEEL_SIMULATED_THUMB_MARKER}a${FEEL_SIMULATED_THUMB_MARKER}k`);
		expect(isFeelWordComplete(plan, plan.feelWord)).toBe(true);
		expect(hasFeelInputError(plan, 'rare')).toBe(true);
	});

	test('soft-locks unassigned thumb keystrokes so the base-layout letter does not count', () => {
		const unreachable = new Set(['r']);
		const plan = planFeelWord('rare', ['r', 'a', 'r', 'e'], undefined, [], {}, unreachable);

		expect(plan.keystrokes[0]?.unreachable).toBe(true);
		expect(plan.keystrokes[0]?.feel).toBe('r');
		expect(feelKeystrokeAccepts(plan.keystrokes[0]!, 'r')).toBe(false);
		expect(hasFeelInputError(plan, 'r')).toBe(true);
		expect(isFeelWordComplete(plan, 'rare')).toBe(false);

		expect(plan.keystrokes[1]?.unreachable).toBeUndefined();
		expect(feelKeystrokeAccepts(plan.keystrokes[1]!, 'a')).toBe(true);
	});

	test('keeps assigned thumb keystrokes reachable', () => {
		const plan = planFeelWord('ra', ['r', 'a'], undefined, [], { r: ';', a: 'a' }, new Set());
		expect(plan.keystrokes[0]?.unreachable).toBeUndefined();
		expect(feelKeystrokeAccepts(plan.keystrokes[0]!, ';')).toBe(true);
	});

	test('builds identity input maps so typed known labels match the remapped prompt', () => {
		const { keyMaps } = feelMapsFor(colemakDh);
		const inputMaps = buildFeelInputKeyMaps(keyMaps, createDefaultKeyboardInputConfig());

		expect(inputMaps.inputKeyMap?.m).toBe('m');
		expect(inputMaps.inputKeyMap?.M).toBe('M');
		expect(inputMaps.inputKeyMap?.[';']).toBe(';');
	});

	test('highlights the practiced-layout keycap for a remapped next character', () => {
		const { layout, keyMaps } = feelMapsFor(colemakDh);
		const knownConfig = createDefaultKeyboardInputConfig();
		const knownToTarget = withKeyboardInputConfig(keyMaps, layout, knownConfig).inputKeyMap ?? {};

		expect(feelHighlightKeys(['m', 'k'], knownToTarget)).toEqual(['h', 'e']);
	});

	test('follows anglemod-transformed visual slots', () => {
		const target = decodeLayout([
			'anglemod-target',
			1,
			2,
			'2026-01-01T00:00:00Z',
			2,
			['q', 'a', 'z', 'x', 'c', 'v', 'b'],
			[0, 1, 2, 2, 2, 2, 2],
			[0, 0, 0, 1, 2, 3, 4]
		]);
		const rows = applyAnglemodToDisplayRows(computeDisplayRows(target));
		const keyMaps = createLayoutTestKeyMaps(displayRowsToString(rows), { layout: target, rows });
		const feelMap = buildFeelCharMap(
			keyMaps,
			{
				baseLayoutName: 'custom',
				baseLayoutModified: false,
				keyboardType: 'ortho',
				keys: [
					{ slot: '2,0', value: 'a' },
					{ slot: '2,1', value: 's' },
					{ slot: '2,2', value: 'd' },
					{ slot: '2,3', value: 'f' },
					{ slot: '2,4', value: 'g' }
				]
			},
			target
		);

		// Anglemod rotates z x c v b → x c v b z on physical columns 0..4.
		expect(feelMap.x).toBe('a');
		expect(feelMap.z).toBe('g');
	});
});

describe('layout feel Magic and Adaptive planning', () => {
	test('plans Magic trigger keystrokes and remaps them onto the known layout', () => {
		const { layout, keyMaps } = feelMapsFor(colemakDh);
		const feelMap = buildFeelCharMap(keyMaps, createDefaultKeyboardInputConfig(), layout);
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { th: 'e' } } }
		});
		const availableKeys = [...Object.keys(layout.keys), '*'];
		const plan = planFeelWord('theme', availableKeys, profile, [], feelMap);

		expect(plan.keystrokes.map((step) => step.targetKey)).toEqual(['t', 'h', '*', 'm', 'e']);
		expect(plan.keystrokes[2]?.applied).toContain('magic-key');
		expect(plan.keystrokes[2]?.alternateFeel).toBe(feelMap.e);
		expect(plan.feelWord).toBe(
			`${feelMap.t}${feelMap.h}${feelMap['*'] ?? '*'}${feelMap.m}${feelMap.e}`
		);
		expect(Array.from(plan.magicIndexes).toSorted((a, b) => a - b)).toEqual([0, 1, 2]);
		expect(feelNextTargetKeys(plan, 2)).toEqual(['*']);
	});

	test('plans Adaptive base keystrokes and marks remapped underline spans', () => {
		const { layout, keyMaps } = feelMapsFor(qwerty);
		const feelMap = buildFeelCharMap(keyMaps, createKeyboardInputConfigFromLayout(layout), layout);
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { n: { "'": 'h' } } }
		});
		const plan = planFeelWord("can't", Object.keys(layout.keys), profile, [], feelMap);

		// After n, pressing h emits ' via the swap, so the feel prompt shows the base key.
		expect(plan.keystrokes.map((step) => step.targetKey)).toEqual(['c', 'a', 'n', 'h', 't']);
		expect(plan.feelWord).toBe('canht');
		expect(plan.keystrokes[3]?.applied).toContain('adaptive-swap');
		expect(plan.keystrokes[3]?.alternateFeel).toBeUndefined();
		expect(Array.from(plan.adaptiveIndexes).toSorted((a, b) => a - b)).toEqual([2, 3]);
	});

	test('falls back to ordinary letters when Magic is disabled', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { th: 'e' } } }
		});
		const plan = planFeelWord('theme', ['t', 'h', 'e', 'm', '*'], profile, [], {
			t: 't',
			h: 'h',
			e: 'e',
			m: 'm',
			'*': '*'
		});
		// With magic enabled, * is preferred for the e after th.
		expect(plan.keystrokes.map((step) => step.targetKey)).toEqual(['t', 'h', '*', 'm', 'e']);
		expect(plan.keystrokes[2]?.alternateFeel).toBe('e');

		const plain = planFeelWord('theme', ['t', 'h', 'e', 'm', '*'], undefined, [], {
			t: 't',
			h: 'h',
			e: 'e',
			m: 'm',
			'*': '*'
		});
		expect(plain.keystrokes.map((step) => step.targetKey)).toEqual(['t', 'h', 'e', 'm', 'e']);
		expect(plain.feelWord).toBe('theme');
	});
});

describe('layout feel Magic literal alternates', () => {
	const identityMap = {
		t: 't',
		h: 'h',
		e: 'e',
		m: 'm',
		'*': '*'
	};

	function themePlan() {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { th: 'e' } } }
		});
		return planFeelWord('theme', ['t', 'h', 'e', 'm', '*'], profile, [], identityMap);
	}

	test('accepts the remapped literal emit instead of the preferred Magic trigger', () => {
		const plan = themePlan();
		expect(isFeelWordComplete(plan, 'th*me')).toBe(true);
		expect(isFeelWordComplete(plan, 'theme')).toBe(true);
		expect(hasFeelInputError(plan, 'theme')).toBe(false);
		expect(feelCorrectPrefixLength(plan, 'the')).toBe(3);
		expect(feelSourceCorrectCharacterCount(plan, 'the')).toBe(3);
		expect(feelSourceCorrectCharacterCount(plan, 'theme')).toBe(5);
		expect(feelNextTargetKeys(plan, feelCorrectPrefixLength(plan, 'th'))).toEqual(['*']);
	});

	test('still rejects unrelated keys and does not offer Adaptive alternates', () => {
		const plan = themePlan();
		expect(hasFeelInputError(plan, 'thx')).toBe(true);
		expect(shouldIgnoreFeelWrongKeyPress('th', 'thx', plan, true)).toBe(true);
		expect(shouldIgnoreFeelWrongKeyPress('th', 'the', plan, true)).toBe(false);

		const adaptivePlan = planFeelWord(
			"can't",
			['c', 'a', 'n', 'h', 't', "'"],
			compileLayoutInputProfile({ adaptiveSwaps: { mappings: { n: { "'": 'h' } } } }),
			[],
			{ c: 'c', a: 'a', n: 'n', h: 'h', t: 't', "'": "'" }
		);
		expect(adaptivePlan.keystrokes[3]?.feel).toBe('h');
		expect(adaptivePlan.keystrokes[3]?.alternateFeel).toBeUndefined();
		expect(hasFeelInputError(adaptivePlan, "can't")).toBe(true);
	});
});

describe('layout feel ignore wrong key presses', () => {
	test('ignores extending input that diverges from the target when enabled', () => {
		const plan = planFeelWord('hello', ['h', 'e', 'l', 'o', ';'], undefined, [], {
			h: 'm',
			e: 'k',
			l: 'u',
			o: 'y',
			';': ';'
		});
		expect(shouldIgnoreFeelWrongKeyPress('mk', 'mkx', plan, true)).toBe(true);
		expect(shouldIgnoreFeelWrongKeyPress('mk', 'mku', plan, true)).toBe(false);
	});

	test('also blocks deletions when enabled, and respects the disabled setting', () => {
		const plan = planFeelWord('hello', ['h', 'e', 'l', 'o', ';'], undefined, [], {
			h: 'm',
			e: 'k',
			l: 'u',
			o: 'y',
			';': ';'
		});
		expect(shouldIgnoreFeelWrongKeyPress('mkx', 'mk', plan, true)).toBe(true);
		expect(shouldIgnoreFeelWrongKeyPress('mk', 'mkx', plan, false)).toBe(false);
		expect(shouldIgnoreFeelWrongKeyPress('mkx', 'mk', plan, false)).toBe(false);
	});

	test('trims a dirty feel input back to the last correct prefix', () => {
		const plan = planFeelWord('hello', ['h', 'e', 'l', 'o', ';'], undefined, [], {
			h: 'm',
			e: 'k',
			l: 'u',
			o: 'y',
			';': ';'
		});
		expect(feelCorrectInputPrefix(plan, 'mkx')).toBe('mk');
		expect(feelCorrectInputPrefix(plan, 'mku')).toBe('mku');
		expect(feelCorrectInputPrefix(plan, '')).toBe('');
	});

	test('counts discarded wrong inserts as incorrect attempts', () => {
		const plan = planFeelWord('hello', ['h', 'e', 'l', 'o', ';'], undefined, [], {
			h: 'm',
			e: 'k',
			l: 'u',
			o: 'y',
			';': ';'
		});
		expect(countFeelInputAttempts('mk', 'mkx', plan)).toEqual({ correct: 0, incorrect: 1 });
		expect(countFeelInputAttempts('mk', 'mku', plan)).toEqual({ correct: 1, incorrect: 0 });
	});
});

describe('layout feel source reveal progress', () => {
	test('counts source characters covered by a correct feel prefix', () => {
		const plan = planFeelWord('hello', ['h', 'e', 'l', 'o', ';'], undefined, [], {
			h: 'm',
			e: 'k',
			l: 'u',
			o: 'y',
			';': ';'
		});
		expect(plan.feelWord).toBe('mkuuy');
		expect(feelSourceCorrectCharacterCount(plan, 'mku')).toBe(3);
		expect(feelSourceCorrectCharacterCount(plan, 'mkuuy')).toBe(5);
		expect(feelSourceCorrectCharacterCount(plan, 'mkx')).toBe(2);
		expect(feelSourceCorrectCharacterCount(undefined, 'mk')).toBe(0);
	});

	test('advances multiple source characters for a single Magic keystroke', () => {
		const plan = planFeelWord(
			'the',
			['t', 'h', 'e', '*'],
			compileLayoutInputProfile({ magicKeys: { mappings: { '*': { t: 'he' } } } }),
			[],
			{ t: 't', h: 'h', e: 'e', '*': '*' }
		);
		expect(plan.keystrokes.map((step) => step.targetKey)).toEqual(['t', '*']);
		expect(feelSourceCorrectCharacterCount(plan, 't*')).toBe(3);
		expect(feelSourceCorrectCharacterCount(plan, 't')).toBe(1);
	});
});
