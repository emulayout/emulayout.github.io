#!/usr/bin/env bun

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	CMINI_ANALYZER,
	DEFAULT_STATS_CORPUS,
	MANA2_ANALYZER,
	dumpSyncedCorpora
} from '../src/lib/statsAnalyzers.ts';
import { cminiCompactStatsRelPath, mana2StatsRelPath } from './stats-artifact-paths.js';

export const LAYOUT_DETAIL_VERSION = 3;

const DETAIL_MANA2_BOARD = process.env.MANA2_STATS_BOARD ?? 'rowstag';
const DETAIL_MANA2_SPACE = process.env.MANA2_STATS_SPACE ?? 'none';
const CMINI_CORPORA = dumpSyncedCorpora(CMINI_ANALYZER);
const MANA2_CORPORA = dumpSyncedCorpora(MANA2_ANALYZER);

const STATIC_DIR = join(process.cwd(), 'static');
const DETAILS_DIR = join(STATIC_DIR, 'layout-details');
const NAMES_FILE = join(STATIC_DIR, 'layout-names.json');

const REQUIRED_FILES = {
	layouts: join(STATIC_DIR, 'all-layouts.json'),
	authors: join(STATIC_DIR, 'authors.json'),
	supplemental: join(STATIC_DIR, 'layout-supplemental.json'),
	likes: join(STATIC_DIR, 'layout-likes.json'),
	cmini: join(process.cwd(), cminiCompactStatsRelPath(DEFAULT_STATS_CORPUS)),
	cyanophage: join(STATIC_DIR, 'layout-stats-cyanophage.json')
};

/** @param {string} name */
export function layoutDetailFileId(name) {
	return Buffer.from(name, 'utf8').toString('hex');
}

/** @param {string} path */
async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'));
}

/** @param {string} path */
async function readOptionalJson(path) {
	try {
		return await readJson(path);
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return {};
		throw error;
	}
}

/**
 * Preserve unchanged bytes and mtimes so local and deployment caches can recognize stable files.
 * @param {string} path
 * @param {string} body
 */
async function writeIfChanged(path, body) {
	try {
		if ((await readFile(path, 'utf8')) === body) return false;
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
	}
	await writeFile(path, body, 'utf8');
	return true;
}

/**
 * @param {unknown[]} layouts
 * @param {Record<string, number>} authors
 * @param {Record<string, unknown>} supplemental
 * @param {Record<string, number>} likes
 * @param {{
 *   cmini: Record<string, Record<string, unknown>>,
 *   cyanophage: Record<string, unknown>,
 *   mana2: Record<string, Record<string, unknown>>
 * }} stats
 */
export function buildCompactLayoutDetails(layouts, authors, supplemental, likes, stats) {
	const authorById = new Map(Object.entries(authors).map(([name, id]) => [id, name]));
	return layouts.map((layout) => {
		if (!Array.isArray(layout) || typeof layout[0] !== 'string') {
			throw new Error('all-layouts.json contains an invalid compact layout');
		}
		const name = layout[0];
		const userId = layout[1];
		const cmini = Object.fromEntries(
			Object.entries(stats.cmini).flatMap(([corpus, map]) =>
				map[name] === undefined ? [] : [[corpus, map[name]]]
			)
		);
		const mana2 = Object.fromEntries(
			Object.entries(stats.mana2).flatMap(([corpus, map]) =>
				map[name] === undefined ? [] : [[corpus, map[name]]]
			)
		);
		return {
			name,
			payload: {
				version: LAYOUT_DETAIL_VERSION,
				layout,
				authorName: authorById.get(userId) ?? 'Unknown',
				likeCount: likes[name] ?? 0,
				...(supplemental[name] ? { supplemental: supplemental[name] } : {}),
				stats: {
					...(Object.keys(cmini).length > 0 ? { cmini } : {}),
					...(stats.cyanophage[name] ? { cyanophage: stats.cyanophage[name] } : {}),
					...(Object.keys(mana2).length > 0 ? { mana2 } : {})
				}
			}
		};
	});
}

export async function generateLayoutDetails() {
	const [layouts, authors, supplemental, likes, defaultCmini, cyanophage] = await Promise.all([
		readJson(REQUIRED_FILES.layouts),
		readJson(REQUIRED_FILES.authors),
		readJson(REQUIRED_FILES.supplemental),
		readJson(REQUIRED_FILES.likes),
		readJson(REQUIRED_FILES.cmini),
		readJson(REQUIRED_FILES.cyanophage)
	]);
	const cminiEntries = await Promise.all(
		CMINI_CORPORA.map(async (corpus) => [
			corpus,
			corpus === DEFAULT_STATS_CORPUS
				? defaultCmini
				: await readOptionalJson(join(process.cwd(), cminiCompactStatsRelPath(corpus)))
		])
	);
	const mana2Entries = await Promise.all(
		MANA2_CORPORA.map(async (corpus) => [
			corpus,
			await readOptionalJson(
				join(process.cwd(), mana2StatsRelPath(corpus, DETAIL_MANA2_BOARD, DETAIL_MANA2_SPACE))
			)
		])
	);

	const details = buildCompactLayoutDetails(layouts, authors, supplemental, likes, {
		cmini: Object.fromEntries(cminiEntries),
		cyanophage,
		mana2: Object.fromEntries(mana2Entries)
	});
	await mkdir(DETAILS_DIR, { recursive: true });

	const expectedFiles = new Set();
	let written = 0;
	for (const { name, payload } of details) {
		const filename = `${layoutDetailFileId(name)}.json`;
		expectedFiles.add(filename);
		if (await writeIfChanged(join(DETAILS_DIR, filename), JSON.stringify(payload) + '\n'))
			written++;
	}

	let removed = 0;
	for (const filename of await readdir(DETAILS_DIR)) {
		if (!filename.endsWith('.json') || expectedFiles.has(filename)) continue;
		await unlink(join(DETAILS_DIR, filename));
		removed++;
	}

	const names = details.map(({ name }) => name);
	const namesChanged = await writeIfChanged(NAMES_FILE, JSON.stringify(names) + '\n');
	console.log(
		`✔ Layout details: ${details.length} total, ${written} updated, ${removed} removed${namesChanged ? ', name index updated' : ''}`
	);
}

if (import.meta.main) {
	generateLayoutDetails().catch((error) => {
		console.error('❌ Layout-detail generation failed:', error);
		process.exit(1);
	});
}
