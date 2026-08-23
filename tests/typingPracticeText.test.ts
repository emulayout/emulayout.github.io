import { describe, expect, test } from 'bun:test';
import {
	createDefaultTypingPracticeLessonSettings,
	hasTypingPracticeLessonUrlOverrides,
	isDefaultTypingPracticeLessonSettings,
	normalizeTypingPracticeLessonSettings,
	normalizeTypingPracticeText,
	parseTypingPracticeLessonSettings,
	parseTypingPracticeSpecialWordsPercent,
	parseTypingPracticeWordCount,
	resolveTypingPracticeLessonSettings,
	serializeTypingPracticeLessonSettings,
	typingPracticeLessonFromSearchParams,
	typingPracticeLessonOverridesForSettings,
	typingPracticeLessonOverridesFromSearchParams,
	typingPracticeWordsFromText,
	writeTypingPracticeLessonOverrideParams,
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

	test('parses only the allowed lesson word counts', () => {
		expect(parseTypingPracticeWordCount(null)).toBeNull();
		expect(parseTypingPracticeWordCount('')).toBeNull();
		expect(parseTypingPracticeWordCount('10')).toBe(10);
		expect(parseTypingPracticeWordCount('25')).toBe(25);
		expect(parseTypingPracticeWordCount('50')).toBe(50);
		expect(parseTypingPracticeWordCount('20')).toBeNull();
		expect(parseTypingPracticeWordCount('15')).toBeNull();
		expect(parseTypingPracticeWordCount('nope')).toBeNull();
	});

	test('normalizes lesson settings so custom text excludes a balance', () => {
		expect(normalizeTypingPracticeLessonSettings(null)).toEqual({
			customText: null,
			specialWordsPercent: 0,
			wordCount: 10
		});
		expect(
			normalizeTypingPracticeLessonSettings({ customText: ' luck ', specialWordsPercent: 70 })
		).toEqual({ customText: 'luck', specialWordsPercent: 0, wordCount: 10 });
		expect(normalizeTypingPracticeLessonSettings({ specialWordsPercent: 70 })).toEqual({
			customText: null,
			specialWordsPercent: 70,
			wordCount: 10
		});
		expect(normalizeTypingPracticeLessonSettings({ wordCount: 25 })).toEqual({
			customText: null,
			specialWordsPercent: 0,
			wordCount: 25
		});
	});

	test('reads and writes shareable lesson query params', () => {
		const fromText = typingPracticeLessonFromSearchParams(
			new URLSearchParams('text=hello+world&special=40')
		);
		expect(fromText).toEqual({ customText: 'hello world', specialWordsPercent: 0, wordCount: 10 });

		const fromSpecial = typingPracticeLessonFromSearchParams(new URLSearchParams('special=40'));
		expect(fromSpecial).toEqual({ customText: null, specialWordsPercent: 40, wordCount: 10 });

		const fromWords = typingPracticeLessonFromSearchParams(
			new URLSearchParams('words=25&special=40')
		);
		expect(fromWords).toEqual({ customText: null, specialWordsPercent: 40, wordCount: 25 });

		const params = new URLSearchParams();
		writeTypingPracticeLessonParams(params, { customText: null, specialWordsPercent: 0 });
		expect(params.toString()).toBe('');
		writeTypingPracticeLessonParams(params, { customText: 'hello world', specialWordsPercent: 40 });
		expect(params.get('text')).toBe('hello world');
		expect(params.has('special')).toBe(false);
		expect(params.has('words')).toBe(false);

		const wordParams = new URLSearchParams();
		writeTypingPracticeLessonParams(wordParams, { wordCount: 50, specialWordsPercent: 40 });
		expect(wordParams.get('special')).toBe('40');
		expect(wordParams.get('words')).toBe('50');
	});

	test('treats only present query fields as URL overrides', () => {
		expect(typingPracticeLessonOverridesFromSearchParams(new URLSearchParams())).toEqual({});
		expect(hasTypingPracticeLessonUrlOverrides({})).toBe(false);
		expect(typingPracticeLessonOverridesFromSearchParams(new URLSearchParams('words=25'))).toEqual({
			wordCount: 25
		});
		expect(
			hasTypingPracticeLessonUrlOverrides(
				typingPracticeLessonOverridesFromSearchParams(new URLSearchParams('special=40'))
			)
		).toBe(true);
		expect(typingPracticeLessonOverridesFromSearchParams(new URLSearchParams('words=15'))).toEqual(
			{}
		);
	});

	test('preserves explicit default values in URL overrides', () => {
		const explicitDefaults = typingPracticeLessonOverridesForSettings({
			customText: null,
			specialWordsPercent: 0,
			wordCount: 10
		});
		expect(explicitDefaults).toEqual({ specialWordsPercent: 0, wordCount: 10 });

		const params = new URLSearchParams('text=old&special=40&words=50');
		writeTypingPracticeLessonOverrideParams(params, explicitDefaults);
		expect(params.toString()).toBe('special=0&words=10');
		expect(typingPracticeLessonOverridesFromSearchParams(params)).toEqual(explicitDefaults);

		const customParams = new URLSearchParams('special=40&words=50');
		writeTypingPracticeLessonOverrideParams(
			customParams,
			typingPracticeLessonOverridesForSettings({ customText: ' hello  world ' })
		);
		expect(customParams.toString()).toBe('text=hello+world');
	});

	test('resolves stored prefs under temporary URL overlays', () => {
		const storedCustom = normalizeTypingPracticeLessonSettings({
			customText: 'stored text',
			wordCount: 25
		});
		const storedRandom = normalizeTypingPracticeLessonSettings({
			specialWordsPercent: 40,
			wordCount: 25
		});
		expect(resolveTypingPracticeLessonSettings(storedCustom)).toEqual(storedCustom);
		expect(
			resolveTypingPracticeLessonSettings(storedCustom, { customText: 'hello world' })
		).toEqual({
			customText: 'hello world',
			specialWordsPercent: 0,
			wordCount: 25
		});
		expect(resolveTypingPracticeLessonSettings(storedCustom, { wordCount: 50 })).toEqual({
			customText: null,
			specialWordsPercent: 0,
			wordCount: 50
		});
		expect(resolveTypingPracticeLessonSettings(storedRandom, { wordCount: 50 })).toEqual({
			customText: null,
			specialWordsPercent: 40,
			wordCount: 50
		});
		expect(resolveTypingPracticeLessonSettings(storedCustom, { specialWordsPercent: 100 })).toEqual(
			{
				customText: null,
				specialWordsPercent: 100,
				wordCount: 25
			}
		);
	});

	test('round-trips persisted lesson settings and rejects unknown documents', () => {
		const settings = normalizeTypingPracticeLessonSettings({
			customText: 'hello world',
			wordCount: 25
		});
		expect(
			parseTypingPracticeLessonSettings(serializeTypingPracticeLessonSettings(settings))
		).toEqual(settings);
		expect(parseTypingPracticeLessonSettings(null)).toEqual(
			createDefaultTypingPracticeLessonSettings()
		);
		expect(parseTypingPracticeLessonSettings('{')).toEqual(
			createDefaultTypingPracticeLessonSettings()
		);
		expect(parseTypingPracticeLessonSettings('{"version":2,"settings":{}}')).toEqual(
			createDefaultTypingPracticeLessonSettings()
		);
		expect(isDefaultTypingPracticeLessonSettings(createDefaultTypingPracticeLessonSettings())).toBe(
			true
		);
		expect(isDefaultTypingPracticeLessonSettings(settings)).toBe(false);
	});
});
