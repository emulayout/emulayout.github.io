import { describe, expect, test } from 'bun:test';
import {
	CYANOPHAGE_STAT_KEYS as BACKEND_CYANOPHAGE_STAT_KEYS,
	buildCyanophageStats,
	measureLayoutStats
} from '../bin/cyanophage-stats.js';
import {
	cyanophageStatsNeedMagicMappings,
	prepareCyanophageContextualRewrite,
	rewriteCyanophageWord
} from '../bin/cyanophage-magic.js';
import { CYANOPHAGE_STAT_KEYS as FRONTEND_CYANOPHAGE_STAT_KEYS } from '$lib/statsDerivation';
import { isCyanophageCompatible, isCyanophageMeasurable } from '$lib/cyanophage';

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

describe('Cyanophage Magic / Repeat rewrite', () => {
	test('allows * and @ for offline measurement while playground stays incompatible', () => {
		const sparse = {
			q: { row: 0, col: 1 },
			w: { row: 0, col: 2 },
			e: { row: 0, col: 3 },
			r: { row: 0, col: 4 },
			t: { row: 0, col: 5 },
			y: { row: 0, col: 6 },
			u: { row: 0, col: 7 },
			i: { row: 0, col: 8 },
			o: { row: 0, col: 9 },
			p: { row: 0, col: 10 },
			a: { row: 1, col: 1 },
			s: { row: 1, col: 2 },
			d: { row: 1, col: 3 },
			f: { row: 1, col: 4 },
			g: { row: 1, col: 5 },
			h: { row: 1, col: 6 },
			j: { row: 1, col: 7 },
			k: { row: 1, col: 8 },
			l: { row: 1, col: 9 },
			';': { row: 1, col: 10 },
			z: { row: 2, col: 1 },
			x: { row: 2, col: 2 },
			c: { row: 2, col: 3 },
			v: { row: 2, col: 4 },
			b: { row: 2, col: 5 },
			n: { row: 2, col: 6 },
			m: { row: 2, col: 7 },
			',': { row: 2, col: 8 },
			'.': { row: 2, col: 9 },
			'/': { row: 2, col: 10 },
			'*': { row: 1, col: 0 },
			'-': { row: 0, col: 11 },
			'\\': { row: 2, col: 11 }
		};

		expect(isCyanophageCompatible(sparse)).toBe(false);
		expect(isCyanophageMeasurable(sparse)).toBe(true);
	});

	test('rewrites Magic expansions and Repeat doubles the way Cyanophage does', () => {
		expect(
			rewriteCyanophageWord('scape', {
				magicKey: '*',
				magicTable: { s: 'c' }
			})
		).toBe('s*ape');

		expect(
			rewriteCyanophageWord('letter', {
				repeatKey: '@'
			})
		).toBe('let@er');

		// Cyanophage omits j/q/v/w/y from Repeat rewriting.
		expect(
			rewriteCyanophageWord('jazz', {
				repeatKey: '@'
			})
		).toBe('jaz@');
	});

	test('prepares Graphyre-style mappings and ignores emit fallbacks', () => {
		const keys = { '*': { row: 1, col: 5 }, s: { row: 1, col: 3 }, c: { row: 2, col: 3 } };
		const prepared = prepareCyanophageContextualRewrite(
			{
				'*': {
					rules: { s: 'c', r: 'l' },
					fallback: { emit: 'y' }
				}
			},
			keys
		);

		expect(prepared).not.toBeNull();
		expect(prepared!.magicKey).toBe('*');
		expect(prepared!.magicTable).toEqual({ s: 'c', r: 'l' });
		expect(prepared!.rewrite('scape')).toBe('s*ape');
	});

	test('does not prepare a Magic rewrite without exported mappings', () => {
		expect(prepareCyanophageContextualRewrite(undefined, { '*': { row: 1, col: 5 } })).toBeNull();
	});

	test('rejects multiple Magic triggers instead of scoring a partial profile', () => {
		const keys = {
			'*': { row: 1, col: 5 },
			'@': { row: 1, col: 6 },
			s: { row: 1, col: 3 },
			c: { row: 2, col: 3 }
		};
		const mappings = {
			'*': { s: 'c' },
			'@': { c: 'h' }
		};

		expect(prepareCyanophageContextualRewrite(mappings, keys)).toBeNull();
		expect(cyanophageStatsNeedMagicMappings(mappings, keys)).toBe(true);
		expect(
			buildCyanophageStats(
				{ keys },
				{
					words: { sc: 1 },
					dictionary: [],
					bigramEffort: {},
					effortGrid: ZERO_EFFORT_GRID,
					effortWords: []
				},
				{ magicMappings: mappings }
			)
		).toBeNull();
	});

	test('bases the mappings-required state on the exported profile', () => {
		const keys = { '*': { row: 1, col: 5 }, s: { row: 1, col: 3 } };

		expect(cyanophageStatsNeedMagicMappings(undefined, keys)).toBe(false);
		expect(cyanophageStatsNeedMagicMappings({ '*': { s: 'c' } }, keys)).toBe(false);
	});

	test('scores rewritten Magic keystrokes while keeping original input length', () => {
		const charMap = new Map([
			['s', { row: 1, col: 3 }],
			['c', { row: 1, col: 4 }],
			['a', { row: 1, col: 1 }],
			['*', { row: 1, col: 6 }]
		]);
		const words = { sc: 1 };
		const rewrite = (word: string) =>
			rewriteCyanophageWord(word, { magicKey: '*', magicTable: { s: 'c' } });

		const base = measureLayoutStats(charMap, words, {}, ZERO_EFFORT_GRID, 'ortho');
		const magic = measureLayoutStats(charMap, words, {}, ZERO_EFFORT_GRID, 'ortho', rewrite);

		expect(base).not.toBeNull();
		expect(magic).not.toBeNull();
		// `sc` is left/left; `s*` crosses to the right hand.
		expect(base!.lh).toBe(1);
		expect(magic!.lh).toBe(0.5);
		expect(magic!.rh).toBe(0.5);
	});
});
