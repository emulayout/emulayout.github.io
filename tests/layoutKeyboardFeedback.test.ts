import { describe, expect, test } from 'bun:test';
import { adaptiveRuleMappingId } from '$lib/inputMappingControls';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import {
	buildAdaptiveKeyboardFeedback,
	buildLayoutKeyboardFeedback,
	buildMagicKeyboardFeedback
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
	});

	test('omits disabled Adaptive swaps', () => {
		const rule = adaptiveProfile.adaptiveSwaps!.rules[0];
		const mappingId = adaptiveRuleMappingId(undefined, rule);

		expect(buildAdaptiveKeyboardFeedback(adaptiveProfile.adaptiveSwaps, 'l', [mappingId])).toEqual(
			new Map()
		);
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
