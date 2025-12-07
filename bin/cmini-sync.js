#!/usr/bin/env bun

import { rm, readFile, mkdir, access, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { $ } from 'bun';
import { transformLayout } from './layout-transformer.js';

const DEST = 'src/lib/cmini';
const BLACKLIST_FILE = 'layout-blacklist.txt';
const CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
const REPO = 'git@github.com:Apsu/cmini.git';

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

async function getFileHash(filePath) {
	try {
		const content = await readFile(filePath);
		return createHash('md5').update(content).digest('hex');
	} catch {
		return null;
	}
}

async function getLayoutFiles(dir) {
	const files = new Map();
	try {
		const entries = await readdir(dir);
		for (const entry of entries) {
			if (entry.endsWith('.json')) {
				const filePath = join(dir, entry);
				const hash = await getFileHash(filePath);
				if (hash) {
					files.set(entry, hash);
				}
			}
		}
	} catch {
		// Directory doesn't exist, return empty map
	}
	return files;
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

	// Get existing layouts before sync
	const layoutsDir = join(DEST, 'layouts');
	const beforeFiles = await getLayoutFiles(layoutsDir);

	const blacklist = await loadBlacklist();

	// Track blacklisted removals
	const blacklistedRemovals = [];
	if (blacklist.length > 0) {
		// Remove blacklisted layouts from destination
		for (const layout of blacklist) {
			const filename = layout.endsWith('.json') ? layout : `${layout}.json`;
			const destPath = join(layoutsDir, filename);
			try {
				await stat(destPath);
				await rm(destPath, { force: true });
				blacklistedRemovals.push(filename);
			} catch {
				// File doesn't exist, that's fine
			}
		}
	}

	console.log('→ Syncing and transforming layouts...');
	await $`mkdir -p ${layoutsDir}`;

	// Get all layout files from cache
	const cacheLayoutsDir = join(CACHE_DIR, 'layouts');
	const cacheFiles = await readdir(cacheLayoutsDir);
	const layoutFiles = cacheFiles.filter((f) => f.endsWith('.json'));

	// Transform and write each layout
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
		const destPath = join(layoutsDir, filename);

		try {
			const originalContent = await readFile(cachePath, 'utf-8');
			const rawLayout = JSON.parse(originalContent);
			const transformedLayout = transformLayout(rawLayout);

			// Instead of re-stringifying, insert the new property into the original JSON
			// This preserves Unicode escapes, formatting, and large number precision
			let modifiedContent = originalContent;

			// Check if hasThumbKeys already exists (in case of re-sync)
			if (/"hasThumbKeys"\s*:/g.test(modifiedContent)) {
				// Replace existing value
				modifiedContent = modifiedContent.replace(
					/"hasThumbKeys"\s*:\s*\w+/g,
					`"hasThumbKeys": ${transformedLayout.hasThumbKeys}`
				);
			} else {
				// Insert after "board" property (before "keys")
				// Find the "board" line and insert after it
				const boardMatch = modifiedContent.match(/"board"\s*:\s*"[^"]*",?\s*\n/);
				if (boardMatch) {
					const indentMatch = boardMatch[0].match(/^(\s+)/);
					const indent = indentMatch ? indentMatch[1] : '    ';
					const insertPoint = boardMatch.index + boardMatch[0].length;

					// Ensure board line has a comma (if it doesn't, add one)
					let boardLine = boardMatch[0];
					if (!boardLine.includes(',')) {
						// Add comma before the newline
						boardLine = boardLine.replace(/\n/, ',\n');
					}

					// hasThumbKeys always needs a comma (since "keys" comes after)
					const newProperty = `${indent}"hasThumbKeys": ${transformedLayout.hasThumbKeys},\n`;

					modifiedContent =
						modifiedContent.slice(0, boardMatch.index) +
						boardLine +
						newProperty +
						modifiedContent.slice(insertPoint);
				} else {
					// Fallback: insert at the end of the root object, before "keys"
					const keysMatch = modifiedContent.match(/(\s+)"keys"\s*:\s*{/);
					if (keysMatch) {
						const indent = keysMatch[1];
						const insertPoint = keysMatch.index;
						const newProperty = `${indent}"hasThumbKeys": ${transformedLayout.hasThumbKeys},\n`;
						modifiedContent =
							modifiedContent.slice(0, insertPoint) +
							newProperty +
							modifiedContent.slice(insertPoint);
					}
				}
			}

			// Preserve original trailing newline state
			const originalEndsWithNewline = originalContent.endsWith('\n');
			if (originalEndsWithNewline && !modifiedContent.endsWith('\n')) {
				modifiedContent += '\n';
			} else if (!originalEndsWithNewline && modifiedContent.endsWith('\n')) {
				modifiedContent = modifiedContent.slice(0, -1);
			}

			await writeFile(destPath, modifiedContent, 'utf-8');
		} catch (err) {
			console.error(`  ⚠ Error processing ${filename}:`, err.message);
		}
	}

	// Remove any files in destination that aren't in cache (or are blacklisted)
	const destFiles = await readdir(layoutsDir);
	for (const filename of destFiles) {
		if (!filename.endsWith('.json')) continue;
		const layoutName = filename.replace('.json', '');
		const isBlacklisted = blacklist.some(
			(entry) =>
				entry === layoutName || entry === filename || entry.replace('.json', '') === layoutName
		);
		if (!layoutFiles.includes(filename) || isBlacklisted) {
			await rm(join(layoutsDir, filename), { force: true });
		}
	}

	console.log('→ Syncing authors...');
	await $`cp ${CACHE_DIR}/authors.json ${DEST}/authors.json`;

	// Get layouts after sync
	const afterFiles = await getLayoutFiles(layoutsDir);

	// Calculate changes
	const added = [];
	const modified = [];
	const removed = [];

	for (const [filename, hash] of afterFiles) {
		const beforeHash = beforeFiles.get(filename);
		if (!beforeHash) {
			added.push(filename);
		} else if (beforeHash !== hash) {
			modified.push(filename);
		}
	}

	for (const [filename] of beforeFiles) {
		if (!afterFiles.has(filename)) {
			removed.push(filename);
		}
	}

	// Print changes
	if (added.length === 0 && modified.length === 0 && removed.length === 0) {
		console.log('✔ No layout changes\n');
	} else {
		console.log('✔ Layout changes:');
		if (added.length > 0) {
			console.log(`  Added (${added.length}):`);
			added.sort().forEach((f) => console.log(`    + ${f}`));
		}
		if (modified.length > 0) {
			console.log(`  Modified (${modified.length}):`);
			modified.sort().forEach((f) => console.log(`    ~ ${f}`));
		}
		if (removed.length > 0) {
			console.log(`  Removed (${removed.length}):`);
			removed.sort().forEach((f) => {
				const reason = blacklistedRemovals.includes(f) ? ' (blacklisted)' : ' (removed from repo)';
				console.log(`    - ${f}${reason}`);
			});
		}
		console.log('');
	}

	console.log('Next steps:');
	console.log(`  git add ${DEST}`);
	console.log('  git commit -m "Sync cmini data"');
}

run().catch((err) => {
	console.error('❌ Sync failed:', err);
	process.exit(1);
});
