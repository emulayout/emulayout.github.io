import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertStatsCatalogCoverage,
	parseCorpusArgs,
	writeTextFileIfChanged
} from '../bin/sync-shared.js';

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

describe('writeTextFileIfChanged', () => {
	test('writes new and changed content without rewriting identical content', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'emulayout-sync-shared-'));
		const path = join(directory, 'artifact.json');
		try {
			expect(await writeTextFileIfChanged(path, '{"version":1}\n')).toBe(true);
			expect(await writeTextFileIfChanged(path, '{"version":1}\n')).toBe(false);
			expect(await writeTextFileIfChanged(path, '{"version":2}\n')).toBe(true);
			expect(await readFile(path, 'utf-8')).toBe('{"version":2}\n');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

describe('assertStatsCatalogCoverage', () => {
	test('accepts a dump at the minimum coverage', () => {
		expect(() => assertStatsCatalogCoverage('test dump', 90, 100)).not.toThrow();
	});

	test('rejects incomplete and empty dumps', () => {
		expect(() => assertStatsCatalogCoverage('test dump', 89, 100)).toThrow(
			'test dump covers 89/100 eligible layouts (89.0%); minimum is 90.0%'
		);
		expect(() => assertStatsCatalogCoverage('empty dump', 0, 0)).toThrow(
			'empty dump covers 0/0 eligible layouts'
		);
	});
});
