import { describe, expect, test } from 'bun:test';
import {
	getLayoutCardHeight,
	getLayoutCardItemSize,
	getLayoutCardStatsHeight,
	LAYOUT_CARD_HEIGHT,
	LAYOUT_CARD_ROW_GAP
} from '../src/lib/constants';

describe('layout card dimensions', () => {
	test('uses the rendered stats height for each analyzer and display mode', () => {
		expect(getLayoutCardStatsHeight('cmini', 'detailed')).toBeCloseTo(207.9);
		expect(getLayoutCardStatsHeight('cyanophage', 'detailed')).toBeCloseTo(207.9);
		expect(getLayoutCardStatsHeight('mana2', 'detailed')).toBeCloseTo(267.3);

		for (const analyzer of ['cmini', 'cyanophage', 'mana2'] as const) {
			expect(getLayoutCardStatsHeight(analyzer, 'focused')).toBe(207);
		}
	});

	test('uses only the height required by each stats presentation', () => {
		expect(getLayoutCardHeight(true, true, 'cmini', 'detailed')).toBe(LAYOUT_CARD_HEIGHT);
		expect(getLayoutCardHeight(true, true, 'cmini', 'focused')).toBeCloseTo(501.2);
		expect(getLayoutCardHeight(true, true, 'cmini', 'detailed')).toBeCloseTo(502.1);
		expect(getLayoutCardHeight(true, true, 'cyanophage', 'detailed')).toBeCloseTo(502.1);
		expect(getLayoutCardHeight(true, true, 'cyanophage', 'focused')).toBeCloseTo(501.2);
		expect(getLayoutCardHeight(true, true, 'mana2', 'detailed')).toBeCloseTo(561.5);
		expect(getLayoutCardHeight(true, true, 'mana2', 'focused')).toBeCloseTo(501.2);
	});

	test('keeps hidden-stats cards mode-independent and includes the virtual row gap', () => {
		const withoutStats = getLayoutCardHeight(false, true, 'cmini', 'focused');
		expect(getLayoutCardHeight(false, true, 'mana2', 'detailed')).toBe(withoutStats);
		expect(getLayoutCardItemSize(false, true, 'mana2', 'detailed')).toBe(
			withoutStats + LAYOUT_CARD_ROW_GAP
		);
		expect(getLayoutCardHeight(false, true, 'cmini', 'focused')).toBe(304);
		expect(getLayoutCardHeight(false, false, 'cmini', 'focused')).toBe(252);
	});
});
