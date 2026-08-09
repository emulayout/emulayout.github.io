import { describe, expect, test } from 'bun:test';
import { magicFallbackMappingId, magicRuleMappingId } from '$lib/inputMappingControls';
import { compileMagicKeyMappings } from '$lib/magicKeys';
import { buildTypingPracticeMagicGroupIndexes } from '$lib/typingPracticeMagicGroups';

describe('typing-practice Magic groups', () => {
	test('marks the rule context and emitted characters inside a word', () => {
		const profile = compileMagicKeyMappings({ '*': { e: 'x', th: 'e' } });

		expect(Array.from(buildTypingPracticeMagicGroupIndexes('explode', profile))).toEqual([0, 1]);
		expect(Array.from(buildTypingPracticeMagicGroupIndexes('theme', profile))).toEqual([0, 1, 2]);
	});

	test('marks doubled letters only when repeat-last wins rule precedence', () => {
		const profile = compileMagicKeyMappings({
			'*': { rules: { w: 'h' }, fallback: 'repeat-last' }
		});

		expect(Array.from(buildTypingPracticeMagicGroupIndexes('will', profile))).toEqual([2, 3]);
		expect(Array.from(buildTypingPracticeMagicGroupIndexes('ww', profile))).toEqual([]);
	});

	test('omits disabled rules and fallbacks', () => {
		const profile = compileMagicKeyMappings({
			'*': { rules: { e: 'x' }, fallback: 'repeat-last' }
		});

		expect(
			Array.from(
				buildTypingPracticeMagicGroupIndexes('explode', profile, [magicRuleMappingId('*', 'e')])
			)
		).toEqual([]);
		expect(
			Array.from(
				buildTypingPracticeMagicGroupIndexes('will', profile, [magicFallbackMappingId('*')])
			)
		).toEqual([]);
	});

	test('marks characters produced by a fixed emitting fallback', () => {
		const profile = compileMagicKeyMappings({
			'*': { rules: {}, fallback: { emit: 'y' } }
		});

		expect(Array.from(buildTypingPracticeMagicGroupIndexes('my', profile))).toEqual([1]);
	});
});
