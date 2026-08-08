import { describe, expect, test } from 'bun:test';
import {
	advanceTypingPracticeWord,
	buildTypingPracticePrompt,
	createTypingPracticeSession,
	isTypingPracticeWordComplete,
	updateTypingPracticeInput
} from '$lib/typingPractice';

describe('typing practice sessions', () => {
	test('marks matching and mismatching target characters', () => {
		const session = updateTypingPracticeInput(createTypingPracticeSession(['oh', 'seeds']), "o'");
		const [current, next] = buildTypingPracticePrompt(session);

		expect(current).toEqual({
			id: '0:oh',
			word: 'oh',
			current: true,
			characters: [
				{ character: 'o', status: 'correct' },
				{ character: 'h', status: 'incorrect' }
			]
		});
		expect(next.characters.every(({ status }) => status === 'pending')).toBe(true);
	});

	test('keeps untyped characters pending and exposes extra input as incorrect', () => {
		const shortInput = updateTypingPracticeInput(createTypingPracticeSession(['seed']), 'se');
		expect(buildTypingPracticePrompt(shortInput)[0].characters).toEqual([
			{ character: 's', status: 'correct' },
			{ character: 'e', status: 'correct' },
			{ character: 'e', status: 'pending' },
			{ character: 'd', status: 'pending' }
		]);

		const longInput = updateTypingPracticeInput(shortInput, 'seeds');
		expect(buildTypingPracticePrompt(longInput)[0].characters.at(-1)).toEqual({
			character: 's',
			status: 'incorrect'
		});
	});

	test('advances only an exactly completed word and clears the next input', () => {
		const initial = createTypingPracticeSession([' assurance ', '', 'snapshot']);
		const incomplete = updateTypingPracticeInput(initial, 'assuranc');
		expect(isTypingPracticeWordComplete(incomplete)).toBe(false);
		expect(advanceTypingPracticeWord(incomplete)).toBe(incomplete);

		const completed = updateTypingPracticeInput(initial, 'assurance');
		expect(isTypingPracticeWordComplete(completed)).toBe(true);
		expect(advanceTypingPracticeWord(completed)).toEqual({
			remainingWords: [{ id: '2:snapshot', text: 'snapshot' }],
			input: '',
			completedWordCount: 1,
			totalWordCount: 2
		});
	});
});
