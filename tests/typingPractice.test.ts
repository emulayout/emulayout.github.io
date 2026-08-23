import { describe, expect, test } from 'bun:test';
import {
	advanceTypingPracticeWord,
	buildTypingPracticePrompt,
	createRandomTypingPracticeSession,
	createTypingPracticeSession,
	createTypingPracticeSessionFromProgress,
	hasTypingPracticeInputError,
	isTypingPracticeWordComplete,
	selectRandomTypingPracticeWords,
	sourceCorrectPrefixLength,
	typingPracticeCursorIndex,
	updateTypingPracticeInput
} from '$lib/typingPractice';

describe('typing practice sessions', () => {
	test('samples a bounded lesson without replacement', () => {
		const words = ['one', 'two', 'three', 'four'];
		expect(selectRandomTypingPracticeWords(words, 3, () => 0)).toEqual(['one', 'two', 'three']);
		expect(selectRandomTypingPracticeWords(words, 10, () => 1)).toEqual([
			'four',
			'one',
			'two',
			'three'
		]);
		expect(selectRandomTypingPracticeWords(words, -1, () => 0)).toEqual([]);
		expect(words).toEqual(['one', 'two', 'three', 'four']);
	});

	test('creates a random lesson with the sampled total', () => {
		const session = createRandomTypingPracticeSession(['one', 'two', 'three'], 2, () => 0);
		expect(session.remainingWords.map(({ text }) => text)).toEqual(['one', 'two']);
		expect(session.totalWordCount).toBe(2);
	});

	test('marks matching and mismatching target characters', () => {
		const session = updateTypingPracticeInput(createTypingPracticeSession(['oh', 'seeds']), "o'");
		const [current, next] = buildTypingPracticePrompt(session);

		expect(current).toEqual({
			id: '0:oh',
			word: 'oh',
			current: true,
			completed: false,
			characters: [
				{ character: 'o', status: 'correct' },
				{ character: 'h', status: 'incorrect' }
			]
		});
		expect(next.characters.every(({ status }) => status === 'pending')).toBe(true);
	});

	test('can retain completed words before the active prompt', () => {
		const sourceWords = ['one', 'two', 'three'];
		const session = createTypingPracticeSessionFromProgress(sourceWords, 1, 't');

		expect(buildTypingPracticePrompt(session, sourceWords)).toEqual([
			{
				id: '0:one',
				word: 'one',
				current: false,
				completed: true,
				characters: [
					{ character: 'o', status: 'pending' },
					{ character: 'n', status: 'pending' },
					{ character: 'e', status: 'pending' }
				]
			},
			{
				id: '1:two',
				word: 'two',
				current: true,
				completed: false,
				characters: [
					{ character: 't', status: 'correct' },
					{ character: 'w', status: 'pending' },
					{ character: 'o', status: 'pending' }
				]
			},
			{
				id: '2:three',
				word: 'three',
				current: false,
				completed: false,
				characters: [
					{ character: 't', status: 'pending' },
					{ character: 'h', status: 'pending' },
					{ character: 'r', status: 'pending' },
					{ character: 'e', status: 'pending' },
					{ character: 'e', status: 'pending' }
				]
			}
		]);
	});

	test('detects mismatches and input beyond the active word', () => {
		const initial = createTypingPracticeSession(['seed', 'next']);
		expect(hasTypingPracticeInputError(initial)).toBe(false);
		expect(hasTypingPracticeInputError(updateTypingPracticeInput(initial, 'see'))).toBe(false);
		expect(hasTypingPracticeInputError(updateTypingPracticeInput(initial, 'sead'))).toBe(true);
		expect(hasTypingPracticeInputError(updateTypingPracticeInput(initial, 'seeds'))).toBe(true);
	});

	test('keeps untyped characters pending and omits extra input from the prompt', () => {
		const shortInput = updateTypingPracticeInput(createTypingPracticeSession(['seed']), 'se');
		expect(buildTypingPracticePrompt(shortInput)[0].characters).toEqual([
			{ character: 's', status: 'correct' },
			{ character: 'e', status: 'correct' },
			{ character: 'e', status: 'pending' },
			{ character: 'd', status: 'pending' }
		]);

		const longInput = updateTypingPracticeInput(shortInput, 'seeds');
		expect(buildTypingPracticePrompt(longInput)[0].characters).toEqual([
			{ character: 's', status: 'correct' },
			{ character: 'e', status: 'correct' },
			{ character: 'e', status: 'correct' },
			{ character: 'd', status: 'correct' }
		]);
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

	test('completes the test as soon as the final word is typed', () => {
		const initial = createTypingPracticeSession(['finish']);
		const incomplete = updateTypingPracticeInput(initial, 'finis');
		expect(incomplete.completedWordCount).toBe(0);
		expect(incomplete.input).toBe('finis');

		expect(updateTypingPracticeInput(incomplete, 'finish')).toEqual({
			remainingWords: [],
			input: '',
			completedWordCount: 1,
			totalWordCount: 1
		});
	});

	test('restores remaining words and current input from shared progress', () => {
		const session = createTypingPracticeSessionFromProgress(['hello', 'world', 'again'], 1, 'wo');
		expect(session).toEqual({
			remainingWords: [
				{ id: '1:world', text: 'world' },
				{ id: '2:again', text: 'again' }
			],
			input: 'wo',
			completedWordCount: 1,
			totalWordCount: 3
		});
	});

	test('clears input when restored progress has already finished the lesson', () => {
		const session = createTypingPracticeSessionFromProgress(['hello', 'world'], 2, 'leftover');
		expect(session.remainingWords).toEqual([]);
		expect(session.input).toBe('');
		expect(session.completedWordCount).toBe(2);
		expect(session.totalWordCount).toBe(2);
	});

	test('measures the matching source-word prefix', () => {
		expect(sourceCorrectPrefixLength('hello', 'hel')).toBe(3);
		expect(sourceCorrectPrefixLength('hello', 'hex')).toBe(2);
		expect(sourceCorrectPrefixLength('hello', '')).toBe(0);
	});

	test('places the cursor after entered characters regardless of correctness', () => {
		expect(typingPracticeCursorIndex('hello', 'hel')).toBe(3);
		expect(typingPracticeCursorIndex('hello', 'hex')).toBe(3);
		expect(typingPracticeCursorIndex('hello', '')).toBe(0);
		expect(typingPracticeCursorIndex('hello', 'hellooo')).toBe(5);
	});
});
