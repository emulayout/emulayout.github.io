import { describe, expect, test } from 'bun:test';
import {
	calculateTypingPracticeResults,
	countTypingPracticeInputAttempts,
	countTypingPracticeTestCharacters,
	formatTypingPracticeElapsed
} from '$lib/typingPracticeMetrics';

describe('typing practice metrics', () => {
	test('counts inserted characters against their target positions', () => {
		expect(countTypingPracticeInputAttempts('', 'seed', 'seeds')).toEqual({
			correct: 4,
			incorrect: 0
		});
		expect(countTypingPracticeInputAttempts('se', "se'd", 'seed')).toEqual({
			correct: 1,
			incorrect: 1
		});
	});

	test('does not count deletions as character attempts', () => {
		expect(countTypingPracticeInputAttempts('seex', 'see', 'seed')).toEqual({
			correct: 0,
			incorrect: 0
		});
	});

	test('counts lesson characters with one separator between words', () => {
		expect(countTypingPracticeTestCharacters(['one', 'two', 'three'])).toBe(13);
		expect(countTypingPracticeTestCharacters([])).toBe(0);
	});

	test('calculates accuracy and standard five-character WPM', () => {
		expect(calculateTypingPracticeResults({ correct: 40, incorrect: 6 }, 40, 120_000)).toEqual({
			accuracyPercent: 86.95652173913044,
			wordsPerMinute: 4
		});
		expect(calculateTypingPracticeResults({ correct: 0, incorrect: 0 }, 40, 0)).toEqual({
			accuracyPercent: 0,
			wordsPerMinute: 0
		});
	});

	test('formats elapsed time as minutes and seconds', () => {
		expect(formatTypingPracticeElapsed(0)).toBe('00:00');
		expect(formatTypingPracticeElapsed(69_999)).toBe('01:09');
	});
});
