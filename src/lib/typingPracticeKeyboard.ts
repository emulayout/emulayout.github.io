import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
import { resolveLayoutInput } from '$lib/layoutInputBehaviors';
import { hasTypingPracticeInputError, type TypingPracticeSession } from '$lib/typingPractice';
import { isHomeKeySlot, shiftedKeyCharacter } from '$lib/cmini/keyboard';

export function isTypingPracticeHomeKeySlot(row: number, column: number): boolean {
	return isHomeKeySlot(row, column);
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
	const inputValuesByKey = new Map(
		availableKeys.map((key) => [
			key,
			Array.from(
				new Set(
					[key, shiftedKeyCharacter(key)].filter(
						(inputValue): inputValue is string => inputValue !== undefined
					)
				)
			)
		])
	);
	const directKey = availableKeys.find((key) => inputValuesByKey.get(key)?.includes(nextCharacter));
	const candidates = directKey
		? [directKey, ...availableKeys.filter((key) => key !== directKey)]
		: availableKeys;

	return candidates.filter((key) => {
		return inputValuesByKey.get(key)?.some((inputValue) => {
			const result = resolveLayoutInput(inputProfile, inputHistory, inputValue, disabledMappings);
			return result.text.length > 0 && remainingTarget.startsWith(result.text);
		});
	});
}
