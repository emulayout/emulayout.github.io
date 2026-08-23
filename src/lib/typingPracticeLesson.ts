import { DEFAULT_TYPING_PRACTICE_WORD_COUNT } from '$lib/typingPracticeText';

export const TYPING_PRACTICE_LESSON_WORD_COUNT = DEFAULT_TYPING_PRACTICE_WORD_COUNT;

export type SharedTypingPracticeLessonSource = {
	customText: string | null;
	specialWordsPercent: number;
	wordCount: number;
	specialCandidateSignature: string;
	unreachableKeysSignature: string;
};

export function sharedTypingPracticeLessonMatches(
	stored: SharedTypingPracticeLessonSource | null,
	hasLesson: boolean,
	customText: string | null,
	specialWordsPercent: number,
	wordCount: number
): boolean {
	if (!stored || !hasLesson) return false;
	if (customText !== null) return stored.customText === customText;
	return (
		stored.customText === null &&
		stored.specialWordsPercent === specialWordsPercent &&
		stored.wordCount === wordCount
	);
}

export function remainingSharedTypingPracticeWords(
	sourceWords: readonly string[],
	completedWordCount: number
): string[] {
	const completed = Math.min(Math.max(Math.floor(completedWordCount), 0), sourceWords.length);
	return sourceWords.slice(completed).filter((word) => word.trim().length > 0);
}

/** Keep leftover words and append extras until the lesson is `count` words. */
export function topUpTypingPracticeLessonWords(
	remainingWords: readonly string[],
	additionalWords: readonly string[],
	count: number = TYPING_PRACTICE_LESSON_WORD_COUNT
): string[] {
	const remaining = remainingWords.filter((word) => word.trim().length > 0);
	if (remaining.length >= count) return remaining.slice(0, count);
	const extras = additionalWords.filter((word) => word.trim().length > 0);
	return [...remaining, ...extras].slice(0, count);
}

export function sharedLessonWordsAfterTabChange(options: {
	hasInProgressWork: boolean;
	sourceWords: readonly string[];
	completedWordCount: number;
	customText: string | null;
	customWords?: readonly string[];
	wordCount?: number;
	selectAdditionalWords: (count: number, excludedWords: readonly string[]) => string[];
}): string[] | null {
	if (!options.hasInProgressWork) return null;
	const remaining = remainingSharedTypingPracticeWords(
		options.sourceWords,
		options.completedWordCount
	);
	if (options.customText !== null) {
		return remaining.length > 0 ? remaining : [...(options.customWords ?? [])];
	}
	const lessonWordCount = options.wordCount ?? TYPING_PRACTICE_LESSON_WORD_COUNT;
	const needed = Math.max(lessonWordCount - remaining.length, 0);
	const additional = needed === 0 ? [] : options.selectAdditionalWords(needed, options.sourceWords);
	return topUpTypingPracticeLessonWords(remaining, additional, lessonWordCount);
}
