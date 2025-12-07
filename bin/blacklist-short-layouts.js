#!/usr/bin/env bun

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const LAYOUTS_DIR = '.cache/cmini-repo/layouts';
const BLACKLIST_FILE = 'layout-blacklist.txt';
const MIN_KEY_COUNT = 15;

async function blacklistShortLayouts() {
	// Read all layout files from cache directory
	const files = await readdir(LAYOUTS_DIR);
	const layoutFiles = files.filter((f) => f.endsWith('.json'));

	const shortLayouts = [];
	for (const filename of layoutFiles) {
		try {
			const filePath = join(LAYOUTS_DIR, filename);
			const content = await readFile(filePath, 'utf-8');
			const layout = JSON.parse(content);
			const keyCount = Object.keys(layout.keys || {}).length;
			if (keyCount < MIN_KEY_COUNT) {
				shortLayouts.push(layout.name);
			}
		} catch (err) {
			console.error(`Error reading ${filename}:`, err.message);
		}
	}

	// Read existing blacklist
	const blacklistContent = await readFile(BLACKLIST_FILE, 'utf-8');
	const existingBlacklist = blacklistContent
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'));

	const existingSet = new Set(existingBlacklist);

	// Find layouts to add (not already in blacklist)
	const toAdd = shortLayouts.filter((name) => !existingSet.has(name));

	console.log(`Found ${shortLayouts.length} short layouts total`);
	console.log(`Found ${existingBlacklist.length} layouts in blacklist`);
	console.log(`Found ${toAdd.length} layouts to add`);

	if (toAdd.length === 0) {
		console.log('All short layouts are already in the blacklist.');
		return;
	}

	// Append to blacklist
	const newContent = blacklistContent.trim() + '\n' + toAdd.join('\n') + '\n';
	await writeFile(BLACKLIST_FILE, newContent, 'utf-8');

	console.log(`Added ${toAdd.length} layouts to blacklist:`);
	toAdd.forEach((name) => console.log(`  - ${name}`));
}

blacklistShortLayouts().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
