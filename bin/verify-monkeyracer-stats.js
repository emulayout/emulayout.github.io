#!/usr/bin/env bun

/**
 * Verify sync-time trigram computation matches cmini cache files exactly.
 * Skips stale cmini caches where the layout was updated without refreshed stats.
 * Exits non-zero only on true algorithm mismatches.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { $ } from 'bun';
import {
	TRIGRAM_STAT_KEYS,
	DEFAULT_STATS_ANALYZER,
	loadCorpusData
} from './layout-stats.js';
import { computeTrigramStats } from './cmini-analyzer.js';

const CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
const MAX_REPORTED = 20;
const VERIFY_CONCURRENCY = Number(process.env.CMINI_VERIFY_CONCURRENCY ?? 16);

/**
 * @param {Record<string, number>} computed
 * @param {Record<string, number>} cached
 */
function compareTrigramStats(computed, cached) {
	/** @type {Array<{ key: string, computed: number, cached: number }>} */
	const mismatches = [];

	for (const key of TRIGRAM_STAT_KEYS) {
		const a = computed[key] ?? 0;
		const b = cached[key] ?? 0;
		if (a !== b) {
			mismatches.push({ key, computed: a, cached: b });
		}
	}

	return mismatches;
}

/**
 * @param {string} layoutName
 * @param {Record<string, number>} cached
 * @param {Record<string, number>} trigrams
 */
async function findMatchingLayoutCommit(layoutName, cached, trigrams) {
	const commits = (
		await $`git -C ${CACHE_DIR} log --format=%H -- layouts/${layoutName}.json`.text()
	)
		.trim()
		.split('\n')
		.filter(Boolean);

	for (const commit of commits) {
		try {
			const content = await $`git -C ${CACHE_DIR} show ${commit}:layouts/${layoutName}.json`.text();
			const rawLayout = JSON.parse(content);
			const computed = await computeTrigramStats(rawLayout.keys, trigrams);
			if (compareTrigramStats(computed, cached).length === 0) {
				return commit;
			}
		} catch {
			continue;
		}
	}

	return null;
}

/**
 * @param {string} filename
 * @param {Record<string, number>} trigrams
 */
async function checkCacheFile(filename, trigrams) {
	const cachePath = join(CACHE_DIR, 'cache', filename);
	const cacheContent = await readFile(cachePath, 'utf-8');
	const cacheData = JSON.parse(cacheContent);
	const cached = cacheData[DEFAULT_STATS_ANALYZER];
	if (!cached || (cached.alternate ?? 0) <= 0) {
		return { kind: 'skipped' };
	}

	const layoutName = filename.replace(/\.json$/i, '');
	const layoutPath = join(CACHE_DIR, 'layouts', `${layoutName}.json`);
	let rawLayout;
	try {
		rawLayout = JSON.parse(await readFile(layoutPath, 'utf-8'));
	} catch {
		return { kind: 'skipped' };
	}

	const computed = await computeTrigramStats(rawLayout.keys, trigrams);
	const mismatches = compareTrigramStats(computed, cached);
	if (mismatches.length === 0) {
		return { kind: 'ok' };
	}

	const matchingCommit = await findMatchingLayoutCommit(layoutName, cached, trigrams);
	if (matchingCommit) {
		return { kind: 'stale' };
	}

	return { kind: 'failure', layout: layoutName, mismatches };
}

async function run() {
	const corpusData = await loadCorpusData(CACHE_DIR, DEFAULT_STATS_ANALYZER);
	const cacheDir = join(CACHE_DIR, 'cache');
	const files = (await readdir(cacheDir)).filter((name) => name.endsWith('.json'));

	let checked = 0;
	let skipped = 0;
	let stale = 0;
	/** @type {Array<{ layout: string, mismatches: ReturnType<typeof compareTrigramStats> }>} */
	const failures = [];

	for (let i = 0; i < files.length; i += VERIFY_CONCURRENCY) {
		const batch = files.slice(i, i + VERIFY_CONCURRENCY);
		const results = await Promise.all(
			batch.map((filename) => checkCacheFile(filename, corpusData.trigrams))
		);

		for (const result of results) {
			if (result.kind === 'skipped') {
				skipped++;
				continue;
			}
			checked++;
			if (result.kind === 'ok') continue;
			if (result.kind === 'stale') {
				stale++;
				continue;
			}
			failures.push({ layout: result.layout, mismatches: result.mismatches });
		}
	}

	console.log(`Checked ${checked} cmini cache files (${skipped} skipped, ${stale} stale layout/cache pairs)`);

	if (failures.length === 0) {
		console.log('✔ All computed trigram stats match cmini cache (or stale cmini cache was skipped)');
		return;
	}

	console.error(`✖ ${failures.length} layout(s) have true algorithm mismatches:`);
	for (const failure of failures.slice(0, MAX_REPORTED)) {
		console.error(`  ${failure.layout}:`);
		for (const mismatch of failure.mismatches) {
			console.error(
				`    ${mismatch.key}: computed=${mismatch.computed} cached=${mismatch.cached}`
			);
		}
	}
	if (failures.length > MAX_REPORTED) {
		console.error(`  … and ${failures.length - MAX_REPORTED} more`);
	}

	process.exit(1);
}

run().catch((err) => {
	console.error('❌ Verification failed:', err);
	process.exit(1);
});
