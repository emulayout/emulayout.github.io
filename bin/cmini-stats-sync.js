#!/usr/bin/env bun

/**
 * Import cmini analyzer stats from cminibrowser corpus dumps.
 *
 * Requires a prior catalog-sync (`static/all-layouts.json`).
 * Use --offline to reuse a cached dump under `.cache/cminibrowser/`.
 * Use --force to re-download the dump even when a cache file exists.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readCminibrowserJson } from './cminibrowser-cache.js';
import {
	CMINIBROWSER_CMINI_DEFAULT_CORPUS,
	indexCminibrowserCminiDump,
	lookupCminibrowserCminiStats
} from './cminibrowser-cmini-stats.js';
import { layoutEntryName } from './layout-codec.js';
import { cminiCompactStatsRelPath, cminiExtendedStatsRelPath } from './stats-artifact-paths.js';
import { LAYOUTS_FILE, loadBlacklist, parseOfflineForceArgs } from './sync-shared.js';

const CMINI_STATS_CORPUS =
	process.env.CMINIBROWSER_CMINI_CORPUS ?? CMINIBROWSER_CMINI_DEFAULT_CORPUS;

async function run() {
	const { offline, force } = parseOfflineForceArgs(process.argv.slice(2), {
		offlineEnv: 'CMINI_STATS_SYNC_OFFLINE',
		forceEnv: 'CMINI_STATS_SYNC_FORCE'
	});

	console.log(`→ Loading layouts from ${LAYOUTS_FILE}`);
	/** @type {unknown[]} */
	const layouts = JSON.parse(await readFile(LAYOUTS_FILE, 'utf-8'));
	const blacklist = await loadBlacklist();

	const dumpPath = `stats/${CMINI_STATS_CORPUS}.json`;
	console.log(`→ Loading cminibrowser cmini dump (${dumpPath})...`);
	const dump = await readCminibrowserJson(dumpPath, { offline, force });
	const index = indexCminibrowserCminiDump(dump);
	console.log(`  ✔ Indexed ${index.size} layouts from dump`);

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
	/** @type {Record<string, import('./cminibrowser-cmini-stats.js').CminibrowserCminiExtendedStats>} */
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

		const hit = lookupCminibrowserCminiStats(index, name);
		if (!hit) {
			statsMissing++;
			continue;
		}
		layoutStats[name] = hit.compact;
		if (hit.extended) layoutStatsExtended[name] = hit.extended;
		statsLoaded++;
	}

	await mkdir('static', { recursive: true });
	const statsFile = cminiCompactStatsRelPath(CMINI_STATS_CORPUS);
	const extendedFile = cminiExtendedStatsRelPath(CMINI_STATS_CORPUS);
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
		`  ✔ Cmini stats for ${statsLoaded} layouts (${statsMissing} missing from dump, ${blacklisted} blacklisted, corpus=${CMINI_STATS_CORPUS})`
	);
	console.log(`  ✔ Wrote ${statsFile}`);
	console.log(`  ✔ Extended cmini stats for show pages → ${extendedFile}`);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cmini-stats-sync failed:', err);
	process.exit(1);
});
