import { clampTypingPracticeSpecialWordsPercent } from '$lib/typingPracticeSpecialWords';

export const TYPING_PRACTICE_TEXT_PARAM = 'text';
export const TYPING_PRACTICE_SPECIAL_WORDS_PARAM = 'special';

/**
 * URL-backed lesson source. Custom text takes precedence; otherwise random
 * words are drawn with the requested share of special-key (Magic/Adaptive)
 * words, where 100 means only such words and 0 means an ordinary lesson.
 */
export interface TypingPracticeLessonSettings {
	customText: string | null;
	specialWordsPercent: number;
}

export function typingPracticeWordsFromText(value: string | null | undefined): string[] {
	return value?.trim().split(/\s+/u).filter(Boolean) ?? [];
}

export function normalizeTypingPracticeText(value: string | null | undefined): string | null {
	const words = typingPracticeWordsFromText(value);
	return words.length > 0 ? words.join(' ') : null;
}

export function parseTypingPracticeSpecialWordsPercent(value: string | null | undefined): number {
	if (!value) return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? clampTypingPracticeSpecialWordsPercent(parsed) : 0;
}

export function normalizeTypingPracticeLessonSettings(
	settings: Partial<TypingPracticeLessonSettings> | null | undefined
): TypingPracticeLessonSettings {
	const customText = normalizeTypingPracticeText(settings?.customText);
	return {
		customText,
		// Custom text replaces the random word source, so a balance never
		// coexists with it in canonical state.
		specialWordsPercent: customText
			? 0
			: clampTypingPracticeSpecialWordsPercent(settings?.specialWordsPercent ?? 0)
	};
}

export function typingPracticeLessonFromSearchParams(
	searchParams: URLSearchParams
): TypingPracticeLessonSettings {
	return normalizeTypingPracticeLessonSettings({
		customText: searchParams.get(TYPING_PRACTICE_TEXT_PARAM),
		specialWordsPercent: parseTypingPracticeSpecialWordsPercent(
			searchParams.get(TYPING_PRACTICE_SPECIAL_WORDS_PARAM)
		)
	});
}

/** Write shareable `text` / `special` params. Defaults are omitted. */
export function writeTypingPracticeLessonParams(
	params: URLSearchParams,
	settings?: Partial<TypingPracticeLessonSettings> | null
): void {
	const lesson = normalizeTypingPracticeLessonSettings(settings);
	if (lesson.customText) {
		params.set(TYPING_PRACTICE_TEXT_PARAM, lesson.customText);
	} else if (lesson.specialWordsPercent > 0) {
		params.set(TYPING_PRACTICE_SPECIAL_WORDS_PARAM, String(lesson.specialWordsPercent));
	}
}
