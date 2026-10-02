#!/usr/bin/env bun

/**
 * Compute Cyanophage effort stats for layouts in the AKLDB catalog cache.
 *
 * AKLDB layouts are geometry-neutral. Publish one artifact for each supported
 * viewer geometry so the frontend can switch without conflating presentation with layout identity.
 */

import { mkdir } from 'node:fs/promises';
import {
	cyanophageAnalyzerFingerprint,
	openCyanophageStatsCache
} from './cyanophage-stats-cache.js';
import {
	buildCyanophageStats,
	CYANOPHAGE_ANALYZER,
	loadCyanophageData
} from './cyanophage-stats.js';
import { isExcludedLayout, loadMemeFilterExclusions } from './cminibrowser-meme-filter.js';
import { parseOfflineForceArgs, writeTextFileIfChanged } from './sync-shared.js';
import { readCachedAkldbLayouts } from './akldb-cache.js';
import { supplementalFromAkldbLayout } from './akldb-spark.js';

const GEOMETRIES = ['column-stagger', 'row-stagger'];
const cyanophageStatsFile = (geometry) => `static/layout-stats-cyanophage-${geometry}.json`;

async function run() {
	console.log('→ Loading AKLDB layouts cache...');
	const { layouts } = await readCachedAkldbLayouts();

	console.log(`→ Loading ${CYANOPHAGE_ANALYZER} analyzer data...`);
	const cyanophageData = await loadCyanophageData();

	const { offline, force } = parseOfflineForceArgs(process.argv.slice(2), {
		offlineEnv: 'CYANOPHAGE_SYNC_OFFLINE',
		forceEnv: 'CYANOPHAGE_SYNC_FORCE'
	});
	console.log('→ Loading AKL inputs...');
	const memeFilter = await loadMemeFilterExclusions({ layouts, offline, force });
	const excludedLayouts = memeFilter.excluded;
	console.log(`  ✔ Excluding ${memeFilter.size} meme-tier layouts (corpus=${memeFilter.corpus})`);

	const filtered = layouts.filter((layout) =>
		isExcludedLayout(layout.name, excludedLayouts)
	).length;
	const eligible = layouts.filter((layout) => !isExcludedLayout(layout.name, excludedLayouts));
	const cache = await openCyanophageStatsCache({
		fingerprint: await cyanophageAnalyzerFingerprint(),
		force: force || process.argv.includes('--recompute')
	});

	/**
	 * @param {import('./akldb-cache.js').AkldbLayout} layout
	 */
	function processLayout(layout, geometry) {
		const rawLayout = { name: layout.name, user: layout.owner, geometry, keys: {} };
		for (const key of layout.keys) {
			if (key.char) {
				rawLayout.keys[key.char] = { row: key.row, col: key.col, finger: key.finger };
			}
		}
		const magicMappings = supplementalFromAkldbLayout(layout).analyzerMappings;
		return cache.getOrCompute({ geometry, keys: rawLayout.keys, magicMappings }, () =>
			buildCyanophageStats(rawLayout, cyanophageData, { magicMappings })
		);
	}

	for (const geometry of GEOMETRIES) {
		/** @type {Record<string, number[]>} */
		const cyanophageStats = {};
		let loaded = 0;
		let skipped = 0;
		let cached = 0;
		let computed = 0;
		let checkpoint = 0;
		console.log(
			`→ Resolving Cyanophage ${geometry} stats for ${eligible.length} eligible layouts (cache enabled)...`
		);
		for (const layout of eligible) {
			try {
				const result = processLayout(layout, geometry);
				if (result.cached) cached++;
				else computed++;
				if (result.stats) {
					cyanophageStats[layout.name] = result.stats;
					loaded++;
				} else {
					skipped++;
				}
			} catch (err) {
				console.error(`  ⚠ Error processing ${layout.name}:`, err.message);
			}
			// Preserve completed work if a long cold run is interrupted.
			if (computed - checkpoint >= 100) {
				await cache.save();
				checkpoint = computed;
			}
		}
		await cache.save();

		await mkdir('static', { recursive: true });
		const sorted = Object.fromEntries(
			Object.keys(cyanophageStats)
				.sort((a, b) => a.localeCompare(b))
				.map((name) => [name, cyanophageStats[name]])
		);
		const outputFile = cyanophageStatsFile(geometry);
		await writeTextFileIfChanged(outputFile, JSON.stringify(sorted) + '\n');
		console.log(
			`  ✔ ${cached} cached, ${computed} computed; ${loaded} layouts (${skipped} skipped) → ${outputFile}`
		);
	}
	console.log(`  ✔ ${filtered} meme-filtered layouts`);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cyanophage-stats-sync failed:', err);
	process.exit(1);
});
