#!/usr/bin/env bun

import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

const DEST = 'src/lib/cmini';
const BLACKLIST_FILE = 'layout-blacklist.txt';

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

async function run() {
	const dir = await mkdtemp(join(tmpdir(), 'cmini-'));
	const repo = 'git@github.com:Apsu/cmini.git';

	console.log('→ Cloning:', repo);
	await $`git clone --depth=1 ${repo} ${dir}`;

	const blacklist = await loadBlacklist();
	const excludeArgs = blacklist.flatMap((layout) => [
		'--exclude',
		layout.endsWith('.json') ? layout : `${layout}.json`
	]);

	if (blacklist.length > 0) {
		console.log(`→ Excluding ${blacklist.length} blacklisted layout(s):`, blacklist.join(', '));
		// Remove blacklisted layouts from destination
		for (const layout of blacklist) {
			const filename = layout.endsWith('.json') ? layout : `${layout}.json`;
			const destPath = join(DEST, 'layouts', filename);
			try {
				await rm(destPath, { force: true });
			} catch {
				// File doesn't exist, that's fine
			}
		}
	}

	console.log('→ Syncing layouts...');
	await $`mkdir -p ${DEST}/layouts`;
	await $`rsync -av --delete ${excludeArgs} ${dir}/layouts/ ${DEST}/layouts/`;

	console.log('→ Syncing authors...');
	await $`cp ${dir}/authors.json ${DEST}/authors.json`;

	console.log('✔ Sync complete\n');
	console.log('Next steps:');
	console.log(`  git add ${DEST}`);
	console.log('  git commit -m "Sync cmini data"');

	await rm(dir, { recursive: true, force: true });
	console.log('🧹 Temp cleaned:', dir);
}

run().catch((err) => {
	console.error('❌ Sync failed:', err);
	process.exit(1);
});
