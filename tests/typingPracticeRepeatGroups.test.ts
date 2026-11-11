import { expect, test } from 'bun:test';
import { adaptiveRuleMappingId, repeatKeyMappingId } from '$lib/inputMappingControls';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import { buildTypingPracticeRepeatGroupIndexes } from '$lib/typingPracticeRepeatGroups';

const profile = compileLayoutInputProfile({}, { '@': {} });

test('marks adjacent repeated characters and overlapping pairs by Unicode character index', () => {
	for (const [word, indexes] of [
		['tell', [2, 3]],
		['arrest', [1, 2]],
		['bookkeeper', [1, 2, 3, 4, 5, 6]],
		['aaa', [0, 1, 2]],
		['😀éé', [1, 2]],
		['dared', []]
	] as const) {
		expect([...buildTypingPracticeRepeatGroupIndexes(word, profile)]).toEqual([...indexes]);
	}
});

test('omits absent, disabled, and explicitly Magic-mapped Repeat keys', () => {
	expect([...buildTypingPracticeRepeatGroupIndexes('tell', undefined)]).toEqual([]);
	expect([
		...buildTypingPracticeRepeatGroupIndexes('tell', profile, [repeatKeyMappingId('@')])
	]).toEqual([]);
	const magic = compileLayoutInputProfile(
		{ magicKeys: { mappings: { '@': { l: 'l' } } } },
		{ '@': {} }
	);
	expect([...buildTypingPracticeRepeatGroupIndexes('tell', magic)]).toEqual([]);
});

test('honors Adaptive swaps that take precedence over the Repeat trigger', () => {
	const adaptive = compileLayoutInputProfile(
		{ adaptiveSwaps: { mappings: { l: { '@': 'x' } } } },
		{ '@': {} }
	);
	expect([...buildTypingPracticeRepeatGroupIndexes('tell', adaptive)]).toEqual([]);
	const disabled = [adaptiveRuleMappingId(undefined, adaptive.adaptiveSwaps!.rules[0])];
	expect([...buildTypingPracticeRepeatGroupIndexes('tell', adaptive, disabled)]).toEqual([2, 3]);
});
