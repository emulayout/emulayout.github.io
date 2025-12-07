#!/usr/bin/env bun

import { rm, readFile, mkdir, access, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { $ } from 'bun';

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
	const excludeArgs = blacklist.flatMap((layout) => [
		'--exclude',
		layout.endsWith('.json') ? layout : `${layout}.json`
	]);

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

	console.log('→ Syncing layouts...');
	await $`mkdir -p ${layoutsDir}`;
	await $`rsync -av --delete ${excludeArgs} ${CACHE_DIR}/layouts/ ${layoutsDir}/`;

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
