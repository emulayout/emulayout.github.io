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

export type TypingPracticeRandomSource = () => number;

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

/** Restore a session over the original word list, keeping stable remaining-word identities. */
export function createTypingPracticeSessionFromProgress(
	words: readonly string[],
	completedWordCount: number,
	input: string
): TypingPracticeSession {
	const allWords = normalizedWords(words);
	const completed = Math.min(Math.max(Math.floor(completedWordCount), 0), allWords.length);
	return {
		remainingWords: allWords.slice(completed),
		input: completed === allWords.length ? '' : input,
		completedWordCount: completed,
		totalWordCount: allWords.length
	};
}

/** Length of the leading source input that still matches the source word. */
export function sourceCorrectPrefixLength(sourceWord: string, sourceInput: string): number {
	const wordCharacters = Array.from(sourceWord);
	const inputCharacters = Array.from(sourceInput);
	let length = 0;
	while (
		length < inputCharacters.length &&
		length < wordCharacters.length &&
		inputCharacters[length] === wordCharacters[length]
	) {
		length += 1;
	}
	return length;
}

export function selectRandomTypingPracticeWords(
	words: readonly string[],
	count: number,
	random: TypingPracticeRandomSource = Math.random
): string[] {
	const pool = normalizedWords(words).map(({ text }) => text);
	const selectionCount = Math.min(Math.max(Math.floor(count), 0), pool.length);

	for (let index = 0; index < selectionCount; index += 1) {
		const randomUnit = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
		const randomIndex = index + Math.floor(randomUnit * (pool.length - index));
		[pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
	}

	return pool.slice(0, selectionCount);
}

export function createRandomTypingPracticeSession(
	words: readonly string[],
	count: number,
	random: TypingPracticeRandomSource = Math.random
): TypingPracticeSession {
	return createTypingPracticeSession(selectRandomTypingPracticeWords(words, count, random));
}

export function updateTypingPracticeInput(
	session: TypingPracticeSession,
	input: string
): TypingPracticeSession {
	const updatedSession = { ...session, input };
	return updatedSession.remainingWords.length === 1 && isTypingPracticeWordComplete(updatedSession)
		? advanceTypingPracticeWord(updatedSession)
		: updatedSession;
}

export function isTypingPracticeWordComplete(session: TypingPracticeSession): boolean {
	return (
		session.remainingWords[0] !== undefined && session.input === session.remainingWords[0].text
	);
}

export function hasTypingPracticeInputError(session: TypingPracticeSession): boolean {
	const activeWord = session.remainingWords[0];
	if (!activeWord) return false;
	const targetCharacters = Array.from(activeWord.text);
	return Array.from(session.input).some(
		(character, index) => character !== targetCharacters[index]
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

	return targetCharacters.map((targetCharacter, index) => {
		const inputCharacter = inputCharacters[index];
		if (inputCharacter === undefined) {
			return { character: targetCharacter, status: 'pending' };
		}
		return {
			character: targetCharacter,
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
