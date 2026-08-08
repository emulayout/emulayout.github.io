export const ENGLISH_1K_WORD_POOL_URL = '/languages/english1k.json';

interface TypingPracticeWordPoolPayload {
	name: string;
	words: string[];
}

export type TypingPracticeWordFetcher = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Promise<Response>;

function isTypingPracticeWordPoolPayload(value: unknown): value is TypingPracticeWordPoolPayload {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.name === 'string' &&
		Array.isArray(candidate.words) &&
		candidate.words.length > 0 &&
		candidate.words.every((word) => typeof word === 'string' && word.trim().length > 0)
	);
}

export async function loadTypingPracticeWords(
	fetcher: TypingPracticeWordFetcher,
	url = ENGLISH_1K_WORD_POOL_URL,
	signal?: AbortSignal
): Promise<string[]> {
	const response = await fetcher(url, { signal });
	if (!response.ok) {
		throw new Error(`Unable to load typing-practice words (${response.status})`);
	}
	const payload: unknown = await response.json();
	if (!isTypingPracticeWordPoolPayload(payload)) {
		throw new Error('Typing-practice word data is malformed');
	}
	return payload.words;
}
