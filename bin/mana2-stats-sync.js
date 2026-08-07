#!/usr/bin/env bun

/**
 * Import Mana2 stats from cminibrowser named dumps into corpus/board/space-labeled
 * static artifacts.
 *
 * Requires a prior catalog-sync (`static/all-layouts.json`).
 * Use --offline to reuse a cached dump under `.cache/cminibrowser/`.
 * Use --force to re-download the dump even when a cache file exists.
 * Use --corpus=NAME (or MANA2_STATS_CORPUS) to sync one corpus; otherwise
 * sync every dump-backed Mana2 corpus from the frontend catalog.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { MANA2_ANALYZER, dumpSyncedCorpora } from '../src/lib/statsAnalyzers.ts';
import { readCminibrowserJson } from './cminibrowser-cache.js';
import {
	CMINIBROWSER_MANA2_DEFAULT_BOARD,
	CMINIBROWSER_MANA2_DEFAULT_SPACE,
	cminibrowserMana2NamedDumpPath,
	indexCminibrowserMana2Dump,
	lookupCminibrowserMana2Stats
} from './cminibrowser-mana2-stats.js';
import { layoutEntryName } from './layout-codec.js';
import { mana2ExtendedStatsRelPath, mana2StatsRelPath } from './stats-artifact-paths.js';
import {
	LAYOUTS_FILE,
	loadBlacklist,
	parseCorpusArgs,
	parseOfflineForceArgs
} from './sync-shared.js';

const MANA2_STATS_BOARD = process.env.MANA2_STATS_BOARD ?? CMINIBROWSER_MANA2_DEFAULT_BOARD;
const MANA2_STATS_SPACE = process.env.MANA2_STATS_SPACE ?? CMINIBROWSER_MANA2_DEFAULT_SPACE;

/**
 * @param {unknown[]} layouts
 * @param {Set<string>} blacklist
 * @param {string} corpus
 * @param {{ offline: boolean, force: boolean }} mode
 */
async function syncCorpus(layouts, blacklist, corpus, mode) {
	const dumpPath = cminibrowserMana2NamedDumpPath(corpus, MANA2_STATS_BOARD, MANA2_STATS_SPACE);
	console.log(`→ Loading cminibrowser mana2 dump (${dumpPath})...`);
	const dump = await readCminibrowserJson(dumpPath, mode);
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
	const statsFile = mana2StatsRelPath(corpus, MANA2_STATS_BOARD, MANA2_STATS_SPACE);
	const extendedFile = mana2ExtendedStatsRelPath(corpus, MANA2_STATS_BOARD, MANA2_STATS_SPACE);

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
		`  ✔ Mana2 stats for ${statsLoaded} layouts (${statsMissing} missing from dump, ${blacklisted} blacklisted, corpus=${corpus})`
	);
	console.log(`  ✔ Wrote ${statsFile}`);
	console.log(`  ✔ Extended mana2 stats for show pages → ${extendedFile}`);
}

async function run() {
	const argv = process.argv.slice(2);
	const { offline, force } = parseOfflineForceArgs(argv, {
		offlineEnv: 'MANA2_STATS_SYNC_OFFLINE',
		forceEnv: 'MANA2_STATS_SYNC_FORCE'
	});
	const corpora = parseCorpusArgs(argv, {
		env: 'MANA2_STATS_CORPUS',
		defaultCorpora: dumpSyncedCorpora(MANA2_ANALYZER)
	});

	console.log(`→ Loading layouts from ${LAYOUTS_FILE}`);
	/** @type {unknown[]} */
	const layouts = JSON.parse(await readFile(LAYOUTS_FILE, 'utf-8'));
	const blacklist = await loadBlacklist();

	for (const corpus of corpora) {
		await syncCorpus(layouts, blacklist, corpus, { offline, force });
	}

	console.log('Done');
}

run().catch((err) => {
	console.error('❌ mana2-stats-sync failed:', err);
	process.exit(1);
});
