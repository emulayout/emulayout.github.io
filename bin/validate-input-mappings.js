#!/usr/bin/env bun

import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadMagicKeyMappings } from './magic-key-data.js';
import { loadAdaptiveSwapSources } from './adaptive-swap-data.js';
import { validateInputMappingsForLayouts } from './input-mapping-validation.js';

const CMINI_LAYOUTS_DIR =
	process.env.CMINI_LAYOUTS_DIR ?? join(process.cwd(), '.cache', 'cmini-repo', 'layouts');
const BLACKLIST_FILE = join(process.cwd(), 'layout-blacklist.txt');

async function loadBlacklist() {
	const content = await readFile(BLACKLIST_FILE, 'utf-8');
	const blacklist = new Set();
	for (const rawLine of content.split('\n')) {
		const entry = rawLine.trim();
		if (!entry || entry.startsWith('#')) continue;
		blacklist.add(entry);
		blacklist.add(entry.replace(/\.json$/i, ''));
		if (!entry.endsWith('.json')) blacklist.add(`${entry}.json`);
	}
	return blacklist;
}

async function run() {
	try {
		await access(CMINI_LAYOUTS_DIR);
	} catch {
		throw new Error(
			`Cmini layouts not found at ${CMINI_LAYOUTS_DIR}. Run bun run ./bin/cmini-sync.js once, or set CMINI_LAYOUTS_DIR.`
		);
	}

	const [layoutFiles, blacklist, magicKeyMappings, adaptiveSwapSources] = await Promise.all([
		readdir(CMINI_LAYOUTS_DIR).then((files) => files.filter((file) => file.endsWith('.json'))),
		loadBlacklist(),
		loadMagicKeyMappings(),
		loadAdaptiveSwapSources()
	]);

	const result = await validateInputMappingsForLayouts({
		layoutsDir: CMINI_LAYOUTS_DIR,
		layoutFiles,
		blacklist,
		magicKeyMappings,
		adaptiveSwapSources
	});

	console.log(
		`✓ Validated ${result.magicKeyProfileCount} magic-key and ${result.adaptiveSwapProfileCount} adaptive-swap mapping profiles`
	);
}

run().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
