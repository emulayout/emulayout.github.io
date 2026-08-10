#!/usr/bin/env bun

import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadLayoutSupplementalData } from './layout-data.js';
import { validateSupplementalDataForLayouts } from './input-mapping-validation.js';
import { loadMemeFilterExclusions } from './cminibrowser-meme-filter.js';
import { parseOfflineForceArgs } from './sync-shared.js';

const CMINI_LAYOUTS_DIR =
	process.env.CMINI_LAYOUTS_DIR ?? join(process.cwd(), '.cache', 'cmini-repo', 'layouts');

async function run() {
	try {
		await access(CMINI_LAYOUTS_DIR);
	} catch {
		throw new Error(
			`Cmini layouts not found at ${CMINI_LAYOUTS_DIR}. Run bun run ./bin/catalog-sync.js once, or set CMINI_LAYOUTS_DIR.`
		);
	}

	const { offline, force } = parseOfflineForceArgs(process.argv.slice(2));
	const [layoutFiles, memeFilter, supplementalByLayout] = await Promise.all([
		readdir(CMINI_LAYOUTS_DIR).then((files) => files.filter((file) => file.endsWith('.json'))),
		loadMemeFilterExclusions({ offline, force }),
		loadLayoutSupplementalData()
	]);

	const result = await validateSupplementalDataForLayouts({
		layoutsDir: CMINI_LAYOUTS_DIR,
		layoutFiles,
		excludedLayouts: memeFilter.excluded,
		supplementalByLayout
	});

	console.log(
		`✓ Validated ${result.variantCount} mapping variants across ${result.layoutCount} layouts ` +
			`(meme filter ${memeFilter.corpus}: ${memeFilter.size} ids)`
	);
}

run().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
