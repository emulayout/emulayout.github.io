import { describe, expect, test } from 'bun:test';
import { normalizeTypingPracticeText, typingPracticeWordsFromText } from '$lib/typingPracticeText';

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
