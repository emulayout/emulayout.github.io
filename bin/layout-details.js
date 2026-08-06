#!/usr/bin/env bun

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	cminiCompactStatsRelPath,
	cminiExtendedStatsRelPath,
	mana2ExtendedStatsRelPath,
	mana2StatsRelPath
} from './stats-artifact-paths.js';

export const LAYOUT_DETAIL_VERSION = 2;

/** Corpus used for cmini / Mana2 detail payloads until the UI selects corpora. */
const DETAIL_STATS_CORPUS = process.env.CMINIBROWSER_CMINI_CORPUS ?? 'monkeyracer';
const DETAIL_MANA2_BOARD = process.env.MANA2_STATS_BOARD ?? 'rowstag';
const DETAIL_MANA2_SPACE = process.env.MANA2_STATS_SPACE ?? 'none';

const STATIC_DIR = join(process.cwd(), 'static');
const DETAILS_DIR = join(STATIC_DIR, 'layout-details');
const NAMES_FILE = join(STATIC_DIR, 'layout-names.json');

const REQUIRED_FILES = {
	layouts: join(STATIC_DIR, 'all-layouts.json'),
	authors: join(STATIC_DIR, 'authors.json'),
	supplemental: join(STATIC_DIR, 'layout-supplemental.json'),
	likes: join(STATIC_DIR, 'layout-likes.json'),
	cmini: join(process.cwd(), cminiCompactStatsRelPath(DETAIL_STATS_CORPUS)),
	cyanophage: join(STATIC_DIR, 'layout-stats-cyanophage.json')
};
const OPTIONAL_FILES = {
	mana2: join(
		process.cwd(),
		mana2StatsRelPath(DETAIL_STATS_CORPUS, DETAIL_MANA2_BOARD, DETAIL_MANA2_SPACE)
	),
	cminiExtended: join(process.cwd(), cminiExtendedStatsRelPath(DETAIL_STATS_CORPUS)),
	mana2Extended: join(
		process.cwd(),
		mana2ExtendedStatsRelPath(DETAIL_STATS_CORPUS, DETAIL_MANA2_BOARD, DETAIL_MANA2_SPACE)
	)
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
 *   cmini: Record<string, unknown>,
 *   cminiExtended?: Record<string, unknown>,
 *   cyanophage: Record<string, unknown>,
 *   mana2: Record<string, unknown>,
 *   mana2Extended?: Record<string, unknown>
 * }} stats
 */
export function buildCompactLayoutDetails(layouts, authors, supplemental, likes, stats) {
	const authorById = new Map(Object.entries(authors).map(([name, id]) => [id, name]));
	const cminiExtended = stats.cminiExtended ?? {};
	const mana2Extended = stats.mana2Extended ?? {};
	return layouts.map((layout) => {
		if (!Array.isArray(layout) || typeof layout[0] !== 'string') {
			throw new Error('all-layouts.json contains an invalid compact layout');
		}
		const name = layout[0];
		const userId = layout[1];
		return {
			name,
			payload: {
				version: LAYOUT_DETAIL_VERSION,
				layout,
				authorName: authorById.get(userId) ?? 'Unknown',
				likeCount: likes[name] ?? 0,
				...(supplemental[name] ? { supplemental: supplemental[name] } : {}),
				stats: {
					...(stats.cmini[name] ? { cmini: stats.cmini[name] } : {}),
					...(cminiExtended[name] ? { cminiExtended: cminiExtended[name] } : {}),
					...(stats.cyanophage[name] ? { cyanophage: stats.cyanophage[name] } : {}),
					...(stats.mana2[name] ? { mana2: stats.mana2[name] } : {}),
					...(mana2Extended[name] ? { mana2Extended: mana2Extended[name] } : {})
				}
			}
		};
	});
}

export async function generateLayoutDetails() {
	const [
		layouts,
		authors,
		supplemental,
		likes,
		cmini,
		cyanophage,
		mana2,
		cminiExtended,
		mana2Extended
	] = await Promise.all([
		readJson(REQUIRED_FILES.layouts),
		readJson(REQUIRED_FILES.authors),
		readJson(REQUIRED_FILES.supplemental),
		readJson(REQUIRED_FILES.likes),
		readJson(REQUIRED_FILES.cmini),
		readJson(REQUIRED_FILES.cyanophage),
		readOptionalJson(OPTIONAL_FILES.mana2),
		readOptionalJson(OPTIONAL_FILES.cminiExtended),
		readOptionalJson(OPTIONAL_FILES.mana2Extended)
	]);

	const details = buildCompactLayoutDetails(layouts, authors, supplemental, likes, {
		cmini,
		cminiExtended,
		cyanophage,
		mana2,
		mana2Extended
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
