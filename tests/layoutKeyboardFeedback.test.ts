import { describe, expect, test } from 'bun:test';
import { adaptiveRuleMappingId } from '$lib/inputMappingControls';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import {
	buildAdaptiveKeyboardFeedback,
	buildAdaptiveKeyboardSwapPaths,
	buildAdaptiveKeyboardSwapPathsFromFeedback,
	buildLayoutKeyboardFeedback,
	buildMagicKeyboardFeedback,
	filterAdaptiveKeyboardFeedbackByKeys
} from '$lib/layoutKeyboardFeedback';

describe('layout keyboard feedback', () => {
	const adaptiveProfile = compileLayoutInputProfile({
		adaptiveSwaps: { mappings: { l: { y: 'j' } } }
	});

	test('shows both directions of every armed Adaptive swap', () => {
		const feedback = buildAdaptiveKeyboardFeedback(adaptiveProfile.adaptiveSwaps, 'l');

		expect(feedback.get('y')).toEqual({ kind: 'adaptive', value: 'j', active: true });
		expect(feedback.get('j')).toEqual({ kind: 'adaptive', value: 'y', active: true });
		expect(buildAdaptiveKeyboardFeedback(adaptiveProfile.adaptiveSwaps, '')).toEqual(new Map());
		expect(buildAdaptiveKeyboardFeedback(adaptiveProfile.adaptiveSwaps, 'x')).toEqual(new Map());
		expect(buildAdaptiveKeyboardSwapPaths(adaptiveProfile.adaptiveSwaps, 'l')).toEqual([
			{ from: 'j', to: 'y' }
		]);
		expect(buildAdaptiveKeyboardSwapPaths(adaptiveProfile.adaptiveSwaps, '')).toEqual([]);
	});

	test('omits disabled Adaptive swaps', () => {
		const rule = adaptiveProfile.adaptiveSwaps!.rules[0];
		const mappingId = adaptiveRuleMappingId(undefined, rule);

		expect(buildAdaptiveKeyboardFeedback(adaptiveProfile.adaptiveSwaps, 'l', [mappingId])).toEqual(
			new Map()
		);
		expect(buildAdaptiveKeyboardSwapPaths(adaptiveProfile.adaptiveSwaps, 'l', [mappingId])).toEqual(
			[]
		);
	});

	test('keeps only the armed pair containing a valid next physical key', () => {
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { l: { y: 'j', h: 'k' } } }
		});
		const feedback = buildLayoutKeyboardFeedback({
			adaptiveSwaps: profile.adaptiveSwaps,
			inputHistory: 'l'
		});

		const filtered = filterAdaptiveKeyboardFeedbackByKeys(feedback, ['y']);
		expect(Array.from(filtered.keys())).toEqual(['y', 'j']);
		expect(buildAdaptiveKeyboardSwapPathsFromFeedback(filtered)).toEqual([{ from: 'j', to: 'y' }]);
		expect(filterAdaptiveKeyboardFeedbackByKeys(feedback, [])).toEqual(new Map());
		expect(filterAdaptiveKeyboardFeedbackByKeys(feedback, undefined)).toBe(feedback);
	});

	test('activates a Magic key only when it has a prospective value', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { c: 'k' } } }
		});

		expect(buildMagicKeyboardFeedback(profile.magicKeys, 'c').get('*')).toEqual({
			kind: 'magic',
			value: 'k',
			active: true
		});
		expect(buildMagicKeyboardFeedback(profile.magicKeys, 'x').get('*')).toEqual({
			kind: 'magic'
		});
	});

	test('lets an armed Adaptive swap replace Magic presentation for the physical key', () => {
		const profile = compileLayoutInputProfile({
			magicKeys: { mappings: { '*': { a: 'o' } } },
			adaptiveSwaps: { mappings: { a: { '*': 'y' } } }
		});
		const feedback = buildLayoutKeyboardFeedback({
			magicKeys: profile.magicKeys,
			adaptiveSwaps: profile.adaptiveSwaps,
			inputHistory: 'a'
		});

		expect(feedback.get('*')).toEqual({ kind: 'adaptive', value: 'y', active: true });
		expect(feedback.get('y')).toEqual({ kind: 'adaptive', value: '*', active: true });
	});
});
