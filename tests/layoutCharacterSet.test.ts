import { describe, expect, test } from 'bun:test';
import { computeCharacterSet } from '$lib/layoutCharacterSet';

describe('layout character set', () => {
	test('keeps English layouts English when Adaptive or modifier symbols are present', () => {
		expect(computeCharacterSet(['a', 'z', '◇'])).toBe('english');
		expect(computeCharacterSet(['*', '@', '⇧', '‘'])).toBe('english');
		expect(computeCharacterSet(['a', '◇'])).toBe('english');
	});

	test('marks layouts international only when they include non-English letters', () => {
		expect(computeCharacterSet(['a', 'é'])).toBe('international');
		expect(computeCharacterSet(['ф'])).toBe('international');
		expect(computeCharacterSet(['e\u0301'])).toBe('international');
	});
});
