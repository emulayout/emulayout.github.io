import { describe, expect, test } from 'bun:test';
import { loadAnalyzerStats } from '$lib/layoutStatsLoader';

describe('loadAnalyzerStats', () => {
	test('returns a parsed analyzer map on success', async () => {
		const result = await loadAnalyzerStats('monkeyracer', {
			fetch: async () =>
				new Response(JSON.stringify({ Canary: [1, 2, 3] }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		});

		expect(result).toEqual({
			status: 'loaded',
			map: { Canary: [1, 2, 3] }
		});
	});

	test('represents an HTTP failure without rejecting', async () => {
		const result = await loadAnalyzerStats('cyanophage', {
			fetch: async () => new Response(null, { status: 503, statusText: 'Unavailable' })
		});

		expect(result).toEqual({
			status: 'error',
			error: {
				kind: 'http',
				status: 503,
				message: 'Analyzer stats request failed (503 Unavailable).'
			}
		});
	});

	test('represents a network failure without rejecting', async () => {
		const result = await loadAnalyzerStats('mana2', {
			fetch: async () => {
				throw new TypeError('connection lost');
			}
		});

		expect(result).toEqual({
			status: 'error',
			error: {
				kind: 'network',
				message: 'Could not download analyzer stats: connection lost'
			}
		});
	});

	test('represents malformed JSON as a parse failure', async () => {
		const result = await loadAnalyzerStats('monkeyracer', {
			fetch: async () =>
				new Response('{not json', {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		});

		expect(result.status).toBe('error');
		if (result.status !== 'error') throw new Error('Expected a parse error');
		expect(result.error.kind).toBe('parse');
	});

	test('treats an aborted request as an expected outcome', async () => {
		const abortController = new AbortController();
		const pending = loadAnalyzerStats('monkeyracer', {
			signal: abortController.signal,
			fetch: async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						reject(new DOMException('The operation was aborted', 'AbortError'));
					});
				})
		});

		abortController.abort();

		expect(await pending).toEqual({ status: 'aborted' });
	});
});
