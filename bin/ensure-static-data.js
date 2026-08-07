#!/usr/bin/env bun

import { access } from 'node:fs/promises';
import { $ } from 'bun';

const REQUIRED_FILES = [
	'static/all-layouts.json',
	'static/layout-supplemental.json',
	'static/authors.json',
	'static/layout-likes.json',
	'static/layout-stats-cmini-monkeyracer.json',
	'static/layout-stats-cyanophage.json'
];

async function exists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

const missing = [];
for (const file of REQUIRED_FILES) {
	if (!(await exists(file))) missing.push(file);
}

if (missing.length === 0) {
	process.exit(0);
}

console.log('→ Layout data missing for local dev:');
for (const file of missing) {
	console.log(`  - ${file}`);
}
console.log('→ Generating from cached sources...');

await $`bun run ./bin/catalog-sync.js --offline`;
await $`bun run ./bin/cmini-stats-sync.js --offline`;
await $`bun run ./bin/cyanophage-stats-sync.js`;
