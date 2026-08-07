import { describe, expect, test } from 'bun:test';
import { parseCorpusArgs } from '../bin/sync-shared.js';

describe('parseCorpusArgs', () => {
	test('prefers --corpus= over env and defaults', () => {
		expect(
			parseCorpusArgs(['--corpus=reddit', '--force'], {
				env: 'CMINIBROWSER_CMINI_CORPUS',
				defaultCorpora: ['monkeyracer', 'reddit']
			})
		).toEqual(['reddit']);
	});

	test('uses env when no flag is set', () => {
		const previous = process.env.CMINIBROWSER_CMINI_CORPUS;
		process.env.CMINIBROWSER_CMINI_CORPUS = 'reddit';
		try {
			expect(
				parseCorpusArgs([], {
					env: 'CMINIBROWSER_CMINI_CORPUS',
					defaultCorpora: ['monkeyracer', 'reddit']
				})
			).toEqual(['reddit']);
		} finally {
			if (previous === undefined) delete process.env.CMINIBROWSER_CMINI_CORPUS;
			else process.env.CMINIBROWSER_CMINI_CORPUS = previous;
		}
	});

	test('falls back to catalog defaults', () => {
		const previous = process.env.CMINIBROWSER_CMINI_CORPUS;
		delete process.env.CMINIBROWSER_CMINI_CORPUS;
		try {
			expect(
				parseCorpusArgs(['--offline'], {
					env: 'CMINIBROWSER_CMINI_CORPUS',
					defaultCorpora: ['monkeyracer', 'reddit']
				})
			).toEqual(['monkeyracer', 'reddit']);
		} finally {
			if (previous !== undefined) process.env.CMINIBROWSER_CMINI_CORPUS = previous;
		}
	});
});
