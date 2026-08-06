#!/usr/bin/env bun

/**
 * Import Mana2 stats from cminibrowser named dumps into corpus/board/space-labeled
 * static artifacts. The local Go Mana2 CLI path is retained in-repo for a follow-up
 * removal commit; this sync no longer invokes it.
 *
 * Requires a prior cmini-sync (`static/all-layouts.json`).
 * Use --offline to reuse a cached dump under `.cache/cminibrowser/`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readCminibrowserJson } from './cminibrowser-cache.js';
import {
	CMINIBROWSER_MANA2_DEFAULT_BOARD,
	CMINIBROWSER_MANA2_DEFAULT_CORPUS,
	CMINIBROWSER_MANA2_DEFAULT_SPACE,
	cminibrowserMana2NamedDumpPath,
	indexCminibrowserMana2Dump,
	lookupCminibrowserMana2Stats
} from './cminibrowser-mana2-stats.js';
import { layoutEntryName } from './layout-codec.js';
import { mana2ExtendedStatsRelPath, mana2StatsRelPath } from './stats-artifact-paths.js';

const LAYOUTS_FILE = 'static/all-layouts.json';
const BLACKLIST_FILE = 'layout-blacklist.txt';

const MANA2_STATS_CORPUS = process.env.MANA2_STATS_CORPUS ?? CMINIBROWSER_MANA2_DEFAULT_CORPUS;
const MANA2_STATS_BOARD = process.env.MANA2_STATS_BOARD ?? CMINIBROWSER_MANA2_DEFAULT_BOARD;
const MANA2_STATS_SPACE = process.env.MANA2_STATS_SPACE ?? CMINIBROWSER_MANA2_DEFAULT_SPACE;

async function loadBlacklist() {
	try {
		const content = await readFile(BLACKLIST_FILE, 'utf-8');
		/** @type {Set<string>} */
		const blacklist = new Set();
		for (const line of content.split('\n')) {
			const entry = line.trim();
			if (!entry || entry.startsWith('#')) continue;
			blacklist.add(entry);
			blacklist.add(entry.replace(/\.json$/i, ''));
			if (!entry.endsWith('.json')) blacklist.add(`${entry}.json`);
		}
		return blacklist;
	} catch {
		return new Set();
	}
}

async function run() {
	const offline = process.argv.includes('--offline') || process.env.MANA2_SYNC_OFFLINE === '1';

	console.log(`→ Loading layouts from ${LAYOUTS_FILE}`);
	/** @type {unknown[]} */
	const layouts = JSON.parse(await readFile(LAYOUTS_FILE, 'utf-8'));
	const blacklist = await loadBlacklist();

	const dumpPath = cminibrowserMana2NamedDumpPath(
		MANA2_STATS_CORPUS,
		MANA2_STATS_BOARD,
		MANA2_STATS_SPACE
	);
	console.log(`→ Loading cminibrowser mana2 dump (${dumpPath})...`);
	const dump = await readCminibrowserJson(dumpPath, { offline });
	const index = indexCminibrowserMana2Dump(dump);
	console.log(`  ✔ Indexed ${index.size} layouts from dump`);

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
	/** @type {Record<string, Record<string, unknown>>} */
	const layoutStatsExtended = {};
	let statsLoaded = 0;
	let statsMissing = 0;
	let blacklisted = 0;

	for (const layout of layouts) {
		const name = layoutEntryName(layout);
		if (!name) continue;
		if (blacklist.has(name) || blacklist.has(`${name}.json`)) {
			blacklisted++;
			continue;
		}

		const hit = lookupCminibrowserMana2Stats(index, name);
		if (!hit) {
			statsMissing++;
			continue;
		}
		layoutStats[name] = hit.compact;
		layoutStatsExtended[name] = hit.extended;
		statsLoaded++;
	}

	await mkdir('static', { recursive: true });
	const statsFile = mana2StatsRelPath(MANA2_STATS_CORPUS, MANA2_STATS_BOARD, MANA2_STATS_SPACE);
	const extendedFile = mana2ExtendedStatsRelPath(
		MANA2_STATS_CORPUS,
		MANA2_STATS_BOARD,
		MANA2_STATS_SPACE
	);

	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);
	const sortedExtended = Object.fromEntries(
		Object.keys(layoutStatsExtended)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStatsExtended[name]])
	);

	await writeFile(statsFile, JSON.stringify(sortedStats) + '\n', 'utf-8');
	await writeFile(extendedFile, JSON.stringify(sortedExtended) + '\n', 'utf-8');

	console.log(
		`  ✔ Mana2 stats for ${statsLoaded} layouts (${statsMissing} missing from dump, ${blacklisted} blacklisted)`
	);
	console.log(`  ✔ Wrote ${statsFile}`);
	console.log(`  ✔ Extended mana2 stats for show pages → ${extendedFile}`);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ mana2-sync failed:', err);
	process.exit(1);
});
