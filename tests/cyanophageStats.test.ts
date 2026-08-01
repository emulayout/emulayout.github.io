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

	test('preserves directional rolls, alt-SFS, and weak redirects', () => {
		const charMap = new Map([
			['a', { row: 1, col: 1 }], // left pinky
			['b', { row: 1, col: 2 }], // left ring
			['c', { row: 1, col: 3 }], // left middle
			['d', { row: 1, col: 4 }], // left index
			['e', { row: 1, col: 0 }], // another left-pinky key
			['r', { row: 1, col: 7 }] // right index
		]);
		const words = {
			abc: 1, // three-key inward roll
			cba: 1, // three-key outward roll
			abr: 1, // two-key inward roll, then hand change
			cbr: 1, // two-key outward roll, then hand change
			era: 1, // alternation ending on a different key of the same finger
			acb: 1, // weak redirect (no index finger)
			adb: 1 // redirect containing the index finger
		};

		const stats = measureLayoutStats(charMap, words, {}, ZERO_EFFORT_GRID);
		expect(stats).not.toBeNull();
		const oneTrigram = 1 / 28;
		expect(stats!.roll).toBeCloseTo(4 * oneTrigram);
		expect(stats!['roll-in']).toBeCloseTo(2 * oneTrigram);
		expect(stats!['roll-out']).toBeCloseTo(2 * oneTrigram);
		expect(stats!['roll-in-2']).toBeCloseTo(oneTrigram);
		expect(stats!['roll-out-2']).toBeCloseTo(oneTrigram);
		expect(stats!['roll-in-3']).toBeCloseTo(oneTrigram);
		expect(stats!['roll-out-3']).toBeCloseTo(oneTrigram);
		expect(stats!['alt-sfs']).toBeCloseTo(oneTrigram);
		expect(stats!.alternate).toBe(0);
		expect(stats!.redirect).toBeCloseTo(2 * oneTrigram);
		expect(stats!['redirect-weak']).toBeCloseTo(oneTrigram);
	});
});
