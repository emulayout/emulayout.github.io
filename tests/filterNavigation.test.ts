import { describe, expect, test } from 'bun:test';
import {
	createHistoryTarget,
	isRouterNotReadyError,
	shouldWriteHistory
} from '$lib/filterNavigation';

describe('filter history navigation', () => {
	test('builds a path-only history target', () => {
		expect(
			createHistoryTarget({
				pathname: '/layouts',
				search: '?name=Canary',
				hash: '#results'
			})
		).toBe('/layouts?name=Canary#results');
	});

	test('deduplicates pushes while always allowing replacements', () => {
		const current = '/?name=Canary';

		expect(shouldWriteHistory('push', current, current)).toBe(false);
		expect(shouldWriteHistory('push', '/?name=Graphite', current)).toBe(true);
		expect(shouldWriteHistory('replace', current, current)).toBe(true);
	});

	test('recognizes only SvelteKit router-startup failures as retryable', () => {
		expect(
			isRouterNotReadyError(new Error('Cannot call replaceState(...) before router is initialized'))
		).toBe(true);
		expect(isRouterNotReadyError(new Error('Could not serialize state'))).toBe(false);
		expect(isRouterNotReadyError('before router is initialized')).toBe(false);
	});
});
