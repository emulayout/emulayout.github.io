#!/usr/bin/env bun

/**
 * Sync the Clemenpine catalog API and publish layout catalog artifacts:
 * all-layouts, supplemental, likes, authors.
 *
 * Does not import analyzer stats or compute Cyanophage metrics.
 * Use --offline to skip the API and reuse `.cache/clemenpine`.
 *
 * A failed or incomplete API response never replaces the last good cache or
 * published catalog. When a previous catalog exists, the script keeps it and
 * exits successfully so CI can still deploy.
 */

import { access, appendFile, mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { transformLayout } from './layout-transformer.js';
import { encodeLayout, layoutEntryName } from './layout-codec.js';
import { cyanophageStatsNeedMagicMappings } from './cyanophage-magic.js';
import {
	defaultMagicMappings,
	hasAdaptiveSwapMappings,
	hasMagicKeyMappings,
	hasRepeatKey
} from './layout-features.js';
import {
	LAYOUTS_FILE,
	parseOfflineForceArgs,
	writeFileAtomically,
	writeTextFileIfChanged
} from './sync-shared.js';
import { isExcludedLayout, loadMemeFilterExclusions } from './cminibrowser-meme-filter.js';
import {
	loadCminibrowserMagicRules,
	supplementalByLowerLayoutId
} from './cminibrowser-magic-rules.js';
import {
	CLEMENPINE_SYNCED_HASH_FILE,
	ClemenpineCatalogUnavailableError,
	deriveLayoutLikes,
	ensureClemenpineCatalog,
	hashCachedClemenpineSources
} from './clemenpine-cache.js';

const SUPPLEMENTAL_FILE = 'static/layout-supplemental.json';
const LIKES_FILE = 'static/layout-likes.json';
const AUTHORS_FILE = 'static/authors.json';

async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

/**
 * @param {boolean} changed
 */
async function writeCminiChangedOutput(changed) {
	const line = `cmini_changed=${changed ? 'true' : 'false'}\n`;
	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, line);
	}
}

/**
 * @param {boolean} rebuilt
 */
async function writeCatalogRebuiltOutput(rebuilt) {
	const line = `catalog_rebuilt=${rebuilt ? 'true' : 'false'}\n`;
	if (process.env.GITHUB_OUTPUT) {
		await appendFile(process.env.GITHUB_OUTPUT, line);
	}
}

async function hasPublishedCatalog() {
	return (
		(await pathExists(LAYOUTS_FILE)) &&
		(await pathExists(SUPPLEMENTAL_FILE)) &&
		(await pathExists(AUTHORS_FILE)) &&
		(await pathExists(LIKES_FILE))
	);
}

/**
 * Publish the four coupled catalog artifacts with rollback on a write failure.
 * All bodies are prepared before this starts, so processing failures cannot
 * leave a partially refreshed artifact set.
 *
 * @param {ReadonlyMap<string, string>} bodies
 */
