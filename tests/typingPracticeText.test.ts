import { describe, expect, test } from 'bun:test';
import {
	normalizeTypingPracticeLessonSettings,
	normalizeTypingPracticeText,
	parseTypingPracticeSpecialWordsPercent,
	typingPracticeLessonFromSearchParams,
	typingPracticeWordsFromText,
	writeTypingPracticeLessonParams
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

	test('reads and writes shareable lesson query params', () => {
		const fromText = typingPracticeLessonFromSearchParams(
			new URLSearchParams('text=hello+world&special=40')
		);
		expect(fromText).toEqual({ customText: 'hello world', specialWordsPercent: 0 });

		const fromSpecial = typingPracticeLessonFromSearchParams(new URLSearchParams('special=40'));
		expect(fromSpecial).toEqual({ customText: null, specialWordsPercent: 40 });

		const params = new URLSearchParams();
		writeTypingPracticeLessonParams(params, { customText: null, specialWordsPercent: 0 });
		expect(params.toString()).toBe('');
		writeTypingPracticeLessonParams(params, { customText: 'hello world', specialWordsPercent: 40 });
		expect(params.get('text')).toBe('hello world');
		expect(params.has('special')).toBe(false);
	});
});
