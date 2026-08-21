import { describe, expect, test } from 'bun:test';
import { fitSizeToWidth } from '$lib/fitTextToWidth';

describe('fitSizeToWidth', () => {
	test('keeps the maximum when the line already fits', () => {
		expect(fitSizeToWidth(16, 40, () => false)).toBe(40);
	});

	test('uses the minimum when even that size overflows', () => {
		expect(fitSizeToWidth(16, 40, () => true)).toBe(16);
	});

	test('finds the largest size that still fits', () => {
		expect(fitSizeToWidth(16, 40, (px) => px > 22)).toBe(22);
	});
});
