#!/usr/bin/env bun

import { access } from 'node:fs/promises';
import { $ } from 'bun';
import {
	CMINI_ANALYZER,
	CYANOPHAGE_ANALYZER,
	MANA2_ANALYZER,
	STATS_DATASETS
} from '../src/lib/statsAnalyzers.ts';

const CATALOG_FILES = [
	'static/all-layouts.json',
	'static/layout-supplemental.json',
	'static/authors.json',
	'static/layout-likes.json'
];

/** @param {typeof CMINI_ANALYZER | typeof CYANOPHAGE_ANALYZER | typeof MANA2_ANALYZER} analyzer */
function analyzerFiles(analyzer) {
	return STATS_DATASETS.filter((dataset) => dataset.analyzer === analyzer).map(
		(dataset) => `static${dataset.statsUrl}`
	);
}

export const REQUIRED_STATIC_FILES_BY_TASK = {
	catalog: CATALOG_FILES,
	cmini: analyzerFiles(CMINI_ANALYZER),
	cyanophage: analyzerFiles(CYANOPHAGE_ANALYZER),
	mana2: analyzerFiles(MANA2_ANALYZER)
};

/**
 * A missing catalog file forces every analyzer to refresh against the rebuilt
 * catalog. Otherwise, run only analyzers whose own artifacts are incomplete.
 *
 * @param {Iterable<string>} missingFiles
 */
export function analyzerTasksForMissingStaticData(missingFiles) {
	const missing = new Set(missingFiles);
	const catalogMissing = REQUIRED_STATIC_FILES_BY_TASK.catalog.some((file) => missing.has(file));
	return /** @type {const} */ (['cmini', 'cyanophage', 'mana2']).filter(
		(task) =>
			catalogMissing || REQUIRED_STATIC_FILES_BY_TASK[task].some((file) => missing.has(file))
	);
}

/** @param {string} path */
async function exists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

async function run() {
	const requiredFiles = Object.values(REQUIRED_STATIC_FILES_BY_TASK).flat();
	const missing = [];
	for (const file of requiredFiles) {
		if (!(await exists(file))) missing.push(file);
	}

	if (missing.length === 0) return;

	console.log('→ Layout data missing for local dev:');
	for (const file of missing) {
		console.log(`  - ${file}`);
	}
	console.log('→ Generating from cached sources...');

	await $`bun run ./bin/catalog-sync.js --offline`;
	const analyzerTasks = analyzerTasksForMissingStaticData(missing);
	if (analyzerTasks.includes('cmini')) await $`bun run ./bin/cmini-stats-sync.js --offline`;
	if (analyzerTasks.includes('cyanophage')) await $`bun run ./bin/cyanophage-stats-sync.js`;
	if (analyzerTasks.includes('mana2')) await $`bun run ./bin/mana2-stats-sync.js --offline`;
}

if (import.meta.main) {
	run().catch((error) => {
		console.error('❌ Static-data bootstrap failed:', error);
		process.exit(1);
	});
}
