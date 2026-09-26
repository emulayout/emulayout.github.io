#!/usr/bin/env bun

/**
 * Compute Cyanophage effort stats for layouts in the AKLDB catalog cache.
 *
 * AKLDB layouts are geometry-neutral. Publish one artifact for each supported
 * viewer geometry so the frontend can switch without conflating presentation with layout identity.
 */

import { access, mkdir } from 'node:fs/promises';
import {
	buildCyanophageStats,
	CYANOPHAGE_ANALYZER,
	loadCyanophageData
} from './cyanophage-stats.js';
import { defaultMagicMappings } from './layout-features.js';
import { isExcludedLayout, loadMemeFilterExclusions } from './cminibrowser-meme-filter.js';
import { parseOfflineForceArgs, writeTextFileIfChanged } from './sync-shared.js';
import { readCachedAkldbLayouts } from './akldb-cache.js';
import { supplementalFromAkldbLayout } from './akldb-spark.js';

const GEOMETRIES = ['column-stagger', 'row-stagger'];
const cyanophageStatsFile = (geometry) => `static/layout-stats-cyanophage-${geometry}.json`;

async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

async function run() {
	const skipIfCatalogUnchanged =
		process.env.CYANOPHAGE_SKIP_IF_CATALOG_UNCHANGED === '1' &&
		process.env.CATALOG_REBUILT === 'false';
	if (
		skipIfCatalogUnchanged &&
		(
			await Promise.all(GEOMETRIES.map((geometry) => pathExists(cyanophageStatsFile(geometry))))
		).every(Boolean)
	) {
		console.log('✔ Catalog unchanged; keeping existing Cyanophage geometry stats');
		console.log('Done');
		return;
	}

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

	/**
	 * @param {import('./akldb-cache.js').AkldbLayout} layout
	 */
	function processLayout(layout, geometry) {
		if (isExcludedLayout(layout.name, excludedLayouts)) {
			return null;
		}

		const rawLayout = { name: layout.name, user: layout.owner, geometry, keys: {} };
		for (const key of layout.keys) {
			if (key.char) {
				rawLayout.keys[key.char] = { row: key.row, col: key.col, finger: key.finger };
			}
		}
		const variants = supplementalFromAkldbLayout(layout).supplemental?.variants ?? [];
		const cyanStats = buildCyanophageStats(rawLayout, cyanophageData, {
			magicMappings: defaultMagicMappings(variants)
		});
		if (!cyanStats) return { name: rawLayout.name, stats: null };
		return { name: rawLayout.name, stats: cyanStats };
	}

	for (const geometry of GEOMETRIES) {
		/** @type {Record<string, number[]>} */
		const cyanophageStats = {};
		let loaded = 0;
		let skipped = 0;
		console.log(`→ Computing Cyanophage ${geometry} stats for ${layouts.length} layouts...`);
		for (const layout of layouts) {
			try {
				const result = processLayout(layout, geometry);
				if (!result) continue;
				if (result.stats) {
					cyanophageStats[result.name] = result.stats;
					loaded++;
				} else {
					skipped++;
				}
			} catch (err) {
				console.error(`  ⚠ Error processing ${layout.name}:`, err.message);
			}
		}

		await mkdir('static', { recursive: true });
		const sorted = Object.fromEntries(
			Object.keys(cyanophageStats)
				.sort((a, b) => a.localeCompare(b))
				.map((name) => [name, cyanophageStats[name]])
		);
		const outputFile = cyanophageStatsFile(geometry);
		await writeTextFileIfChanged(outputFile, JSON.stringify(sorted) + '\n');
		console.log(`  ✔ ${loaded} layouts (${skipped} skipped) → ${outputFile}`);
	}
	console.log(`  ✔ ${filtered} meme-filtered layouts`);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cyanophage-stats-sync failed:', err);
	process.exit(1);
});
