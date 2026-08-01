#!/usr/bin/env bun

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const LAYOUT_DETAIL_VERSION = 1;

const STATIC_DIR = join(process.cwd(), 'static');
const DETAILS_DIR = join(STATIC_DIR, 'layout-details');
const NAMES_FILE = join(STATIC_DIR, 'layout-names.json');

const REQUIRED_FILES = {
	layouts: join(STATIC_DIR, 'all-layouts.json'),
	authors: join(STATIC_DIR, 'authors.json'),
	inputBehaviors: join(STATIC_DIR, 'layout-input-behaviors.json'),
	likes: join(STATIC_DIR, 'layout-likes.json'),
	cmini: join(STATIC_DIR, 'layout-stats.json'),
	cyanophage: join(STATIC_DIR, 'layout-stats-cyanophage.json')
};
const OPTIONAL_FILES = {
	mana2: join(STATIC_DIR, 'layout-stats-mana2.json')
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
 * @param {Record<string, unknown>} inputBehaviors
 * @param {Record<string, number>} likes
 * @param {{cmini: Record<string, unknown>, cyanophage: Record<string, unknown>, mana2: Record<string, unknown>}} stats
 */
export function buildCompactLayoutDetails(layouts, authors, inputBehaviors, likes, stats) {
	const authorById = new Map(Object.entries(authors).map(([name, id]) => [id, name]));
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
				...(inputBehaviors[name] ? { inputBehavior: inputBehaviors[name] } : {}),
				stats: {
					...(stats.cmini[name] ? { cmini: stats.cmini[name] } : {}),
					...(stats.cyanophage[name] ? { cyanophage: stats.cyanophage[name] } : {}),
					...(stats.mana2[name] ? { mana2: stats.mana2[name] } : {})
				}
			}
		};
	});
}

export async function generateLayoutDetails() {
	const [layouts, authors, inputBehaviors, likes, cmini, cyanophage, mana2] = await Promise.all([
		readJson(REQUIRED_FILES.layouts),
		readJson(REQUIRED_FILES.authors),
		readJson(REQUIRED_FILES.inputBehaviors),
		readJson(REQUIRED_FILES.likes),
		readJson(REQUIRED_FILES.cmini),
		readJson(REQUIRED_FILES.cyanophage),
		readOptionalJson(OPTIONAL_FILES.mana2)
	]);

	const details = buildCompactLayoutDetails(layouts, authors, inputBehaviors, likes, {
		cmini,
		cyanophage,
		mana2
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
