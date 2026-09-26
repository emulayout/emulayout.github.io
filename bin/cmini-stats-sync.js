#!/usr/bin/env bun

/**
 * Import cmini analyzer stats from the supported akl.gg stats/v1 API.
 *
 * Requires a prior catalog-sync (`static/all-layouts.json`).
 * Use --offline to reuse cached per-layout objects under `.cache/akl-stats-v1/`.
 * Use --force to re-download the objects even when their revisions match.
 * Use --corpus=NAME (or CMINIBROWSER_CMINI_CORPUS) to sync one corpus; otherwise
 * sync every API-backed cmini corpus from the frontend catalog.
 *
 * Writes compact catalog artifacts only. Full API objects stay in the local
 * akl.gg stats cache for diagnostics — they are not published under static/.
 */

import { mkdir, readFile, unlink } from 'node:fs/promises';
import { KEYBOARD_GEOMETRIES } from '../src/lib/keyboardGeometry.ts';
import {
	CMINI_ANALYZER,
	DEFAULT_STATS_SPACE,
	apiSyncedCorpora,
	statsBoardForGeometry
} from '../src/lib/statsAnalyzers.ts';
import { ensureAklStatsLayouts, getAklStatsCell } from './akl-stats-v1.js';
import { encodeCminibrowserCminiStats } from './cminibrowser-cmini-stats.js';
import { readCachedAkldbLayouts } from './akldb-cache.js';
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
 * @param {import('./akldb-cache.js').AkldbLayout[]} eligibleLayouts
 * @param {ReadonlyMap<string, Record<string, unknown>>} objects
 * @param {string} corpus
 * @param {import('../src/lib/keyboardGeometry.ts').KeyboardGeometry} geometry
 */
async function syncContext(eligibleLayouts, objects, corpus, geometry) {
	const board = statsBoardForGeometry(geometry);
	const statsFile = cminiCompactStatsRelPath(corpus, board, DEFAULT_STATS_SPACE);
	console.log(
		`→ Encoding AKL cmini stats/v1 cells (corpus=${corpus}, geometry=${geometry}, board=${board})...`
	);

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
	let statsLoaded = 0;
	let statsMissing = 0;

	for (const layout of eligibleLayouts) {
		const object = objects.get(layout.id);
		const cell = getAklStatsCell(object, 'cmini', `${corpus}.${board}.${DEFAULT_STATS_SPACE}`);
		const compact = encodeCminibrowserCminiStats(cell);
		if (!compact) {
			statsMissing++;
			continue;
		}
		layoutStats[layout.name] = compact;
		statsLoaded++;
	}
	assertStatsCatalogCoverage(`AKL cmini ${corpus} artifact`, statsLoaded, eligibleLayouts.length);

	await mkdir('static', { recursive: true });
	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);

	const written = await writeTextFileIfChanged(statsFile, JSON.stringify(sortedStats) + '\n');

	console.log(
		`  ✔ Cmini stats for ${statsLoaded} layouts (${statsMissing} missing, corpus=${corpus}, geometry=${geometry})`
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
		defaultCorpora: apiSyncedCorpora(CMINI_ANALYZER)
	});

	console.log(`→ Loading layouts from ${LAYOUTS_FILE}`);
	/** @type {unknown[]} */
	const publishedLayouts = JSON.parse(await readFile(LAYOUTS_FILE, 'utf-8'));
	const { layouts: akldbLayouts } = await readCachedAkldbLayouts();
	const publishedNames = new Set(publishedLayouts.map(layoutEntryName));
	const eligibleLayouts = akldbLayouts.filter((layout) => publishedNames.has(layout.name));
	console.log('→ Loading matching akl.gg stats/v1 layout objects...');
	const { objects, downloaded } = await ensureAklStatsLayouts(eligibleLayouts, { offline, force });
	console.log(`  ✔ ${objects.size} matching layout objects (${downloaded} downloaded)`);

	for (const corpus of corpora) {
		for (const geometry of KEYBOARD_GEOMETRIES) {
			await syncContext(eligibleLayouts, objects, corpus, geometry);
		}
		const legacyFile = `static/layout-stats-cmini-${corpus}.json`;
		try {
			await unlink(legacyFile);
			console.log(`  ✔ Removed obsolete ${legacyFile}`);
		} catch (error) {
			if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
		}
	}

	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cmini-stats-sync failed:', err);
	process.exit(1);
});
