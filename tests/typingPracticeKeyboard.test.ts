import { describe, expect, test } from 'bun:test';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import { createTypingPracticeSession, updateTypingPracticeInput } from '$lib/typingPractice';
import {
	isTypingPracticeHomeKeySlot,
	resolveNextTypingPracticeKey
} from '$lib/typingPracticeKeyboard';

describe('typing practice keyboard guidance', () => {
	test('recognizes only the eight resting home-key positions', () => {
		const highlightedColumns = Array.from({ length: 11 }, (_, column) => column).filter((column) =>
			isTypingPracticeHomeKeySlot(1, column)
		);

		expect(highlightedColumns).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);
		expect(isTypingPracticeHomeKeySlot(0, 3)).toBe(false);
	});

	test('selects the direct key for the next untyped character', () => {
		const session = updateTypingPracticeInput(createTypingPracticeSession(['seed']), 'se');
		expect(resolveNextTypingPracticeKey(session, ['s', 'e', 'd'], undefined, 'se')).toBe('e');
	});

	test('stops suggesting keys while the current input has an error or is complete', () => {
		const initial = createTypingPracticeSession(['seed', 'next']);
		const incorrect = updateTypingPracticeInput(initial, 'sx');
		const complete = updateTypingPracticeInput(initial, 'seed');

		expect(resolveNextTypingPracticeKey(incorrect, ['e'], undefined, 'sx')).toBeUndefined();
		expect(resolveNextTypingPracticeKey(complete, ['e'], undefined, 'seed')).toBeUndefined();
	});

	test('selects a key whose contextual output matches the next target', () => {
		const profile = compileLayoutInputProfile({
			adaptiveSwaps: { mappings: { l: { y: 'j' } } }
		});
		const session = createTypingPracticeSession(['jolt']);

		expect(resolveNextTypingPracticeKey(session, ['j', 'y'], profile, 'l')).toBe('y');
	});
});
