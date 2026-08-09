export const TYPING_PRACTICE_TEXT_PARAM = 'text';

export function typingPracticeWordsFromText(value: string | null | undefined): string[] {
	return value?.trim().split(/\s+/u).filter(Boolean) ?? [];
}

export function normalizeTypingPracticeText(value: string | null | undefined): string | null {
	const words = typingPracticeWordsFromText(value);
	return words.length > 0 ? words.join(' ') : null;
}
