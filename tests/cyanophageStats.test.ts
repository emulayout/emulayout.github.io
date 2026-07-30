import { describe, expect, test } from 'bun:test';
import {
	CYANOPHAGE_STAT_KEYS as BACKEND_CYANOPHAGE_STAT_KEYS,
	measureLayoutStats
} from '../bin/cyanophage-stats.js';
import { CYANOPHAGE_STAT_KEYS as FRONTEND_CYANOPHAGE_STAT_KEYS } from '$lib/statsDerivation';

const ZERO_EFFORT_GRID = Array.from({ length: 4 }, () => Array(13).fill(0));

describe('Cyanophage finger distance', () => {
	test('keeps backend and frontend compact schemas aligned', () => {
		expect(BACKEND_CYANOPHAGE_STAT_KEYS).toEqual(FRONTEND_CYANOPHAGE_STAT_KEYS);
	});

	test('tracks normalized travel per finger and changes with board geometry', () => {
		const charMap = new Map([
			['a', { row: 1, col: 1 }],
			['q', { row: 0, col: 1 }]
		]);
		const words = { aqa: 1 };

		const ortho = measureLayoutStats(charMap, words, {}, ZERO_EFFORT_GRID, 'ortho');
		const stagger = measureLayoutStats(charMap, words, {}, ZERO_EFFORT_GRID, 'stagger');

		expect(ortho).not.toBeNull();
		expect(stagger).not.toBeNull();
		expect(ortho!.distance).toBeCloseTo(255.5441088);
		expect(ortho!['distance-LP']).toBeCloseTo(ortho!.distance);
		expect(ortho!['distance-LI']).toBe(0);
		expect(stagger!.distance).toBeGreaterThan(ortho!.distance);
		expect(stagger!['distance-LP']).toBeCloseTo(stagger!.distance);
	});
});
