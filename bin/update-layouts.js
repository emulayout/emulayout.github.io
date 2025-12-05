#!/usr/bin/env bun

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

async function run() {
	const dir = await mkdtemp(join(tmpdir(), 'cmini-'));
	const repo = 'git@github.com:Apsu/cmini.git';

	console.log('→ Cloning:', repo);
	await $`git clone --depth=1 ${repo} ${dir}`;

	console.log('→ Syncing layouts...');
	await $`mkdir -p src/layouts`;

	// rsync copies & deletes removed files
	await $`rsync -av --delete ${dir}/layouts/ src/layouts/`;

	console.log('✔ Layouts updated\n');
	console.log('Next steps:');
	console.log('  git add src/layouts');
	console.log('  git commit -m "Update layouts"');

	await rm(dir, { recursive: true, force: true });
	console.log('🧹 Temp cleaned:', dir);
}

run().catch((err) => {
	console.error('❌ Update failed:', err);
	process.exit(1);
});
