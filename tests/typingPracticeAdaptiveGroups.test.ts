import { describe, expect, test } from 'bun:test';
import { adaptiveRuleMappingId } from '$lib/inputMappingControls';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import { buildTypingPracticeAdaptiveGroupIndexes } from '$lib/typingPracticeAdaptiveGroups';

describe('typing-practice Adaptive groups', () => {
	test('marks the trigger and character produced by either side of a swap', () => {
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { n: { "'": 'h' } } }
		});

		expect(Array.from(buildTypingPracticeAdaptiveGroupIndexes("can't", profile))).toEqual([2, 3]);
		expect(Array.from(buildTypingPracticeAdaptiveGroupIndexes('canht', profile))).toEqual([2, 3]);
	});

	test('uses the final output after a matched Adaptive key becomes Magic', () => {
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { a: { x: '*' } } },
			magicKeys: { mappings: { '*': { a: 'z' } } }
		});

		expect(Array.from(buildTypingPracticeAdaptiveGroupIndexes('az', profile))).toEqual([0, 1]);
	});

	test('omits disabled and irrelevant swaps', () => {
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { n: { "'": 'h' } } }
		});
		const rule = profile.adaptiveSwaps!.rules[0];

		expect(
			Array.from(
				buildTypingPracticeAdaptiveGroupIndexes("can't", profile, [
					adaptiveRuleMappingId(undefined, rule)
				])
			)
		).toEqual([]);
		expect(Array.from(buildTypingPracticeAdaptiveGroupIndexes('canto', profile))).toEqual([]);
	});
});
