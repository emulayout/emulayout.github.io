import { clampTypingPracticeSpecialWordsPercent } from '$lib/typingPracticeSpecialWords';

export const TYPING_PRACTICE_TEXT_PARAM = 'text';
export const TYPING_PRACTICE_SPECIAL_WORDS_PARAM = 'special';
export const TYPING_PRACTICE_WORD_COUNT_PARAM = 'words';
export const TYPING_PRACTICE_LESSON_SETTINGS_STORAGE_KEY = 'typingPracticeLessonSettings';

export const TYPING_PRACTICE_WORD_COUNTS = [10, 25, 50] as const;
export type TypingPracticeWordCount = (typeof TYPING_PRACTICE_WORD_COUNTS)[number];
export const DEFAULT_TYPING_PRACTICE_WORD_COUNT: TypingPracticeWordCount = 10;

const TYPING_PRACTICE_LESSON_SETTINGS_VERSION = 1;

/**
 * Lesson source settings. Custom text takes precedence; otherwise random
 * words are drawn with the requested share of special-key (Magic/Adaptive)
 * words, where 100 means only such words and 0 means an ordinary lesson.
 */
export interface TypingPracticeLessonSettings {
	customText: string | null;
	specialWordsPercent: number;
	wordCount: TypingPracticeWordCount;
}

/** URL fields that were actually present. Absent keys fall back to stored prefs. */
export interface TypingPracticeLessonUrlOverrides {
	customText?: string | null;
	specialWordsPercent?: number;
	wordCount?: TypingPracticeWordCount;
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

export function parseTypingPracticeWordCount(
	value: string | null | undefined
): TypingPracticeWordCount | null {
	if (!value) return null;
	const parsed = Number(value);
	return TYPING_PRACTICE_WORD_COUNTS.find((count) => count === parsed) ?? null;
}

export function createDefaultTypingPracticeLessonSettings(): TypingPracticeLessonSettings {
	return {
		customText: null,
		specialWordsPercent: 0,
		wordCount: DEFAULT_TYPING_PRACTICE_WORD_COUNT
	};
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
			: clampTypingPracticeSpecialWordsPercent(settings?.specialWordsPercent ?? 0),
		wordCount:
			parseTypingPracticeWordCount(String(settings?.wordCount ?? '')) ??
			DEFAULT_TYPING_PRACTICE_WORD_COUNT
	};
}

export function isDefaultTypingPracticeLessonSettings(
	settings: TypingPracticeLessonSettings
): boolean {
	return (
		settings.customText === null &&
		settings.specialWordsPercent === 0 &&
		settings.wordCount === DEFAULT_TYPING_PRACTICE_WORD_COUNT
	);
}

export function typingPracticeLessonOverridesFromSearchParams(
	searchParams: URLSearchParams
): TypingPracticeLessonUrlOverrides {
	const overrides: TypingPracticeLessonUrlOverrides = {};
	if (searchParams.has(TYPING_PRACTICE_TEXT_PARAM)) {
		overrides.customText = normalizeTypingPracticeText(
			searchParams.get(TYPING_PRACTICE_TEXT_PARAM)
		);
	}
	if (searchParams.has(TYPING_PRACTICE_SPECIAL_WORDS_PARAM)) {
		overrides.specialWordsPercent = parseTypingPracticeSpecialWordsPercent(
			searchParams.get(TYPING_PRACTICE_SPECIAL_WORDS_PARAM)
		);
	}
	if (searchParams.has(TYPING_PRACTICE_WORD_COUNT_PARAM)) {
		const wordCount = parseTypingPracticeWordCount(
			searchParams.get(TYPING_PRACTICE_WORD_COUNT_PARAM)
		);
		if (wordCount !== null) overrides.wordCount = wordCount;
	}
	return overrides;
}

export function hasTypingPracticeLessonUrlOverrides(
	overrides: TypingPracticeLessonUrlOverrides
): boolean {
	return (
		overrides.customText !== undefined ||
		overrides.specialWordsPercent !== undefined ||
		overrides.wordCount !== undefined
	);
}

/** Every menu-saved value is explicit in the resulting URL, including defaults. */
export function typingPracticeLessonOverridesForSettings(
	settings: Partial<TypingPracticeLessonSettings> | null | undefined
): TypingPracticeLessonUrlOverrides {
	const lesson = normalizeTypingPracticeLessonSettings(settings);
	if (lesson.customText) return { customText: lesson.customText };
	return {
		specialWordsPercent: lesson.specialWordsPercent,
		wordCount: lesson.wordCount
	};
}

/**
 * URL params overlay stored prefs. A random-lesson URL option (`special` or
 * `words` without `text`) is a temporary random lesson and ignores stored
 * custom text. `text` still wins over `special` when both are present.
 */
