#!/usr/bin/env bun

/**
 * Compute Cyanophage effort stats for layouts in the Clemenpine catalog cache.
 *
 * Requires a prior catalog-sync so `.cache/clemenpine/layouts-full.json` exists.
 * Reads canonical Magic mappings from AKL when present.
 */

import { access, mkdir } from 'node:fs/promises';
import {
	loadCminibrowserMagicRules,
	supplementalByLowerLayoutId
} from './cminibrowser-magic-rules.js';
import {
	buildCyanophageStats,
	CYANOPHAGE_ANALYZER,
	loadCyanophageData
} from './cyanophage-stats.js';
import { defaultMagicMappings } from './layout-features.js';
import { isExcludedLayout, loadMemeFilterExclusions } from './cminibrowser-meme-filter.js';
import { parseOfflineForceArgs, writeTextFileIfChanged } from './sync-shared.js';
import { readCachedClemenpineLayouts } from './clemenpine-cache.js';

const CYANOPHAGE_STATS_FILE = 'static/layout-stats-cyanophage.json';

async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

async function run() {
	const skipIfCatalogUnchanged =
		process.env.CYANOPHAGE_SKIP_IF_CATALOG_UNCHANGED === '1' &&
		process.env.CATALOG_REBUILT === 'false';
	if (skipIfCatalogUnchanged && (await pathExists(CYANOPHAGE_STATS_FILE))) {
		console.log(
			`✔ Catalog unchanged; keeping existing Cyanophage stats → ${CYANOPHAGE_STATS_FILE}`
		);
		console.log('Done');
		return;
	}

	console.log('→ Loading Clemenpine layouts cache...');
	const { layouts } = await readCachedClemenpineLayouts();

	console.log(`→ Loading ${CYANOPHAGE_ANALYZER} analyzer data...`);
	const cyanophageData = await loadCyanophageData();

	const { offline, force } = parseOfflineForceArgs(process.argv.slice(2), {
		offlineEnv: 'CYANOPHAGE_SYNC_OFFLINE',
		forceEnv: 'CYANOPHAGE_SYNC_FORCE'
	});
	console.log('→ Loading AKL inputs...');
	const [memeFilter, magicRules] = await Promise.all([
		loadMemeFilterExclusions({ offline, force }),
		loadCminibrowserMagicRules({ offline, force })
	]);
	const excludedLayouts = memeFilter.excluded;
	const supplementalByLowerId = supplementalByLowerLayoutId(magicRules.supplementalByLayoutId);
	console.log(`  ✔ Excluding ${memeFilter.size} meme-tier layouts (corpus=${memeFilter.corpus})`);
	console.log(
		`  ✔ Magic and Adaptive mappings for ${magicRules.supplementalByLayoutId.size} layouts`
	);

	/** @type {Record<string, number[]>} */
	const cyanophageStats = {};
	let loaded = 0;
	let skipped = 0;
	let filtered = 0;

	/**
	 * @param {import('./clemenpine-cache.js').ClemenpineLayout} layout
	 */
	function processLayout(layout) {
		if (isExcludedLayout(layout.name, excludedLayouts)) {
			filtered++;
			return null;
		}

		const rawLayout = {
			name: layout.name,
			user: layout.user,
			board: layout.board,
			keys: layout.keys
		};
		const variants = supplementalByLowerId.get(layout.name.toLowerCase())?.variants ?? [];
		const cyanStats = buildCyanophageStats(rawLayout, cyanophageData, {
			magicMappings: defaultMagicMappings(variants)
		});
		if (!cyanStats) return { name: rawLayout.name, stats: null };
		return { name: rawLayout.name, stats: cyanStats };
	}

	console.log(`→ Computing Cyanophage stats for ${layouts.length} layouts...`);
	for (const layout of layouts) {
		try {
			const result = processLayout(layout);
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
	await writeTextFileIfChanged(CYANOPHAGE_STATS_FILE, JSON.stringify(sorted) + '\n');
	console.log(
		`  ✔ Cyanophage stats for ${loaded} layouts (${skipped} skipped, ${filtered} meme-filtered) → ${CYANOPHAGE_STATS_FILE}`
	);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cyanophage-stats-sync failed:', err);
	process.exit(1);
});
