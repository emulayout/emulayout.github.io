import { describe, expect, test } from 'bun:test';
import {
	normalizeTypingPracticeLessonSettings,
	normalizeTypingPracticeText,
	parseTypingPracticeSpecialWordsPercent,
	typingPracticeWordsFromText
} from '$lib/typingPracticeText';

describe('typing practice custom text', () => {
	test('normalizes whitespace while preserving word order and duplicates', () => {
		expect(normalizeTypingPracticeText('  hello\nhello\tworld  ')).toBe('hello hello world');
		expect(typingPracticeWordsFromText('  hello\nhello\tworld  ')).toEqual([
			'hello',
			'hello',
			'world'
		]);
	});

	test('treats absent and whitespace-only text as no custom lesson', () => {
		expect(normalizeTypingPracticeText(null)).toBeNull();
		expect(normalizeTypingPracticeText(' \n\t ')).toBeNull();
		expect(typingPracticeWordsFromText(undefined)).toEqual([]);
	});
});

describe('typing practice lesson settings', () => {
	test('parses the special-word balance as a clamped whole percent', () => {
		expect(parseTypingPracticeSpecialWordsPercent(null)).toBe(0);
		expect(parseTypingPracticeSpecialWordsPercent('')).toBe(0);
		expect(parseTypingPracticeSpecialWordsPercent('40')).toBe(40);
		expect(parseTypingPracticeSpecialWordsPercent('40.6')).toBe(41);
		expect(parseTypingPracticeSpecialWordsPercent('250')).toBe(100);
		expect(parseTypingPracticeSpecialWordsPercent('-3')).toBe(0);
		expect(parseTypingPracticeSpecialWordsPercent('nope')).toBe(0);
	});

	test('normalizes lesson settings so custom text excludes a balance', () => {
		expect(normalizeTypingPracticeLessonSettings(null)).toEqual({
			customText: null,
			specialWordsPercent: 0
		});
		expect(
			normalizeTypingPracticeLessonSettings({ customText: ' luck ', specialWordsPercent: 70 })
		).toEqual({ customText: 'luck', specialWordsPercent: 0 });
		expect(normalizeTypingPracticeLessonSettings({ specialWordsPercent: 70 })).toEqual({
			customText: null,
			specialWordsPercent: 70
		});
	});
});
