#!/usr/bin/env bun

import { access } from 'node:fs/promises';
import { $ } from 'bun';

const REQUIRED_FILES = [
	'static/all-layouts.json',
	'static/authors.json',
	'static/layout-stats.json'
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
console.log('→ Generating from cmini cache...');

await $`bun run ./bin/cmini-sync.js --offline`;
