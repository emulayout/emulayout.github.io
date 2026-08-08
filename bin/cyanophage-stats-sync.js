#!/usr/bin/env bun

/**
 * Compute Cyanophage effort stats for layouts in the local cmini catalog cache.
 *
 * Requires a prior catalog-sync so `.cache/cmini-repo/layouts` exists.
 * Reads curated Magic mappings from `data/layouts/` when present.
 */

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadLayoutSupplementalData } from './layout-data.js';
import {
	buildCyanophageStats,
	CYANOPHAGE_ANALYZER,
	loadCyanophageData
} from './cyanophage-stats.js';
import { defaultMagicMappings } from './layout-features.js';
import { CMINI_CACHE_DIR, loadBlacklist } from './sync-shared.js';

const CYANOPHAGE_STATS_FILE = 'static/layout-stats-cyanophage.json';
const SYNC_CONCURRENCY = Number(process.env.CYANOPHAGE_SYNC_CONCURRENCY ?? 16);

async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

async function run() {
	const skipIfCminiUnchanged =
		process.env.CYANOPHAGE_SKIP_IF_CMINI_UNCHANGED === '1' && process.env.CMINI_CHANGED === 'false';
	if (skipIfCminiUnchanged && (await pathExists(CYANOPHAGE_STATS_FILE))) {
		console.log(
			`✔ cmini HEAD unchanged; keeping existing Cyanophage stats → ${CYANOPHAGE_STATS_FILE}`
		);
		console.log('Done');
		return;
	}

	const cacheLayoutsDir = join(CMINI_CACHE_DIR, 'layouts');
	if (!(await pathExists(cacheLayoutsDir))) {
		throw new Error(
			`cmini layouts missing at ${cacheLayoutsDir}. Run: bun run ./bin/catalog-sync.js`
		);
	}

	console.log(`→ Loading ${CYANOPHAGE_ANALYZER} analyzer data...`);
	const cyanophageData = await loadCyanophageData();

	const blacklist = await loadBlacklist();
	const supplementalByLayout = await loadLayoutSupplementalData();
	const layoutFiles = (await readdir(cacheLayoutsDir)).filter((f) => f.endsWith('.json'));

	/** @type {Record<string, number[]>} */
	const cyanophageStats = {};
	let loaded = 0;
	let skipped = 0;

	/**
	 * @param {string} filename
	 */
	async function processLayoutFile(filename) {
		const layoutName = filename.replace(/\.json$/i, '');
		if (blacklist.has(layoutName) || blacklist.has(filename)) return null;

		const rawLayout = JSON.parse(await readFile(join(cacheLayoutsDir, filename), 'utf-8'));
		const variants = supplementalByLayout.get(rawLayout.name)?.variants ?? [];
		const cyanStats = buildCyanophageStats(rawLayout, cyanophageData, {
			magicMappings: defaultMagicMappings(variants)
		});
		if (!cyanStats) return { name: rawLayout.name, stats: null };
		return { name: rawLayout.name, stats: cyanStats };
	}

	console.log(`→ Computing Cyanophage stats for ${layoutFiles.length} layouts...`);
	for (let i = 0; i < layoutFiles.length; i += SYNC_CONCURRENCY) {
		const batch = layoutFiles.slice(i, i + SYNC_CONCURRENCY);
		const results = await Promise.all(
			batch.map((filename) =>
				processLayoutFile(filename).catch((err) => {
					console.error(`  ⚠ Error processing ${filename}:`, err.message);
					return null;
				})
			)
		);
		for (const result of results) {
			if (!result) continue;
			if (result.stats) {
				cyanophageStats[result.name] = result.stats;
				loaded++;
			} else {
				skipped++;
			}
		}
	}

	await mkdir('static', { recursive: true });
	const sorted = Object.fromEntries(
		Object.keys(cyanophageStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, cyanophageStats[name]])
	);
	await writeFile(CYANOPHAGE_STATS_FILE, JSON.stringify(sorted) + '\n', 'utf-8');
	console.log(
		`  ✔ Cyanophage stats for ${loaded} layouts (${skipped} skipped) → ${CYANOPHAGE_STATS_FILE}`
	);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cyanophage-stats-sync failed:', err);
	process.exit(1);
});
