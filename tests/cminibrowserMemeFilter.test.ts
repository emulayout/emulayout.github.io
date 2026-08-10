import { describe, expect, test } from 'bun:test';
import {
	exclusionSetFromIds,
	indexMemeFilterDump,
	isExcludedLayout,
	memeFilterExclusionSet,
	resolveMemeFilterCorpus
} from '../bin/cminibrowser-meme-filter.js';

describe('cminibrowser meme filter', () => {
	const dump = {
		board: 'rowstag',
		corpora: {
			monkeyracer: { cutoff: 250, meme_ids: ['bogos', 'BlankTest', 'osu.json'] },
			reddit: { cutoff: 250, meme_ids: ['bogos'] }
		}
	};

	test('indexes corpora and meme ids', () => {
		const indexed = indexMemeFilterDump(dump);
		expect(indexed.board).toBe('rowstag');
		expect(indexed.corpora.get('monkeyracer')).toEqual({
			cutoff: 250,
			memeIds: ['bogos', 'BlankTest', 'osu.json']
		});
	});

	test('builds exclusion sets with filename aliases', () => {
		const excluded = memeFilterExclusionSet(dump, 'monkeyracer');
		expect(isExcludedLayout('bogos', excluded)).toBe(true);
		expect(isExcludedLayout('blanktest', excluded)).toBe(true);
		expect(isExcludedLayout('BlankTest', excluded)).toBe(true);
		expect(isExcludedLayout('osu', excluded)).toBe(true);
		expect(isExcludedLayout('qwerty', excluded)).toBe(false);
		expect(exclusionSetFromIds(['Alpha']).has('alpha.json')).toBe(true);
	});

	test('rejects unknown corpora', () => {
		expect(() => memeFilterExclusionSet(dump, 'missing')).toThrow(/no corpus "missing"/);
	});

	test('resolveMemeFilterCorpus prefers flag then env then default', () => {
		const previous = process.env.CMINIBROWSER_MEME_FILTER_CORPUS;
		try {
			process.env.CMINIBROWSER_MEME_FILTER_CORPUS = 'reddit';
			expect(resolveMemeFilterCorpus(['--meme-corpus=akl'])).toBe('akl');
			expect(resolveMemeFilterCorpus([])).toBe('reddit');
			delete process.env.CMINIBROWSER_MEME_FILTER_CORPUS;
			expect(resolveMemeFilterCorpus([])).toBe('monkeyracer');
		} finally {
			if (previous === undefined) delete process.env.CMINIBROWSER_MEME_FILTER_CORPUS;
			else process.env.CMINIBROWSER_MEME_FILTER_CORPUS = previous;
		}
	});
});
