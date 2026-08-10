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

import { mkdir, readFile } from 'node:fs/promises';
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
	assertStatsCatalogCoverage,
	parseCorpusArgs,
	parseOfflineForceArgs,
	writeTextFileIfChanged
} from './sync-shared.js';

/**
 * @param {unknown[]} layouts
 * @param {string} corpus
 * @param {{ offline: boolean, force: boolean }} mode
 */
async function syncCorpus(layouts, corpus, mode) {
	const dumpPath = `stats/${corpus}.json`;
	const statsFile = cminiCompactStatsRelPath(corpus);
	console.log(`→ Loading cminibrowser cmini dump (${dumpPath})...`);
	const validateJson = (dump) => {
		const candidateIndex = indexCminibrowserCminiDump(dump);
		let eligible = 0;
		let loaded = 0;
		for (const layout of layouts) {
			const name = layoutEntryName(layout);
			if (!name) continue;
			eligible++;
			if (lookupCminibrowserCminiStats(candidateIndex, name)) loaded++;
		}
		assertStatsCatalogCoverage(`cminibrowser cmini ${corpus} dump`, loaded, eligible);
	};
	const { json: dump } = await ensureCminibrowserDump(dumpPath, { ...mode, validateJson });
	const index = indexCminibrowserCminiDump(dump);
	console.log(`  ✔ Indexed ${index.size} layouts from dump`);

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
	let statsLoaded = 0;
	let statsMissing = 0;

	for (const layout of layouts) {
		const name = layoutEntryName(layout);
		if (!name) continue;

		const hit = lookupCminibrowserCminiStats(index, name);
		if (!hit) {
			statsMissing++;
			continue;
		}
		layoutStats[name] = hit.compact;
		statsLoaded++;
	}
	assertStatsCatalogCoverage(
		`cminibrowser cmini ${corpus} artifact`,
		statsLoaded,
		statsLoaded + statsMissing
	);

	await mkdir('static', { recursive: true });
	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);

	const written = await writeTextFileIfChanged(statsFile, JSON.stringify(sortedStats) + '\n');

	console.log(
		`  ✔ Cmini stats for ${statsLoaded} layouts (${statsMissing} missing from dump, corpus=${corpus})`
	);
	console.log(`  ✔ ${written ? 'Wrote' : 'Unchanged'} ${statsFile}`);
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

	for (const corpus of corpora) {
		await syncCorpus(layouts, corpus, { offline, force });
	}

	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cmini-stats-sync failed:', err);
	process.exit(1);
});
