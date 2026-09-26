import { describe, expect, test } from 'bun:test';
import {
	MEME_FILTER_FSPEED_CUTOFFS,
	deriveMemeFilterExclusions,
	exclusionSetFromIds,
	isExcludedLayout,
	resolveMemeFilterCorpus
} from '../bin/cminibrowser-meme-filter.js';

describe('AKL stats/v1 meme filter', () => {
	test('excludes incomplete layouts and layouts above the corpus Fspeed cutoff', () => {
		const layouts = [
			{ id: 'a', name: 'Incomplete' },
			{ id: 'b', name: 'TooFast' },
			{ id: 'c', name: 'Normal' }
		];
		const objects = new Map([
			[
				'a',
				{ deleted: false, layout: { complete: false }, cmini: { 'monkeyracer.rowstag.none': {} } }
			],
			[
				'b',
				{
					deleted: false,
					layout: { complete: true },
					cmini: { 'monkeyracer.rowstag.none': { fspeed: 250.01 } }
				}
			],
			[
				'c',
				{
					deleted: false,
					layout: { complete: true },
					cmini: { 'monkeyracer.rowstag.none': { fspeed: 250 } }
				}
			]
		]);
		const excluded = deriveMemeFilterExclusions(
			layouts,
			objects,
			'monkeyracer',
			MEME_FILTER_FSPEED_CUTOFFS.monkeyracer
		);

		expect(isExcludedLayout('Incomplete', excluded)).toBe(true);
		expect(isExcludedLayout('toofast', excluded)).toBe(true);
		expect(isExcludedLayout('Normal', excluded)).toBe(false);
	});

	test('builds filename aliases', () => {
		const excluded = exclusionSetFromIds(['Alpha', 'osu.json']);
		expect(excluded.has('alpha.json')).toBe(true);
		expect(excluded.has('osu')).toBe(true);
	});

	test('resolveMemeFilterCorpus prefers flag then env then default', () => {
		const previous = process.env.AKL_STATS_MEME_FILTER_CORPUS;
		try {
			process.env.AKL_STATS_MEME_FILTER_CORPUS = 'reddit';
			expect(resolveMemeFilterCorpus(['--meme-corpus=akl'])).toBe('akl');
			expect(resolveMemeFilterCorpus([])).toBe('reddit');
			delete process.env.AKL_STATS_MEME_FILTER_CORPUS;
			expect(resolveMemeFilterCorpus([])).toBe('monkeyracer');
		} finally {
			if (previous === undefined) delete process.env.AKL_STATS_MEME_FILTER_CORPUS;
			else process.env.AKL_STATS_MEME_FILTER_CORPUS = previous;
		}
	});
});
