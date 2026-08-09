export interface TypingPracticeAttemptCounts {
	correct: number;
	incorrect: number;
}

export interface TypingPracticeResults {
	accuracyPercent: number;
	wordsPerMinute: number;
}

export function countTypingPracticeInputAttempts(
	previousInput: string,
	nextInput: string,
	targetWord: string
): TypingPracticeAttemptCounts {
	const previousCharacters = Array.from(previousInput);
	const nextCharacters = Array.from(nextInput);
	const targetCharacters = Array.from(targetWord);
	let prefixLength = 0;

	while (
		prefixLength < previousCharacters.length &&
		prefixLength < nextCharacters.length &&
		previousCharacters[prefixLength] === nextCharacters[prefixLength]
	) {
		prefixLength += 1;
	}

	let suffixLength = 0;
	while (
		suffixLength < previousCharacters.length - prefixLength &&
		suffixLength < nextCharacters.length - prefixLength &&
		previousCharacters[previousCharacters.length - 1 - suffixLength] ===
			nextCharacters[nextCharacters.length - 1 - suffixLength]
	) {
		suffixLength += 1;
	}

	const insertedCharacters = nextCharacters.slice(
		prefixLength,
		nextCharacters.length - suffixLength
	);
	return insertedCharacters.reduce<TypingPracticeAttemptCounts>(
		(counts, character, offset) => {
			if (character === targetCharacters[prefixLength + offset]) {
				counts.correct += 1;
			} else {
				counts.incorrect += 1;
			}
			return counts;
		},
		{ correct: 0, incorrect: 0 }
	);
}

export function countTypingPracticeTestCharacters(words: readonly string[]): number {
	if (words.length === 0) return 0;
	return words.reduce((total, word) => total + Array.from(word).length, words.length - 1);
}

export function calculateTypingPracticeResults(
	attempts: TypingPracticeAttemptCounts,
	testCharacterCount: number,
	elapsedMilliseconds: number
): TypingPracticeResults {
	const totalAttempts = attempts.correct + attempts.incorrect;
	const accuracyPercent = totalAttempts > 0 ? (attempts.correct / totalAttempts) * 100 : 0;
	const wordsPerMinute =
		elapsedMilliseconds > 0
			? (Math.max(testCharacterCount, 0) / 5) * (60_000 / elapsedMilliseconds)
			: 0;
	return { accuracyPercent, wordsPerMinute };
}

export function formatTypingPracticeElapsed(elapsedMilliseconds: number): string {
	const totalSeconds = Math.floor(Math.max(elapsedMilliseconds, 0) / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
