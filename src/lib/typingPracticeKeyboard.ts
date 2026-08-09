import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
import { resolveLayoutInput } from '$lib/layoutInputBehaviors';
import { hasTypingPracticeInputError, type TypingPracticeSession } from '$lib/typingPractice';

const HOME_ROW = 1;
const LEFT_HOME_KEY_COLUMNS = { start: 0, end: 3 } as const;
const RIGHT_HOME_KEY_COLUMNS = { start: 6, end: 9 } as const;

export function isTypingPracticeHomeKeySlot(row: number, column: number): boolean {
	if (row !== HOME_ROW) return false;
	return (
		(column >= LEFT_HOME_KEY_COLUMNS.start && column <= LEFT_HOME_KEY_COLUMNS.end) ||
		(column >= RIGHT_HOME_KEY_COLUMNS.start && column <= RIGHT_HOME_KEY_COLUMNS.end)
	);
}

export function resolveNextTypingPracticeKeys(
	session: TypingPracticeSession,
	availableKeys: readonly string[],
	inputProfile: LayoutInputProfile | undefined,
	inputHistory: string,
	disabledMappingIds: readonly string[] = []
): string[] {
	const activeWord = session.remainingWords[0];
	if (!activeWord || hasTypingPracticeInputError(session)) return [];

	const inputLength = Array.from(session.input).length;
	const remainingTarget = Array.from(activeWord.text).slice(inputLength).join('');
	if (!remainingTarget) return [];

	const disabledMappings = new Set(disabledMappingIds);
	const nextCharacter = Array.from(remainingTarget)[0];
	const directKey = availableKeys.find((key) => key === nextCharacter);
	const candidates = directKey
		? [directKey, ...availableKeys.filter((key) => key !== directKey)]
		: availableKeys;

	return candidates.filter((key) => {
		const result = resolveLayoutInput(inputProfile, inputHistory, key, disabledMappings);
		return result.text.length > 0 && remainingTarget.startsWith(result.text);
	});
}