async function publishCatalogArtifacts(bodies) {
	/** @type {Map<string, Buffer | null>} */
	const previous = new Map();
	for (const path of bodies.keys()) {
		try {
			previous.set(path, await readFile(path));
		} catch (error) {
			if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
			previous.set(path, null);
		}
	}

	try {
		for (const [path, body] of bodies) await writeTextFileIfChanged(path, body);
	} catch (error) {
		const rollbackErrors = [];
		for (const [path, body] of previous) {
			try {
				if (body === null) {
					await unlink(path).catch((unlinkError) => {
						if (/** @type {NodeJS.ErrnoException} */ (unlinkError).code !== 'ENOENT') {
							throw unlinkError;
						}
					});
				} else {
					await writeFileAtomically(path, body);
				}
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		}
		if (rollbackErrors.length > 0) {
			throw new AggregateError(
				[error, ...rollbackErrors],
				'Catalog publication failed and rollback was incomplete',
				{ cause: error }
			);
		}
		throw error;
	}
}

/**
 * @param {unknown} error
 */
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * @param {import('./clemenpine-cache.js').ClemenpineLayout} layout
 * @param {Set<string>} excludedLayouts
 * @param {ReadonlyMap<string, import('../src/lib/layoutSupplemental.ts').LayoutSupplemental>} supplementalByLowerId
 */
function encodeCatalogLayout(layout, excludedLayouts, supplementalByLowerId) {
	if (isExcludedLayout(layout.name, excludedLayouts)) return null;

	const rawLayout = {
		name: layout.name,
		user: layout.user,
		board: layout.board,
		keys: layout.keys
	};
	const transformedLayout = transformLayout(rawLayout);
	const supplemental = supplementalByLowerId.get(layout.name.toLowerCase());
	const variants = supplemental?.variants ?? [];
	transformedLayout.updatedAt = layout.modifiedAt;
	transformedLayout.hasMagicKeyMappings = hasMagicKeyMappings(variants);
	transformedLayout.hasMagicKey = transformedLayout.hasMagicKeyMappings;
	transformedLayout.hasRepeatKey = hasRepeatKey(rawLayout.keys, defaultMagicMappings(variants));
	transformedLayout.cyanophageStatsNeedMagicMappings = cyanophageStatsNeedMagicMappings(
		defaultMagicMappings(variants),
		rawLayout.keys
	);
	transformedLayout.hasAdaptiveSwapMappings = hasAdaptiveSwapMappings(variants);
	transformedLayout.hasAdaptiveSwap = transformedLayout.hasAdaptiveSwapMappings;
	return {
		encoded: encodeLayout(transformedLayout),
		supplemental: supplemental ? { name: layout.name, supplemental } : null
	};
}

async function run() {
	const argv = process.argv.slice(2);
	const { offline, force } = parseOfflineForceArgs(argv, {
		offlineEnv: 'CMINI_SYNC_OFFLINE'
	});
	const skipIfUnchanged =
		argv.includes('--skip-if-unchanged') || process.env.CATALOG_SYNC_SKIP_IF_UNCHANGED === '1';

	console.log('→ Loading Clemenpine catalog...');
	let catalogResult;
	try {
		catalogResult = await ensureClemenpineCatalog({ offline, force });
	} catch (error) {
		if (error instanceof ClemenpineCatalogUnavailableError && (await hasPublishedCatalog())) {
			console.error(`  ⚠ ${errorMessage(error)}`);
			console.error('  Keeping the complete last published catalog.');
			await writeCminiChangedOutput(false);
			await writeCatalogRebuiltOutput(false);
			console.log('Done');
			return;
		}
		throw error;
	}
	const { layouts } = catalogResult.json.layouts;
	const authors = catalogResult.json.authors;
	if (catalogResult.fromCache && !offline) {
		console.warn('  ⚠ Catalog served from the complete last-good snapshot');
	}
	console.log(`  ✔ ${layouts.length} layouts, ${Object.keys(authors).length} authors`);

	const sourceHash = await hashCachedClemenpineSources();
	let previousHash = null;
	try {
		previousHash = (await readFile(CLEMENPINE_SYNCED_HASH_FILE, 'utf-8')).trim();
	} catch {
		// first successful sync after this marker existed
	}
	const cminiChanged = previousHash !== sourceHash;
	await writeCminiChangedOutput(cminiChanged);

	console.log('→ Loading AKL meme filter...');
	const memeFilter = await loadMemeFilterExclusions({ offline, force, argv });
	const excludedLayouts = memeFilter.excluded;
	console.log(
		`  ✔ Excluding ${memeFilter.size} meme-tier layouts (corpus=${memeFilter.corpus}` +
			(memeFilter.cutoff == null ? '' : `, cutoff=${memeFilter.cutoff}`) +
			(memeFilter.updated ? ', dump updated' : '') +
			')'
	);

	console.log('→ Loading AKL Magic and Adaptive mappings...');
	const magicRules = await loadCminibrowserMagicRules({ offline, force });
	const supplementalByLowerId = supplementalByLowerLayoutId(magicRules.supplementalByLayoutId);
	console.log(
		`  ✔ Input mappings for ${magicRules.supplementalByLayoutId.size} layouts` +
			(magicRules.updated ? ' (dump updated)' : '')
	);

	if (
		!cminiChanged &&
		!memeFilter.updated &&
		!magicRules.updated &&
		skipIfUnchanged &&
		(await hasPublishedCatalog())
	) {
		console.log(
			`✔ Clemenpine catalog and AKL inputs unchanged (${sourceHash.slice(0, 12)}); skipping catalog rebuild`
		);
		await writeCatalogRebuiltOutput(false);
		console.log('Done');
		return;
	}

	let beforeLayouts = [];
	try {
		beforeLayouts = JSON.parse(await readFile(LAYOUTS_FILE, 'utf-8'));
	} catch {
		// first run
	}

	console.log('→ Transforming layouts...');
	await mkdir('static', { recursive: true });

	const layoutNamesLower = new Set(layouts.map((layout) => layout.name.toLowerCase()));
	for (const layoutId of magicRules.layoutIds) {
		if (layoutNamesLower.has(layoutId.toLowerCase())) continue;
		console.warn(
			`  ⚠ AKL input mappings ${layoutId} have no matching catalog layout; skipping them`
		);
	}

	const transformedLayouts = [];
	const publishedSupplementalByName = new Map();

	for (const layout of layouts) {
		const result = encodeCatalogLayout(layout, excludedLayouts, supplementalByLowerId);
		if (!result) continue;
		transformedLayouts.push(result.encoded);
		if (result.supplemental) {
			publishedSupplementalByName.set(result.supplemental.name, result.supplemental.supplemental);
		}
	}

	transformedLayouts.sort((a, b) => a[0].localeCompare(b[0]));
	const publishedSupplemental = Object.fromEntries(
		[...publishedSupplementalByName.entries()].sort(([left], [right]) => left.localeCompare(right))
	);
	const layoutLikes = deriveLayoutLikes(
		layouts.filter((layout) => !isExcludedLayout(layout.name, excludedLayouts))
	);

	console.log('→ Publishing catalog artifacts...');
	await publishCatalogArtifacts(
		new Map([
			[LAYOUTS_FILE, JSON.stringify(transformedLayouts) + '\n'],
			[SUPPLEMENTAL_FILE, JSON.stringify(publishedSupplemental) + '\n'],
			[LIKES_FILE, JSON.stringify(layoutLikes) + '\n'],
			[AUTHORS_FILE, JSON.stringify(authors) + '\n']
		])
	);
	console.log(`  ✔ Catalog: ${transformedLayouts.length} layouts`);
	console.log(`  ✔ Supplemental data for ${Object.keys(publishedSupplemental).length} layouts`);
	console.log(`  ✔ Likes for ${Object.keys(layoutLikes).length} layouts`);
	console.log(`  ✔ Authors: ${Object.keys(authors).length}`);

	const beforeNames = new Set(beforeLayouts.map(layoutEntryName));
	const afterNames = new Set(transformedLayouts.map((l) => l[0]));
	const added = transformedLayouts.filter((l) => !beforeNames.has(l[0])).map((l) => l[0]);
	const removed = beforeLayouts
		.filter((l) => !afterNames.has(layoutEntryName(l)))
		.map(layoutEntryName);
	const beforeHashes = new Map(
		beforeLayouts.map((l) => [
			layoutEntryName(l),
			createHash('md5').update(JSON.stringify(l)).digest('hex')
		])
	);
	const modified = transformedLayouts
		.filter((l) => {
			const beforeHash = beforeHashes.get(l[0]);
			if (!beforeHash) return false;
			return beforeHash !== createHash('md5').update(JSON.stringify(l)).digest('hex');
		})
		.map((l) => l[0]);

	if (added.length === 0 && modified.length === 0 && removed.length === 0) {
		console.log('✔ No layout changes');
	} else {
		console.log('✔ Layout changes:');
		if (added.length > 0) {
			console.log(`  Added (${added.length}):`);
			added.sort().forEach((name) => console.log(`    + ${name}`));
		}
		if (modified.length > 0) {
			console.log(`  Modified (${modified.length}):`);
			modified.sort().forEach((name) => console.log(`    ~ ${name}`));
		}
		if (removed.length > 0) {
			console.log(`  Removed (${removed.length}):`);
			removed.sort().forEach((name) => {
				const reason = isExcludedLayout(name, excludedLayouts)
					? ' (meme-filtered)'
					: ' (removed from catalog)';
				console.log(`    - ${name}${reason}`);
			});
		}
	}

	await mkdir(join(process.cwd(), '.cache'), { recursive: true });
	await writeFileAtomically(CLEMENPINE_SYNCED_HASH_FILE, `${sourceHash}\n`);
	await writeCatalogRebuiltOutput(true);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ catalog-sync failed:', err);
	process.exit(1);
});
