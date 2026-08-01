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
		expect(getLayoutCardStatsHeight('cmini', 'detailed')).toBeCloseTo(118.8);
		expect(getLayoutCardStatsHeight('cyanophage', 'detailed')).toBeCloseTo(103.95);
		expect(getLayoutCardStatsHeight('mana2', 'detailed')).toBeCloseTo(178.2);

		for (const analyzer of ['cmini', 'cyanophage', 'mana2'] as const) {
			expect(getLayoutCardStatsHeight(analyzer, 'focused')).toBe(96);
		}
	});

	test('recovers compact-card space while preserving detailed analyzer differences', () => {
		expect(getLayoutCardHeight(true, true, 'cmini', 'detailed')).toBe(LAYOUT_CARD_HEIGHT);
		expect(getLayoutCardHeight(true, true, 'cmini', 'focused')).toBeCloseTo(501.2);
		expect(getLayoutCardHeight(true, true, 'cyanophage', 'detailed')).toBeCloseTo(509.15);
		expect(getLayoutCardHeight(true, true, 'cyanophage', 'focused')).toBeCloseTo(501.2);
		expect(getLayoutCardHeight(true, true, 'mana2', 'detailed')).toBeCloseTo(583.4);
		expect(getLayoutCardHeight(true, true, 'mana2', 'focused')).toBeCloseTo(501.2);
	});

	test('keeps hidden-stats cards mode-independent and includes the virtual row gap', () => {
		const withoutStats = getLayoutCardHeight(false, true, 'cmini', 'focused');
		expect(getLayoutCardHeight(false, true, 'mana2', 'detailed')).toBe(withoutStats);
		expect(getLayoutCardItemSize(false, true, 'mana2', 'detailed')).toBe(
			withoutStats + LAYOUT_CARD_ROW_GAP
		);
	});
});
