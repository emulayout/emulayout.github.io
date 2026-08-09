import { describe, expect, test } from 'bun:test';
import { repeatKeyMappingId } from '$lib/inputMappingControls';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import { createTypingPracticeSession, updateTypingPracticeInput } from '$lib/typingPractice';
import {
	isTypingPracticeHomeKeySlot,
	resolveNextTypingPracticeKeys
} from '$lib/typingPracticeKeyboard';

describe('typing practice keyboard guidance', () => {
	test('recognizes only the eight resting home-key positions', () => {
		const highlightedColumns = Array.from({ length: 11 }, (_, column) => column).filter((column) =>
			isTypingPracticeHomeKeySlot(1, column)
		);

		expect(highlightedColumns).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);
		expect(isTypingPracticeHomeKeySlot(0, 3)).toBe(false);
		expect(isTypingPracticeHomeKeySlot(1, 10)).toBe(false);
	});

	test('selects the direct key for the next untyped character', () => {
		const session = updateTypingPracticeInput(createTypingPracticeSession(['seed']), 'se');
		expect(resolveNextTypingPracticeKeys(session, ['s', 'e', 'd'], undefined, 'se')).toEqual(['e']);
	});

	test('selects the physical base key for shifted target characters', () => {
		const uppercase = createTypingPracticeSession(['I?']);
		const punctuation = updateTypingPracticeInput(uppercase, 'I');

		expect(resolveNextTypingPracticeKeys(uppercase, ['i', '/'], undefined, '')).toEqual(['i']);
		expect(resolveNextTypingPracticeKeys(punctuation, ['i', '/'], undefined, 'I')).toEqual(['/']);
	});

	test('stops suggesting keys while the current input has an error or is complete', () => {
		const initial = createTypingPracticeSession(['seed', 'next']);
		const incorrect = updateTypingPracticeInput(initial, 'sx');
		const complete = updateTypingPracticeInput(initial, 'seed');

		expect(resolveNextTypingPracticeKeys(incorrect, ['e'], undefined, 'sx')).toEqual([]);
		expect(resolveNextTypingPracticeKeys(complete, ['e'], undefined, 'seed')).toEqual([]);
	});

	test('selects a key whose contextual output matches the next target', () => {
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { l: { y: 'j' } } }
		});
		const session = createTypingPracticeSession(['jolt']);

		expect(resolveNextTypingPracticeKeys(session, ['j', 'y'], profile, 'l')).toEqual(['y']);
	});

	test('selects both the direct and Repeat keys when either emits the next character', () => {
		const profile = compileLayoutInputProfile({}, { l: {}, '@': {} }, true);
		const session = updateTypingPracticeInput(createTypingPracticeSession(['hello']), 'hel');

		expect(resolveNextTypingPracticeKeys(session, ['l', '@'], profile, 'hel')).toEqual(['l', '@']);
		expect(
			resolveNextTypingPracticeKeys(session, ['l', '@'], profile, 'hel', [repeatKeyMappingId('@')])
		).toEqual(['l']);
	});
});