export function resolveTypingPracticeLessonSettings(
	stored: Partial<TypingPracticeLessonSettings> | null | undefined,
	overrides: TypingPracticeLessonUrlOverrides = {}
): TypingPracticeLessonSettings {
	const persisted = normalizeTypingPracticeLessonSettings(stored);
	if (overrides.customText !== undefined) {
		return normalizeTypingPracticeLessonSettings({
			customText: overrides.customText,
			wordCount: overrides.wordCount ?? persisted.wordCount
		});
	}
	if (overrides.specialWordsPercent !== undefined || overrides.wordCount !== undefined) {
		return normalizeTypingPracticeLessonSettings({
			customText: null,
			specialWordsPercent: overrides.specialWordsPercent ?? persisted.specialWordsPercent,
			wordCount: overrides.wordCount ?? persisted.wordCount
		});
	}
	return persisted;
}

export function typingPracticeLessonFromSearchParams(
	searchParams: URLSearchParams
): TypingPracticeLessonSettings {
	return resolveTypingPracticeLessonSettings(
		createDefaultTypingPracticeLessonSettings(),
		typingPracticeLessonOverridesFromSearchParams(searchParams)
	);
}

/** Write shareable `text` / `special` / `words` params. Defaults are omitted. */
export function writeTypingPracticeLessonParams(
	params: URLSearchParams,
	settings?: Partial<TypingPracticeLessonSettings> | null
): void {
	const lesson = normalizeTypingPracticeLessonSettings(settings);
	if (lesson.customText) {
		params.set(TYPING_PRACTICE_TEXT_PARAM, lesson.customText);
		return;
	}
	if (lesson.specialWordsPercent > 0) {
		params.set(TYPING_PRACTICE_SPECIAL_WORDS_PARAM, String(lesson.specialWordsPercent));
	}
	if (lesson.wordCount !== DEFAULT_TYPING_PRACTICE_WORD_COUNT) {
		params.set(TYPING_PRACTICE_WORD_COUNT_PARAM, String(lesson.wordCount));
	}
}

/** Write only explicitly present URL fields, preserving valid default-valued overlays. */
export function writeTypingPracticeLessonOverrideParams(
	params: URLSearchParams,
	overrides: TypingPracticeLessonUrlOverrides
): void {
	params.delete(TYPING_PRACTICE_TEXT_PARAM);
	params.delete(TYPING_PRACTICE_SPECIAL_WORDS_PARAM);
	params.delete(TYPING_PRACTICE_WORD_COUNT_PARAM);

	if (overrides.customText !== undefined) {
		params.set(TYPING_PRACTICE_TEXT_PARAM, overrides.customText ?? '');
		if (overrides.wordCount !== undefined) {
			params.set(TYPING_PRACTICE_WORD_COUNT_PARAM, String(overrides.wordCount));
		}
		return;
	}
	if (overrides.specialWordsPercent !== undefined) {
		params.set(
			TYPING_PRACTICE_SPECIAL_WORDS_PARAM,
			String(clampTypingPracticeSpecialWordsPercent(overrides.specialWordsPercent))
		);
	}
	if (overrides.wordCount !== undefined) {
		params.set(TYPING_PRACTICE_WORD_COUNT_PARAM, String(overrides.wordCount));
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseTypingPracticeLessonSettings(
	storedValue: string | null
): TypingPracticeLessonSettings {
	if (storedValue === null) return createDefaultTypingPracticeLessonSettings();
	try {
		const document: unknown = JSON.parse(storedValue);
		if (!isRecord(document) || document.version !== TYPING_PRACTICE_LESSON_SETTINGS_VERSION) {
			return createDefaultTypingPracticeLessonSettings();
		}
		return normalizeTypingPracticeLessonSettings(
			isRecord(document.settings) ? document.settings : null
		);
	} catch {
		return createDefaultTypingPracticeLessonSettings();
	}
}

export function serializeTypingPracticeLessonSettings(
	settings: TypingPracticeLessonSettings
): string {
	return JSON.stringify({
		version: TYPING_PRACTICE_LESSON_SETTINGS_VERSION,
		settings: normalizeTypingPracticeLessonSettings(settings)
	});
}

export function readStoredTypingPracticeLessonSettings(): TypingPracticeLessonSettings {
	if (typeof localStorage === 'undefined') {
		return createDefaultTypingPracticeLessonSettings();
	}
	try {
		return parseTypingPracticeLessonSettings(
			localStorage.getItem(TYPING_PRACTICE_LESSON_SETTINGS_STORAGE_KEY)
		);
	} catch {
		return createDefaultTypingPracticeLessonSettings();
	}
}
