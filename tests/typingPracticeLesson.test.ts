import { describe, expect, test } from 'bun:test';
import {
	sharedLessonWordsAfterTabChange,
	sharedTypingPracticeLessonMatches,
	topUpTypingPracticeLessonWords
} from '$lib/typingPracticeLesson';

describe('shared typing-practice lesson matching', () => {
	const randomSource = {
		customText: null,
		specialWordsPercent: 25,
		specialCandidateSignature: 'alpha',
		unreachableKeysSignature: 'keys'
	};

	test('keeps an existing random lesson with the same special-word balance', () => {
		expect(sharedTypingPracticeLessonMatches(randomSource, true, null, 25)).toBe(true);
		expect(sharedTypingPracticeLessonMatches(randomSource, true, null, 50)).toBe(false);
	});

	test('keeps an existing custom lesson only when the text matches', () => {
		const customSource = { ...randomSource, customText: 'hello world' };
		expect(sharedTypingPracticeLessonMatches(customSource, true, 'hello world', 0)).toBe(true);
		expect(sharedTypingPracticeLessonMatches(customSource, true, 'other text', 0)).toBe(false);
		expect(sharedTypingPracticeLessonMatches(customSource, true, null, 0)).toBe(false);
	});

	test('does not match before a lesson exists', () => {
		expect(sharedTypingPracticeLessonMatches(null, false, null, 0)).toBe(false);
		expect(sharedTypingPracticeLessonMatches(randomSource, false, null, 25)).toBe(false);
	});
});

describe('shared typing-practice lesson tab change', () => {
	test('keeps leftover words and appends extras to refill a ten-word lesson', () => {
		expect(topUpTypingPracticeLessonWords(['four', 'five'], ['six', 'seven', 'eight'], 5)).toEqual([
			'four',
			'five',
			'six',
			'seven',
			'eight'
		]);
	});

	test('leaves an untouched lesson unchanged', () => {
		expect(
			sharedLessonWordsAfterTabChange({
				hasInProgressWork: false,
				sourceWords: ['one', 'two'],
				completedWordCount: 0,
				customText: null,
				selectAdditionalWords: () => ['new']
			})
		).toBeNull();
	});

	test('does not sample extras when ten leftover words already remain', () => {
		const leftover = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
		expect(
			sharedLessonWordsAfterTabChange({
				hasInProgressWork: true,
				sourceWords: leftover,
				completedWordCount: 0,
				customText: null,
				selectAdditionalWords: () => {
					throw new Error('should not sample additional words');
				}
			})
		).toEqual(leftover);
	});

	test('refills a random lesson from remaining words after progress', () => {
		expect(
			sharedLessonWordsAfterTabChange({
				hasInProgressWork: true,
				sourceWords: ['one', 'two', 'three', 'four', 'five'],
				completedWordCount: 3,
				customText: null,
				selectAdditionalWords: (count, excluded) => {
					expect(count).toBe(8);
					expect(excluded).toEqual(['one', 'two', 'three', 'four', 'five']);
					return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
				}
			})
		).toEqual(['four', 'five', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
	});

	test('keeps leftover custom words and restores the full custom lesson when none remain', () => {
		expect(
			sharedLessonWordsAfterTabChange({
				hasInProgressWork: true,
				sourceWords: ['hello', 'world'],
				completedWordCount: 1,
				customText: 'hello world',
				customWords: ['hello', 'world'],
				selectAdditionalWords: () => ['nope']
			})
		).toEqual(['world']);
		expect(
			sharedLessonWordsAfterTabChange({
				hasInProgressWork: true,
				sourceWords: ['hello', 'world'],
				completedWordCount: 2,
				customText: 'hello world',
				customWords: ['hello', 'world'],
				selectAdditionalWords: () => ['nope']
			})
		).toEqual(['hello', 'world']);
	});
});
