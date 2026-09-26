#!/usr/bin/env bun

/**
 * Import Mana2 stats from the supported akl.gg stats/v1 API into corpus/board/space-labeled
 * static artifacts.
 *
 * Requires a prior catalog-sync (`static/all-layouts.json`).
 * Use --offline to reuse cached per-layout objects under `.cache/akl-stats-v1/`.
 * Use --force to re-download the objects even when their revisions match.
 * Use --corpus=NAME (or MANA2_STATS_CORPUS) to sync one corpus; otherwise
 * sync every API-backed Mana2 corpus from the frontend catalog.
 *
 * Writes compact catalog artifacts only. Full API objects stay in the local
 * akl.gg stats cache for diagnostics — they are not published under static/.
 */

import { mkdir, readFile } from 'node:fs/promises';
import { KEYBOARD_GEOMETRIES } from '../src/lib/keyboardGeometry.ts';
import {
	DEFAULT_STATS_SPACE,
	MANA2_ANALYZER,
	apiSyncedCorpora,
	statsBoardForGeometry
} from '../src/lib/statsAnalyzers.ts';
import { ensureAklStatsLayouts, getAklStatsCell } from './akl-stats-v1.js';
import { encodeCminibrowserMana2Stats } from './cminibrowser-mana2-stats.js';
import { readCachedAkldbLayouts } from './akldb-cache.js';
import { layoutEntryName } from './layout-codec.js';
import { mana2StatsRelPath } from './stats-artifact-paths.js';
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
	const statsFile = mana2StatsRelPath(corpus, board, DEFAULT_STATS_SPACE);
	console.log(
		`→ Encoding AKL Mana2 stats/v1 cells (corpus=${corpus}, geometry=${geometry}, board=${board}, space=${DEFAULT_STATS_SPACE})...`
	);

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
	let statsLoaded = 0;
	let statsMissing = 0;

	for (const layout of eligibleLayouts) {
		const object = objects.get(layout.id);
		const cell = getAklStatsCell(object, 'mana2', `${corpus}.${board}.${DEFAULT_STATS_SPACE}`);
		const compact = encodeCminibrowserMana2Stats(cell);
		if (!compact) {
			statsMissing++;
			continue;
		}
		layoutStats[layout.name] = compact;
		statsLoaded++;
	}
	assertStatsCatalogCoverage(`AKL Mana2 ${corpus} artifact`, statsLoaded, eligibleLayouts.length);

	await mkdir('static', { recursive: true });

	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);

	const written = await writeTextFileIfChanged(statsFile, JSON.stringify(sortedStats) + '\n');

	console.log(
		`  ✔ Mana2 stats for ${statsLoaded} layouts (${statsMissing} missing, corpus=${corpus}, geometry=${geometry})`
	);
	console.log(`  ✔ ${written ? 'Wrote' : 'Unchanged'} ${statsFile}`);
}

async function run() {
	const argv = process.argv.slice(2);
	const { offline, force } = parseOfflineForceArgs(argv, {
		offlineEnv: 'MANA2_STATS_SYNC_OFFLINE',
		forceEnv: 'MANA2_STATS_SYNC_FORCE'
	});
	const corpora = parseCorpusArgs(argv, {
		env: 'MANA2_STATS_CORPUS',
		defaultCorpora: apiSyncedCorpora(MANA2_ANALYZER)
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
	}

	console.log('Done');
}

run().catch((err) => {
	console.error('❌ mana2-stats-sync failed:', err);
	process.exit(1);
});
