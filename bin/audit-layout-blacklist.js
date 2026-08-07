#!/usr/bin/env bun

import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const CMINI_LAYOUTS_DIR =
	process.env.CMINI_LAYOUTS_DIR ?? join(process.cwd(), '.cache', 'cmini-repo', 'layouts');
const BLACKLIST_FILE = join(process.cwd(), 'layout-blacklist.txt');

/**
 * @param {string} content
 * @returns {string[]}
 */
export function parseBlacklistEntries(content) {
	return content
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'));
}

/**
 * @param {readonly string[]} blacklistEntries
 * @param {readonly string[]} layoutFiles
 * @returns {string[]}
 */
export function findAbsentBlacklistEntries(blacklistEntries, layoutFiles) {
	const layoutNames = new Set(
		layoutFiles
			.filter((filename) => filename.toLowerCase().endsWith('.json'))
			.map((filename) => filename.replace(/\.json$/i, ''))
	);
	return [...new Set(blacklistEntries)]
		.filter((entry) => !layoutNames.has(entry.replace(/\.json$/i, '')))
		.sort((a, b) => a.localeCompare(b));
}

async function run() {
	try {
		await access(CMINI_LAYOUTS_DIR);
	} catch {
		throw new Error(
			`Cmini layouts not found at ${CMINI_LAYOUTS_DIR}. Run bun run ./bin/catalog-sync.js once, or set CMINI_LAYOUTS_DIR.`
		);
	}

	const [blacklistContent, layoutFiles] = await Promise.all([
		readFile(BLACKLIST_FILE, 'utf-8'),
		readdir(CMINI_LAYOUTS_DIR)
	]);
	const blacklistEntries = parseBlacklistEntries(blacklistContent);
	const absentEntries = findAbsentBlacklistEntries(blacklistEntries, layoutFiles);

	if (absentEntries.length === 0) {
		console.log(
			`✓ All ${blacklistEntries.length} blacklist entries are currently present in Cmini`
		);
		return;
	}

	const absentLabel = absentEntries.length === 1 ? 'entry is' : 'entries are';
	console.log(
		`⚠ ${absentEntries.length} of ${blacklistEntries.length} blacklist ${absentLabel} not currently present in Cmini:`
	);
	for (const entry of absentEntries) console.log(`  ${entry}`);
	console.log(
		'\nReview before removing: an entry may be intentionally retained in case it returns.'
	);
}

if (import.meta.main) {
	run().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
