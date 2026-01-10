#!/usr/bin/env bun

import { readFile, mkdir, access, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { $ } from 'bun';
import { transformLayout } from './layout-transformer.js';

const LAYOUTS_FILE = 'static/all-layouts.json';
const BLACKLIST_FILE = 'layout-blacklist.txt';
const CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
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
		await $`git clone --depth=1 --filter=blob:none --sparse ${REPO} ${CACHE_DIR}`;
		await $`cd ${CACHE_DIR} && git sparse-checkout set --no-cone layouts /authors.json`;
	} else {
		console.log('→ Updating cache...');
		// Fetch and reset to the remote default branch
		await $`cd ${CACHE_DIR} && git fetch --depth=1 origin`;
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
		await $`cd ${CACHE_DIR} && git sparse-checkout set --no-cone layouts /authors.json`;
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

	// Transform all layouts
	const transformedLayouts = [];
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
			transformedLayouts.push(transformedLayout);
		} catch (err) {
			console.error(`  ⚠ Error processing ${filename}:`, err.message);
		}
	}

	// Sort layouts by name for consistent output
	transformedLayouts.sort((a, b) => a.name.localeCompare(b.name));

	// Write single JSON file
	await writeFile(LAYOUTS_FILE, JSON.stringify(transformedLayouts, null, '\t') + '\n', 'utf-8');

	console.log('→ Syncing authors...');
	await $`cp ${CACHE_DIR}/authors.json static/authors.json`;

	// Calculate changes by comparing layout names
	const beforeNames = new Set(beforeLayouts.map((l) => l.name));
	const afterNames = new Set(transformedLayouts.map((l) => l.name));

	const added = transformedLayouts.filter((l) => !beforeNames.has(l.name)).map((l) => l.name);
	const removed = beforeLayouts.filter((l) => !afterNames.has(l.name)).map((l) => l.name);

	// For modified, compare by hash (name + content hash)
	const beforeHashes = new Map(
		beforeLayouts.map((l) => [l.name, createHash('md5').update(JSON.stringify(l)).digest('hex')])
	);
	const modified = transformedLayouts
		.filter((l) => {
			const beforeHash = beforeHashes.get(l.name);
			if (!beforeHash) return false;
			const afterHash = createHash('md5').update(JSON.stringify(l)).digest('hex');
			return beforeHash !== afterHash;
		})
		.map((l) => l.name);

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
