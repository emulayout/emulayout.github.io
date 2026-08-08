export type TypingPracticeCharacterStatus = 'pending' | 'correct' | 'incorrect';

export interface TypingPracticeCharacterFeedback {
	character: string;
	status: TypingPracticeCharacterStatus;
}

export interface TypingPracticeWordFeedback {
	id: string;
	word: string;
	characters: readonly TypingPracticeCharacterFeedback[];
	current: boolean;
}

export interface TypingPracticeWord {
	id: string;
	text: string;
}

export interface TypingPracticeSession {
	remainingWords: readonly TypingPracticeWord[];
	input: string;
	completedWordCount: number;
	totalWordCount: number;
}

function normalizedWords(words: readonly string[]): TypingPracticeWord[] {
	return words.flatMap((word, index) => {
		const text = word.trim();
		return text ? [{ id: `${index}:${text}`, text }] : [];
	});
}

export function createTypingPracticeSession(words: readonly string[]): TypingPracticeSession {
	const remainingWords = normalizedWords(words);
	return {
		remainingWords,
		input: '',
		completedWordCount: 0,
		totalWordCount: remainingWords.length
	};
}

export function updateTypingPracticeInput(
	session: TypingPracticeSession,
	input: string
): TypingPracticeSession {
	return { ...session, input };
}

export function isTypingPracticeWordComplete(session: TypingPracticeSession): boolean {
	return (
		session.remainingWords[0] !== undefined && session.input === session.remainingWords[0].text
	);
}

export function advanceTypingPracticeWord(session: TypingPracticeSession): TypingPracticeSession {
	if (!isTypingPracticeWordComplete(session)) return session;
	return {
		...session,
		remainingWords: session.remainingWords.slice(1),
		input: '',
		completedWordCount: session.completedWordCount + 1
	};
}

function buildCurrentWordFeedback(word: string, input: string): TypingPracticeCharacterFeedback[] {
	const targetCharacters = Array.from(word);
	const inputCharacters = Array.from(input);
	const characterCount = Math.max(targetCharacters.length, inputCharacters.length);

	return Array.from({ length: characterCount }, (_, index) => {
		const targetCharacter = targetCharacters[index];
		const inputCharacter = inputCharacters[index];
		if (inputCharacter === undefined) {
			return { character: targetCharacter ?? '', status: 'pending' };
		}
		return {
			character: targetCharacter ?? inputCharacter,
			status: inputCharacter === targetCharacter ? 'correct' : 'incorrect'
		};
	});
}

export function buildTypingPracticePrompt(
	session: TypingPracticeSession
): TypingPracticeWordFeedback[] {
	return session.remainingWords.map((word, index) => ({
		id: word.id,
		word: word.text,
		current: index === 0,
		characters:
			index === 0
				? buildCurrentWordFeedback(word.text, session.input)
				: Array.from(word.text, (character) => ({ character, status: 'pending' as const }))
	}));
}
