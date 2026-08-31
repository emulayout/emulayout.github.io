import { describe, expect, test } from 'bun:test';
import { createCminibrowserLayoutURL } from '$lib/cminibrowser';

describe('AKL layout links', () => {
	test('matches the encoded open-layout fragment format', () => {
		expect(createCminibrowserLayoutURL('night')).toBe(
			'https://akl.gg/#%7B%22open%22%3A%22night%22%7D'
		);
	});

	test('encodes punctuation and non-ASCII layout names', () => {
		const layoutName = 'A/B “β”';
		expect(createCminibrowserLayoutURL(layoutName)).toBe(
			`https://akl.gg/#${encodeURIComponent(JSON.stringify({ open: layoutName }))}`
		);
	});
});
