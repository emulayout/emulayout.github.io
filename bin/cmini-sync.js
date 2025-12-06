#!/usr/bin/env bun

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

const DEST = 'src/lib/cmini';

async function run() {
	const dir = await mkdtemp(join(tmpdir(), 'cmini-'));
	const repo = 'git@github.com:Apsu/cmini.git';

	console.log('→ Cloning:', repo);
	await $`git clone --depth=1 ${repo} ${dir}`;

	console.log('→ Syncing layouts...');
	await $`mkdir -p ${DEST}/layouts`;
	await $`rsync -av --delete ${dir}/layouts/ ${DEST}/layouts/`;

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


