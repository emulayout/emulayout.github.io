#!/usr/bin/env bun

/**
 * Import cmini analyzer stats from cminibrowser corpus dumps.
 *
 * Requires a prior catalog-sync (`static/all-layouts.json`).
 * Use --offline to reuse a cached dump under `.cache/cminibrowser/`.
 * Use --force to re-download the dump even when a cache file exists.
 * Use --corpus=NAME (or CMINIBROWSER_CMINI_CORPUS) to sync one corpus; otherwise
 * sync every dump-backed cmini corpus from the frontend catalog.
 *
 * Writes compact catalog artifacts only. Full dump fields stay in the local
 * cminibrowser cache for diagnostics — they are not published under static/.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { CMINI_ANALYZER, dumpSyncedCorpora } from '../src/lib/statsAnalyzers.ts';
import { ensureCminibrowserDump } from './cminibrowser-cache.js';
import {
	indexCminibrowserCminiDump,
	lookupCminibrowserCminiStats
} from './cminibrowser-cmini-stats.js';
import { layoutEntryName } from './layout-codec.js';
import { cminiCompactStatsRelPath } from './stats-artifact-paths.js';
import {
	LAYOUTS_FILE,
	loadBlacklist,
	parseCorpusArgs,
	parseOfflineForceArgs
} from './sync-shared.js';

/**
 * @param {string} path
 */
async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

/**
 * @param {unknown[]} layouts
 * @param {Set<string>} blacklist
 * @param {string} corpus
 * @param {{ offline: boolean, force: boolean }} mode
 */
async function syncCorpus(layouts, blacklist, corpus, mode) {
	const dumpPath = `stats/${corpus}.json`;
	const statsFile = cminiCompactStatsRelPath(corpus);
	console.log(`→ Loading cminibrowser cmini dump (${dumpPath})...`);
	const { path: cachePath, updated } = await ensureCminibrowserDump(dumpPath, mode);
	if (!updated && !mode.force && !mode.offline && (await pathExists(statsFile))) {
		console.log(`  ✔ Dump unchanged; keeping ${statsFile}`);
		return;
	}

	const dump = JSON.parse(await readFile(cachePath, 'utf-8'));
	const index = indexCminibrowserCminiDump(dump);
	console.log(`  ✔ Indexed ${index.size} layouts from dump`);

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
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

		const hit = lookupCminibrowserCminiStats(index, name);
		if (!hit) {
			statsMissing++;
			continue;
		}
		layoutStats[name] = hit.compact;
		statsLoaded++;
	}

	await mkdir('static', { recursive: true });
	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);

	await writeFile(statsFile, JSON.stringify(sortedStats) + '\n', 'utf-8');

	console.log(
		`  ✔ Cmini stats for ${statsLoaded} layouts (${statsMissing} missing from dump, ${blacklisted} blacklisted, corpus=${corpus})`
	);
	console.log(`  ✔ Wrote ${statsFile}`);
}

async function run() {
	const argv = process.argv.slice(2);
	const { offline, force } = parseOfflineForceArgs(argv, {
		offlineEnv: 'CMINI_STATS_SYNC_OFFLINE',
		forceEnv: 'CMINI_STATS_SYNC_FORCE'
	});
	const corpora = parseCorpusArgs(argv, {
		env: 'CMINIBROWSER_CMINI_CORPUS',
		defaultCorpora: dumpSyncedCorpora(CMINI_ANALYZER)
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
	console.error('❌ cmini-stats-sync failed:', err);
	process.exit(1);
});
