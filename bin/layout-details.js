#!/usr/bin/env bun

import { mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
	CMINI_ANALYZER,
	DEFAULT_STATS_SPACE,
	MANA2_ANALYZER,
	apiSyncedCorpora,
	statsBoardForGeometry
} from '../src/lib/statsAnalyzers.ts';
import { KEYBOARD_GEOMETRIES } from '../src/lib/keyboardGeometry.ts';
import { cminiCompactStatsRelPath, mana2StatsRelPath } from './stats-artifact-paths.js';
import { writeTextFileIfChanged } from './sync-shared.js';

export const LAYOUT_DETAIL_VERSION = 5;

const DETAIL_WRITE_CONCURRENCY = 32;

const CMINI_CORPORA = apiSyncedCorpora(CMINI_ANALYZER);
const MANA2_CORPORA = apiSyncedCorpora(MANA2_ANALYZER);

const STATIC_DIR = join(process.cwd(), 'static');
const DETAILS_DIR = join(STATIC_DIR, 'layout-details');
const NAMES_FILE = join(STATIC_DIR, 'layout-names.json');

const REQUIRED_FILES = {
	layouts: join(STATIC_DIR, 'all-layouts.json'),
	authors: join(STATIC_DIR, 'authors.json'),
	supplemental: join(STATIC_DIR, 'layout-supplemental.json'),
	likes: join(STATIC_DIR, 'layout-likes.json'),
	cyanophageColumn: join(STATIC_DIR, 'layout-stats-cyanophage-column-stagger.json'),
	cyanophageRow: join(STATIC_DIR, 'layout-stats-cyanophage-row-stagger.json')
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
 * @template T
 * @param {readonly T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} work
 */
async function forEachConcurrent(items, concurrency, work) {
	let next = 0;
	const workerCount = Math.min(Math.max(1, concurrency), items.length);
	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (next < items.length) {
				const index = next++;
				await work(items[index]);
			}
		})
	);
}

/**
 * @param {unknown[]} layouts
 * @param {Record<string, string | number>} authors
 * @param {Record<string, unknown>} supplemental
 * @param {Record<string, number>} likes
 * @param {{
 *   cmini: Record<'column-stagger' | 'row-stagger', Record<string, Record<string, unknown>>>,
 *   cyanophage: Record<'column-stagger' | 'row-stagger', Record<string, unknown>>,
 *   mana2: Record<'column-stagger' | 'row-stagger', Record<string, Record<string, unknown>>>
 * }} stats
 */
export function buildCompactLayoutDetails(layouts, authors, supplemental, likes, stats) {
	const authorById = new Map(Object.entries(authors).map(([name, id]) => [String(id), name]));
	return layouts.map((layout) => {
		if (!Array.isArray(layout) || typeof layout[0] !== 'string') {
			throw new Error('all-layouts.json contains an invalid compact layout');
		}
		const name = layout[0];
		const userId = String(layout[1]);
		/** @param {Record<string, Record<string, Record<string, unknown>>>} geometryStats */
		const selectGeometryStats = (geometryStats) =>
			Object.fromEntries(
				Object.entries(geometryStats).flatMap(([geometry, corpusStats]) => {
					const selectedCorpora = Object.fromEntries(
						Object.entries(corpusStats).flatMap(([corpus, map]) =>
							Object.hasOwn(map, name) && map[name] !== undefined ? [[corpus, map[name]]] : []
						)
					);
					return Object.keys(selectedCorpora).length === 0 ? [] : [[geometry, selectedCorpora]];
				})
			);
		const cmini = selectGeometryStats(stats.cmini);
		const mana2 = selectGeometryStats(stats.mana2);
		const cyanophage = Object.fromEntries(
			Object.entries(stats.cyanophage).flatMap(([geometry, map]) =>
				Object.hasOwn(map, name) && map[name] !== undefined ? [[geometry, map[name]]] : []
			)
		);
		const likeCount = Object.hasOwn(likes, name) ? likes[name] : 0;
		const supplementalEntry = Object.hasOwn(supplemental, name) ? supplemental[name] : undefined;
		return {
			name,
			payload: {
				version: LAYOUT_DETAIL_VERSION,
				layout,
				authorName: authorById.get(userId) ?? 'Unknown',
				likeCount,
				...(supplementalEntry ? { supplemental: supplementalEntry } : {}),
				stats: {
					...(Object.keys(cmini).length > 0 ? { cmini } : {}),
					...(Object.keys(cyanophage).length > 0 ? { cyanophage } : {}),
					...(Object.keys(mana2).length > 0 ? { mana2 } : {})
				}
			}
		};
	});
}

export async function generateLayoutDetails() {
	const [layouts, authors, supplemental, likes, cyanophageColumn, cyanophageRow] =
		await Promise.all([
			readJson(REQUIRED_FILES.layouts),
			readJson(REQUIRED_FILES.authors),
			readJson(REQUIRED_FILES.supplemental),
			readJson(REQUIRED_FILES.likes),
			readJson(REQUIRED_FILES.cyanophageColumn),
			readJson(REQUIRED_FILES.cyanophageRow)
		]);
	const cminiEntries = await Promise.all(
		KEYBOARD_GEOMETRIES.map(async (geometry) => {
			const board = statsBoardForGeometry(geometry);
			const corpora = await Promise.all(
				CMINI_CORPORA.map(async (corpus) => [
					corpus,
					await readOptionalJson(
						join(process.cwd(), cminiCompactStatsRelPath(corpus, board, DEFAULT_STATS_SPACE))
					)
				])
			);
			return [geometry, Object.fromEntries(corpora)];
		})
	);
	const mana2Entries = await Promise.all(
		KEYBOARD_GEOMETRIES.map(async (geometry) => {
			const board = statsBoardForGeometry(geometry);
			const corpora = await Promise.all(
				MANA2_CORPORA.map(async (corpus) => [
					corpus,
					await readOptionalJson(
						join(process.cwd(), mana2StatsRelPath(corpus, board, DEFAULT_STATS_SPACE))
					)
				])
			);
			return [geometry, Object.fromEntries(corpora)];
		})
	);

	const details = buildCompactLayoutDetails(layouts, authors, supplemental, likes, {
		cmini: Object.fromEntries(cminiEntries),
		cyanophage: {
			'column-stagger': cyanophageColumn,
			'row-stagger': cyanophageRow
		},
		mana2: Object.fromEntries(mana2Entries)
	});
	await mkdir(DETAILS_DIR, { recursive: true });

	const expectedFiles = new Set();
	let written = 0;
	const detailTargets = details.map(({ name, payload }) => {
		const filename = `${layoutDetailFileId(name)}.json`;
		expectedFiles.add(filename);
		return { filename, body: JSON.stringify(payload) + '\n' };
	});
	await forEachConcurrent(detailTargets, DETAIL_WRITE_CONCURRENCY, async ({ filename, body }) => {
		if (await writeTextFileIfChanged(join(DETAILS_DIR, filename), body)) written++;
	});

	const staleFiles = (await readdir(DETAILS_DIR)).filter(
		(filename) => filename.endsWith('.json') && !expectedFiles.has(filename)
	);
	await forEachConcurrent(staleFiles, DETAIL_WRITE_CONCURRENCY, async (filename) => {
		await unlink(join(DETAILS_DIR, filename));
	});
	const removed = staleFiles.length;

	const names = details.map(({ name }) => name);
	const namesChanged = await writeTextFileIfChanged(NAMES_FILE, JSON.stringify(names) + '\n');
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
