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
import { CYANOPHAGE_ANALYZER } from './cyanophage-stats.js';
import {
	CYANOPHAGE_WORKER_COUNT,
	CyanophageStatsWorkerError,
	createCyanophageStatsWorker
} from './cyanophage-stats-workers.js';
import { isExcludedLayout, loadMemeFilterExclusions } from './cminibrowser-meme-filter.js';
import { parseOfflineForceArgs, writeTextFileIfChanged } from './sync-shared.js';
import { readCachedAkldbLayouts } from './akldb-cache.js';
import { supplementalFromAkldbLayout } from './akldb-spark.js';

const GEOMETRIES = /** @type {const} */ (['column-stagger', 'row-stagger']);
const cyanophageStatsFile = (geometry) => `static/layout-stats-cyanophage-${geometry}.json`;

async function run() {
	console.log('→ Loading AKLDB layouts cache...');
	const { layouts } = await readCachedAkldbLayouts();

	console.log(
		`→ Preparing ${CYANOPHAGE_ANALYZER} analyzer (up to ${CYANOPHAGE_WORKER_COUNT} workers for cache misses)...`
	);

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
	 * @param {'column-stagger' | 'row-stagger'} geometry
	 * @param {ReturnType<typeof createCyanophageStatsWorker>} worker
	 */
	function processLayout(layout, geometry, worker) {
		const keys = /** @type {Record<string, { row: number, col: number, finger: string }>} */ ({});
		for (const key of layout.keys) {
			if (key.char) {
				keys[key.char] = { row: key.row, col: key.col, finger: key.finger };
			}
		}
		const magicMappings = supplementalFromAkldbLayout(layout).analyzerMappings;
		const input = { geometry, keys, magicMappings };
		return cache.getOrComputeAsync(input, () => worker.compute(input));
	}

	const workers = Array.from({ length: CYANOPHAGE_WORKER_COUNT }, createCyanophageStatsWorker);
	try {
		for (const geometry of GEOMETRIES) {
			const started = performance.now();
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
			let cursor = 0;
			let stopped = false;
			let saving = Promise.resolve();
			const outcomes = await Promise.allSettled(
				workers.map(async (worker) => {
					try {
						while (!stopped && cursor < eligible.length) {
							const layout = eligible[cursor++];
							try {
								const result = await processLayout(layout, geometry, worker);
								if (result.cached) cached++;
								else computed++;
								if (result.stats) {
									cyanophageStats[layout.name] = result.stats;
									loaded++;
								} else {
									skipped++;
								}
							} catch (err) {
								if (err instanceof CyanophageStatsWorkerError) throw err;
								console.error(`  ⚠ Error processing ${layout.name}:`, err.message);
							}
							// Preserve completed work if a long cold run is interrupted.
							if (computed - checkpoint >= 100) {
								checkpoint = computed;
								saving = saving.then(() => cache.save());
								await saving;
								console.log(
									`  … ${cached} cached, ${computed} computed in ${((performance.now() - started) / 1000).toFixed(1)}s`
								);
							}
						}
					} catch (error) {
						stopped = true;
						throw error;
					}
				})
			);
			const failed = outcomes.find((outcome) => outcome.status === 'rejected');
			await saving;
			if (failed?.status === 'rejected') throw failed.reason;
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
				`  ✔ ${cached} cached, ${computed} computed; ${loaded} layouts (${skipped} skipped), ${((performance.now() - started) / 1000).toFixed(2)}s → ${outputFile}`
			);
		}
	} finally {
		await Promise.all(workers.map((worker) => worker.close()));
	}
	console.log(`  ✔ ${filtered} meme-filtered layouts`);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ cyanophage-stats-sync failed:', err);
	process.exit(1);
});
