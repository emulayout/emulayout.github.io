import { describe, expect, test } from 'bun:test';
import {
	getLayoutCardHeight,
	getLayoutCardItemSize,
	getLayoutCardStatsHeight,
	LAYOUT_CARD_HEIGHT,
	LAYOUT_CARD_ROW_GAP
} from '../src/lib/constants';

describe('layout card dimensions', () => {
	test('uses the fixed Highlights stats height', () => {
		expect(getLayoutCardStatsHeight()).toBe(207);
	});

	test('uses one Highlights card height for every analyzer', () => {
		expect(getLayoutCardHeight(true, true)).toBe(LAYOUT_CARD_HEIGHT);
		expect(getLayoutCardHeight(true, true)).toBeCloseTo(501.2);
	});

	test('keeps hidden-stats cards compact and includes the virtual row gap', () => {
		const withoutStats = getLayoutCardHeight(false, true);
		expect(getLayoutCardItemSize(false, true)).toBe(withoutStats + LAYOUT_CARD_ROW_GAP);
		expect(getLayoutCardHeight(false, true)).toBe(304);
		expect(getLayoutCardHeight(false, false)).toBe(252);
	});
});
