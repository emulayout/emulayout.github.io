#!/usr/bin/env bun

import { readFile, mkdir, access, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { $ } from 'bun';
import { transformLayout } from './layout-transformer.js';
import { encodeLayout, layoutEntryName } from './layout-codec.js';
import { buildLayoutTimestamps } from './layout-timestamps.js';
import { buildLayoutStats, DEFAULT_STATS_ANALYZER, loadCorpusData } from './layout-stats.js';
import {
	buildCyanophageStats,
	CYANOPHAGE_ANALYZER,
	loadCyanophageData
} from './cyanophage-stats.js';

const LAYOUTS_FILE = 'static/all-layouts.json';
const STATS_FILE = 'static/layout-stats.json';
const CYANOPHAGE_STATS_FILE = 'static/layout-stats-cyanophage.json';
const BLACKLIST_FILE = 'layout-blacklist.txt';
const CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
const SPARSE_CHECKOUT = ['layouts', '/authors.json', 'cache', 'corpora/monkeyracer'];
// Use HTTPS in CI environments (GitHub Actions, etc.) for public repos
const REPO = process.env.CI ? 'https://github.com/Apsu/cmini.git' : 'git@github.com:Apsu/cmini.git';
const SYNC_CONCURRENCY = Number(process.env.CMINI_SYNC_CONCURRENCY ?? 16);

async function resolveDefaultBranch() {
	try {
		const branch = await $`git -C ${CACHE_DIR} rev-parse --abbrev-ref origin/HEAD`.text();
		return branch.trim().replace('origin/', '');
	} catch {
		const main = await $`git -C ${CACHE_DIR} rev-parse origin/main`.quiet().nothrow();
		if (main.exitCode === 0) return 'main';
		return 'master';
	}
}

async function loadBlacklist() {
	try {
		const content = await readFile(BLACKLIST_FILE, 'utf-8');
		return content
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'));
	} catch {
		// File doesn't exist, return empty array
		return [];
	}
}

async function ensureCache(offline = false) {
	const cacheExists = await access(CACHE_DIR)
		.then(() => true)
		.catch(() => false);

	if (!cacheExists) {
		if (offline) {
			throw new Error(
				`cmini cache missing at ${CACHE_DIR}. Run: bun run ./bin/cmini-sync.js`
			);
		}
		console.log('→ Initial clone (this may take a while)...');
		await mkdir(CACHE_DIR, { recursive: true });
		await $`git clone --filter=blob:none --sparse ${REPO} ${CACHE_DIR}`;
		await $`cd ${CACHE_DIR} && git sparse-checkout set --no-cone ${SPARSE_CHECKOUT}`;
	} else if (offline) {
		console.log('→ Using existing cmini cache (offline)...');
	} else {
		console.log('→ Updating cache...');
		const isShallow = (await $`git -C ${CACHE_DIR} rev-parse --is-shallow-repository`.text()).trim();
		if (isShallow === 'true') {
			console.log('→ Unshallowing cache for layout timestamps...');
			await $`git -C ${CACHE_DIR} fetch --unshallow`.nothrow();
		}
		const branchName = await resolveDefaultBranch();
		const localHead = (await $`git -C ${CACHE_DIR} rev-parse HEAD`.text()).trim();
		await $`cd ${CACHE_DIR} && git fetch origin ${branchName}`;
		const remoteHead = (await $`git -C ${CACHE_DIR} rev-parse origin/${branchName}`.text()).trim();
		if (localHead === remoteHead) {
			console.log('→ Cache already up to date');
			return;
		}
		await $`cd ${CACHE_DIR} && git reset --hard origin/${branchName}`;
		await $`cd ${CACHE_DIR} && git sparse-checkout set --no-cone ${SPARSE_CHECKOUT}`;
	}
}

async function run() {
	const offline = process.argv.includes('--offline') || process.env.CMINI_SYNC_OFFLINE === '1';
	await ensureCache(offline);

	const blacklist = await loadBlacklist();

	// Get existing layouts before sync (read from the generated file if it exists)
	let beforeLayouts = [];
	try {
		const beforeContent = await readFile(LAYOUTS_FILE, 'utf-8');
		beforeLayouts = JSON.parse(beforeContent);
	} catch {
		// File doesn't exist yet, that's fine
	}

	console.log('→ Syncing and transforming layouts...');
	await $`mkdir -p static`;

	// Get all layout files from cache
	const cacheLayoutsDir = join(CACHE_DIR, 'layouts');
	const cacheFiles = await readdir(cacheLayoutsDir);
	const layoutFiles = cacheFiles.filter((f) => f.endsWith('.json'));

	console.log('→ Resolving layout timestamps from git history...');
	const layoutTimestamps = await buildLayoutTimestamps(CACHE_DIR, layoutFiles);

	let corpusData = null;
	try {
		corpusData = await loadCorpusData(CACHE_DIR, DEFAULT_STATS_ANALYZER);
		console.log(`→ Loaded ${DEFAULT_STATS_ANALYZER} analyzer data for SFB / LH-RH`);
	} catch (err) {
		console.warn(`  ⚠ Could not load analyzer data (${err.message}); SFB/LH-RH will be zero`);
	}

	let cyanophageData = null;
	try {
		cyanophageData = await loadCyanophageData();
		console.log(`→ Loaded ${CYANOPHAGE_ANALYZER} analyzer data for effort metrics`);
	} catch (err) {
		console.warn(`  ⚠ Could not load cyanophage data (${err.message}); cyanophage stats will be skipped`);
	}

	// Transform all layouts
	const transformedLayouts = [];
	const layoutStats = {};
	const cyanophageStats = {};
	let statsLoaded = 0;
	let statsMissing = 0;
	let cyanophageStatsLoaded = 0;
	let cyanophageStatsSkipped = 0;

	/**
	 * @param {string} filename
	 */
	async function processLayoutFile(filename) {
		const layoutName = filename.replace('.json', '');
		const isBlacklisted = blacklist.some(
			(entry) =>
				entry === layoutName || entry === filename || entry.replace('.json', '') === layoutName
		);
		if (isBlacklisted) return null;

		const cachePath = join(cacheLayoutsDir, filename);
		const originalContent = await readFile(cachePath, 'utf-8');
		const rawLayout = JSON.parse(originalContent);
		const transformedLayout = transformLayout(rawLayout);
		transformedLayout.updatedAt = layoutTimestamps[filename];

		const stats = await buildLayoutStats(CACHE_DIR, filename, rawLayout, corpusData);
		const cyanStats = buildCyanophageStats(rawLayout, cyanophageData);

		return {
			encoded: encodeLayout(transformedLayout),
			name: rawLayout.name,
			stats,
			cyanStats
		};
	}

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
			transformedLayouts.push(result.encoded);
			if (result.stats) {
				layoutStats[result.name] = result.stats;
				statsLoaded++;
			} else {
				statsMissing++;
			}
			if (result.cyanStats) {
				cyanophageStats[result.name] = result.cyanStats;
				cyanophageStatsLoaded++;
			} else {
				cyanophageStatsSkipped++;
			}
		}
	}

	// Sort layouts by name for consistent output
	transformedLayouts.sort((a, b) => a[0].localeCompare(b[0]));

	// Write compact layout tuples (minified — GitHub Pages gzip-compresses on transfer)
	await writeFile(LAYOUTS_FILE, JSON.stringify(transformedLayouts) + '\n', 'utf-8');

	console.log('→ Merging layout stats (cache trigrams + computed SFB/LH-RH)...');
	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);
	await writeFile(STATS_FILE, JSON.stringify(sortedStats) + '\n', 'utf-8');
	console.log(
		`  ✔ Stats for ${statsLoaded} layouts (${statsMissing} no cache, ${DEFAULT_STATS_ANALYZER} analyzer)\n`
	);

	console.log('→ Building cyanophage effort stats...');
	const sortedCyanophageStats = Object.fromEntries(
		Object.keys(cyanophageStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, cyanophageStats[name]])
	);
	await writeFile(CYANOPHAGE_STATS_FILE, JSON.stringify(sortedCyanophageStats) + '\n', 'utf-8');
	console.log(
		`  ✔ Cyanophage stats for ${cyanophageStatsLoaded} layouts (${cyanophageStatsSkipped} skipped, ${CYANOPHAGE_ANALYZER} analyzer)\n`
	);

	console.log('→ Syncing authors...');
	await $`cp ${CACHE_DIR}/authors.json static/authors.json`;

	// Calculate changes by comparing layout names
	const beforeNames = new Set(beforeLayouts.map(layoutEntryName));
	const afterNames = new Set(transformedLayouts.map((l) => l[0]));

	const added = transformedLayouts.filter((l) => !beforeNames.has(l[0])).map((l) => l[0]);
	const removed = beforeLayouts.filter((l) => !afterNames.has(layoutEntryName(l))).map(layoutEntryName);

	// For modified, compare by hash (name + content hash)
	const beforeHashes = new Map(
		beforeLayouts.map((l) => [layoutEntryName(l), createHash('md5').update(JSON.stringify(l)).digest('hex')])
	);
	const modified = transformedLayouts
		.filter((l) => {
			const name = l[0];
			const beforeHash = beforeHashes.get(name);
			if (!beforeHash) return false;
			const afterHash = createHash('md5').update(JSON.stringify(l)).digest('hex');
			return beforeHash !== afterHash;
		})
		.map((l) => l[0]);

	// Print changes
	if (added.length === 0 && modified.length === 0 && removed.length === 0) {
		console.log('✔ No layout changes\n');
	} else {
		console.log('✔ Layout changes:');
		if (added.length > 0) {
			console.log(`  Added (${added.length}):`);
			added.sort().forEach((name) => console.log(`    + ${name}`));
		}
		if (modified.length > 0) {
			console.log(`  Modified (${modified.length}):`);
			modified.sort().forEach((name) => console.log(`    ~ ${name}`));
		}
		if (removed.length > 0) {
			console.log(`  Removed (${removed.length}):`);
			removed.sort().forEach((name) => {
				const reason = blacklist.includes(name) ? ' (blacklisted)' : ' (removed from repo)';
				console.log(`    - ${name}${reason}`);
			});
		}
		console.log('');
	}

	console.log('Done');
}

run().catch((err) => {
	console.error('❌ Sync failed:', err);
	process.exit(1);
});
