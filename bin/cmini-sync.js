#!/usr/bin/env bun

import { readFile, mkdir, access, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { $ } from 'bun';
import { transformLayout } from './layout-transformer.js';
import { encodeLayout, layoutEntryName } from './layout-codec.js';
import { buildLayoutTimestamps } from './layout-timestamps.js';
import { buildLayoutStats, DEFAULT_STATS_CORPUS, loadCorpusData } from './layout-stats.js';

const LAYOUTS_FILE = 'static/all-layouts.json';
const STATS_FILE = 'static/layout-stats.json';
const BLACKLIST_FILE = 'layout-blacklist.txt';
const CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
const SPARSE_CHECKOUT = ['layouts', '/authors.json', 'cache', 'corpora/monkeyracer'];
// Use HTTPS in CI environments (GitHub Actions, etc.) for public repos
const REPO = process.env.CI ? 'https://github.com/Apsu/cmini.git' : 'git@github.com:Apsu/cmini.git';

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

async function ensureCache() {
	const cacheExists = await access(CACHE_DIR)
		.then(() => true)
		.catch(() => false);

	if (!cacheExists) {
		console.log('→ Initial clone (this may take a while)...');
		await mkdir(CACHE_DIR, { recursive: true });
		await $`git clone --filter=blob:none --sparse ${REPO} ${CACHE_DIR}`;
		await $`cd ${CACHE_DIR} && git sparse-checkout set --no-cone ${SPARSE_CHECKOUT}`;
	} else {
		console.log('→ Updating cache...');
		const isShallow = (await $`git -C ${CACHE_DIR} rev-parse --is-shallow-repository`.text()).trim();
		if (isShallow === 'true') {
			console.log('→ Unshallowing cache for layout timestamps...');
			await $`git -C ${CACHE_DIR} fetch --unshallow`.nothrow();
		}
		await $`cd ${CACHE_DIR} && git fetch origin`;
		// Try to get the default branch, fallback to master/main
		try {
			const branch = await $`cd ${CACHE_DIR} && git rev-parse --abbrev-ref origin/HEAD`.text();
			const branchName = branch.trim().replace('origin/', '');
			await $`cd ${CACHE_DIR} && git reset --hard origin/${branchName}`;
		} catch {
			// Fallback: try common branch names
			try {
				await $`cd ${CACHE_DIR} && git reset --hard origin/main`;
			} catch {
				await $`cd ${CACHE_DIR} && git reset --hard origin/master`;
			}
		}
		// Re-apply sparse-checkout after reset
		await $`cd ${CACHE_DIR} && git sparse-checkout set --no-cone ${SPARSE_CHECKOUT}`;
	}
}

async function run() {
	await ensureCache();

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
		corpusData = await loadCorpusData(CACHE_DIR, DEFAULT_STATS_CORPUS);
		console.log(`→ Loaded ${DEFAULT_STATS_CORPUS} corpus for SFB / LH-RH`);
	} catch (err) {
		console.warn(`  ⚠ Could not load corpus data (${err.message}); SFB/LH-RH will be zero`);
	}

	// Transform all layouts
	const transformedLayouts = [];
	const layoutStats = {};
	let statsLoaded = 0;
	let statsMissing = 0;
	let statsInvalid = 0;

	for (const filename of layoutFiles) {
		// Check if blacklisted (handle both with and without .json extension)
		const layoutName = filename.replace('.json', '');
		const isBlacklisted = blacklist.some(
			(entry) =>
				entry === layoutName || entry === filename || entry.replace('.json', '') === layoutName
		);
		if (isBlacklisted) {
			continue; // Skip blacklisted layouts
		}

		const cachePath = join(cacheLayoutsDir, filename);

		try {
			const originalContent = await readFile(cachePath, 'utf-8');
			const rawLayout = JSON.parse(originalContent);
			const transformedLayout = transformLayout(rawLayout);
			transformedLayout.updatedAt = layoutTimestamps[filename];
			transformedLayouts.push(encodeLayout(transformedLayout));

			const stats = await buildLayoutStats(CACHE_DIR, filename, rawLayout, corpusData);
			if (stats) {
				layoutStats[rawLayout.name] = stats;
				statsLoaded++;
			} else {
				const cachePath = join(CACHE_DIR, 'cache', filename);
				const hasCache = await access(cachePath).then(() => true).catch(() => false);
				if (hasCache) statsInvalid++;
				else statsMissing++;
			}
		} catch (err) {
			console.error(`  ⚠ Error processing ${filename}:`, err.message);
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
		`  ✔ Stats for ${statsLoaded} layouts (${statsMissing} no cache, ${statsInvalid} invalid cache, ${DEFAULT_STATS_CORPUS} corpus)\n`
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
