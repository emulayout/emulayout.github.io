import { describe, expect, test } from 'bun:test';
import { ENGLISH_1K_WORD_POOL_URL, loadTypingPracticeWords } from '$lib/typingPracticeWords';

describe('typing practice word loading', () => {
	test('loads and validates the vendored English 1k payload', async () => {
		const payload = await Bun.file('static/languages/english1k.json').json();
		const words = await loadTypingPracticeWords(
			async (input) =>
				new Response(JSON.stringify(payload), {
					status: input === ENGLISH_1K_WORD_POOL_URL ? 200 : 404
				})
		);

		expect(payload.name).toBe('english_1k');
		expect(words).toHaveLength(1000);
		expect(new Set(words).size).toBe(1000);
		expect(words[0]).toBe('the');
		expect(words.at(-1)).toBe('universe');
	});

	test('rejects failed and malformed responses', async () => {
		await expect(
			loadTypingPracticeWords(async () => new Response(null, { status: 404 }))
		).rejects.toThrow('Unable to load typing-practice words (404)');
		await expect(
			loadTypingPracticeWords(async () => Response.json({ name: 'english_1k', words: [] }))
		).rejects.toThrow('Typing-practice word data is malformed');
	});
});
