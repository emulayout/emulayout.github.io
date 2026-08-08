#!/usr/bin/env bun

/**
 * Sync the cmini catalog clone and publish layout catalog artifacts:
 * all-layouts, supplemental, likes, authors.
 *
 * Does not import analyzer stats or compute Cyanophage metrics.
 * Use --offline to skip git fetch and reuse `.cache/cmini-repo`.
 */

import { access, appendFile, readFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { $ } from 'bun';
import { transformLayout } from './layout-transformer.js';
import { encodeLayout, layoutEntryName } from './layout-codec.js';
import { loadLayoutSupplementalData } from './layout-data.js';
import { validateSupplementalDataForLayouts } from './input-mapping-validation.js';
import { buildLayoutTimestamps } from './layout-timestamps.js';
import { cyanophageStatsNeedMagicMappings } from './cyanophage-magic.js';
import {
	defaultMagicMappings,
	hasAdaptiveSwapMappings,
	hasMagicKeyMappings,
	hasMagicKeyMarker,
	hasRepeatKey
} from './layout-features.js';
import {
	CMINI_CACHE_DIR,
	LAYOUTS_FILE,
	loadBlacklist,
	parseOfflineForceArgs
} from './sync-shared.js';

const SUPPLEMENTAL_FILE = 'static/layout-supplemental.json';
const LIKES_FILE = 'static/layout-likes.json';
const ADAPTIVE_LAYOUTS_FILE = 'adaptive-layouts.txt';
const SYNCED_HEAD_FILE = join(process.cwd(), '.cache', 'cmini-synced-head');
const SPARSE_CHECKOUT = ['layouts', '/authors.json', '/likes.json'];
/** Worktree paths for `git checkout` (no leading-slash sparse patterns). */
const SPARSE_CHECKOUT_WORKTREE = SPARSE_CHECKOUT.map((path) => path.replace(/^\//, ''));
const REPO = process.env.CI ? 'https://github.com/Apsu/cmini.git' : 'git@github.com:Apsu/cmini.git';
const SYNC_CONCURRENCY = Number(process.env.CMINI_SYNC_CONCURRENCY ?? 16);

async function resolveDefaultBranch() {
	try {
		const branch = await $`git -C ${CMINI_CACHE_DIR} rev-parse --abbrev-ref origin/HEAD`.text();
		return branch.trim().replace('origin/', '');
	} catch {
		const main = await $`git -C ${CMINI_CACHE_DIR} rev-parse origin/main`.quiet().nothrow();
		if (main.exitCode === 0) return 'main';
		return 'master';
	}
}

async function loadAdaptiveLayoutNames() {
	const content = await readFile(ADAPTIVE_LAYOUTS_FILE, 'utf-8');
	return new Set(
		content
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'))
	);
}

/**
 * @param {import('../src/lib/layoutSupplemental.ts').LayoutSupplemental} supplemental
 * @param {ReadonlySet<string> | undefined} staleIds
 */
function markStaleVariants(supplemental, staleIds) {
	if (!staleIds?.size) return supplemental;
	return {
		...supplemental,
		variants: supplemental.variants.map((variant) =>
			staleIds.has(variant.id) ? { ...variant, stale: true } : variant
		)
	};
}

/**
 * @param {Set<string>} validLayoutNames
 * @returns {Promise<Record<string, number>>}
 */
async function loadLayoutLikes(validLayoutNames) {
	try {
		const content = await readFile(join(CMINI_CACHE_DIR, 'likes.json'), 'utf-8');
		const parsed = JSON.parse(content);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

		const likeCounts = {};
		for (const [layoutName, likes] of Object.entries(parsed)) {
			if (!validLayoutNames.has(layoutName)) continue;
			if (!Array.isArray(likes)) continue;
			likeCounts[layoutName] = likes.length;
		}

		return Object.fromEntries(
			Object.keys(likeCounts)
				.sort((a, b) => a.localeCompare(b))
				.map((name) => [name, likeCounts[name]])
		);
	} catch (err) {
		console.warn(`  ⚠ Could not load likes.json (${err.message}); likes will be skipped`);
		return {};
	}
}

async function applySparseCheckout() {
	await $`cd ${CMINI_CACHE_DIR} && git sparse-checkout set --no-cone ${SPARSE_CHECKOUT}`;
	await $`git -C ${CMINI_CACHE_DIR} checkout HEAD -- ${SPARSE_CHECKOUT_WORKTREE}`;
}

/**
 * @param {boolean} offline
 */
async function ensureCache(offline) {
	const cacheExists = await access(CMINI_CACHE_DIR)
		.then(() => true)
		.catch(() => false);

	if (!cacheExists) {
		if (offline) {
			throw new Error(
				`cmini cache missing at ${CMINI_CACHE_DIR}. Run: bun run ./bin/catalog-sync.js`
			);
		}
		console.log('→ Initial clone (this may take a while)...');
		await mkdir(CMINI_CACHE_DIR, { recursive: true });
		await $`git clone --filter=blob:none --sparse ${REPO} ${CMINI_CACHE_DIR}`;
		await applySparseCheckout();
	} else if (offline) {
		console.log('→ Using existing cmini cache (offline)...');
	} else {
		console.log('→ Updating cache...');
		const isShallow = (
			await $`git -C ${CMINI_CACHE_DIR} rev-parse --is-shallow-repository`.text()
		).trim();
		if (isShallow === 'true') {
			console.log('→ Unshallowing cache for layout timestamps...');
			await $`git -C ${CMINI_CACHE_DIR} fetch --unshallow`.nothrow();
		}
		const branchName = await resolveDefaultBranch();
		const localHead = (await $`git -C ${CMINI_CACHE_DIR} rev-parse HEAD`.text()).trim();
		await $`cd ${CMINI_CACHE_DIR} && git fetch origin ${branchName}`;
		const remoteHead = (
			await $`git -C ${CMINI_CACHE_DIR} rev-parse origin/${branchName}`.text()
		).trim();
		if (localHead !== remoteHead) {
			await $`cd ${CMINI_CACHE_DIR} && git reset --hard origin/${branchName}`;
		} else {
			console.log('→ Cache already up to date');
		}
		await applySparseCheckout();
	}
}

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

async function run() {
	const argv = process.argv.slice(2);
	const { offline } = parseOfflineForceArgs(argv, {
		offlineEnv: 'CMINI_SYNC_OFFLINE'
	});
	if (argv.includes('--force')) {
		console.warn('  ⚠ catalog-sync ignores --force (use without --offline to fetch the repo)');
	}
	const skipIfUnchanged =
		argv.includes('--skip-if-unchanged') || process.env.CATALOG_SYNC_SKIP_IF_UNCHANGED === '1';

	await ensureCache(offline);

	const head = (await $`git -C ${CMINI_CACHE_DIR} rev-parse HEAD`.text()).trim();
	let previousHead = null;
	try {
		previousHead = (await readFile(SYNCED_HEAD_FILE, 'utf-8')).trim();
	} catch {
		// first successful sync after this marker existed
	}
	const cminiChanged = previousHead !== head;
	await writeCminiChangedOutput(cminiChanged);

	if (
		!cminiChanged &&
		skipIfUnchanged &&
		(await pathExists(LAYOUTS_FILE)) &&
		(await pathExists(SUPPLEMENTAL_FILE)) &&
		(await pathExists(LIKES_FILE)) &&
		(await pathExists('static/authors.json'))
	) {
		console.log(`✔ cmini HEAD unchanged (${head.slice(0, 12)}); skipping catalog rebuild`);
		console.log('Done');
		return;
	}

	const blacklist = await loadBlacklist();
	const adaptiveLayoutNames = await loadAdaptiveLayoutNames();

	let beforeLayouts = [];
	try {
		beforeLayouts = JSON.parse(await readFile(LAYOUTS_FILE, 'utf-8'));
	} catch {
		// first run
	}

	console.log('→ Syncing and transforming layouts...');
	await $`mkdir -p static`;

	const cacheLayoutsDir = join(CMINI_CACHE_DIR, 'layouts');
	const cacheFiles = await readdir(cacheLayoutsDir);
	const layoutFiles = cacheFiles.filter((f) => f.endsWith('.json'));
	const layoutFileSet = new Set(layoutFiles);
	const supplementalByLayout = await loadLayoutSupplementalData();

	for (const layoutName of adaptiveLayoutNames) {
		const filename = `${layoutName}.json`;
		if (!layoutFileSet.has(filename)) {
			console.warn(
				`  ⚠ Adaptive layout ${layoutName} has no matching Cmini layout file; ignoring stale presence entry`
			);
			continue;
		}
		if (blacklist.has(layoutName) || blacklist.has(filename)) {
			throw new Error(`Adaptive layout ${layoutName} is blacklisted`);
		}
		const rawLayout = JSON.parse(await readFile(join(cacheLayoutsDir, filename), 'utf-8'));
		if (rawLayout.name !== layoutName) {
			throw new Error(
				`Adaptive layout ${layoutName} matched layout named ${JSON.stringify(rawLayout.name)}`
			);
		}
	}

	const supplementalValidation = await validateSupplementalDataForLayouts({
		layoutsDir: cacheLayoutsDir,
		layoutFiles,
		blacklist,
		supplementalByLayout,
		allowOrphanedProfiles: true,
		allowStaleVariants: true
	});
	for (const orphanedProfile of supplementalValidation.orphanedProfiles) {
		console.warn(
			`  ⚠ Supplemental data ${orphanedProfile} has no matching Cmini layout file; skipping it`
		);
	}
	/** @type {Map<string, Set<string>>} */
	const staleVariantIds = new Map();
	for (const { layoutName, variantId, missingKeys } of supplementalValidation.staleVariants) {
		if (!staleVariantIds.has(layoutName)) staleVariantIds.set(layoutName, new Set());
		staleVariantIds.get(layoutName).add(variantId);
		console.warn(
			`  ⚠ ${layoutName} variant ${variantId} references ${missingKeys.join(', ')}, no longer on the layout; marking it stale`
		);
	}

	console.log('→ Resolving layout timestamps from git history...');
	const layoutTimestamps = await buildLayoutTimestamps(CMINI_CACHE_DIR, layoutFiles);

	const transformedLayouts = [];

	/**
	 * @param {string} filename
	 */
	async function processLayoutFile(filename) {
		const layoutName = filename.replace('.json', '');
		if (blacklist.has(layoutName) || blacklist.has(filename)) return null;

		const originalContent = await readFile(join(cacheLayoutsDir, filename), 'utf-8');
		const rawLayout = JSON.parse(originalContent);
		const transformedLayout = transformLayout(rawLayout);
		const variants = supplementalByLayout.get(rawLayout.name)?.variants ?? [];
		transformedLayout.updatedAt = layoutTimestamps[filename];
		transformedLayout.hasMagicKeyMappings = hasMagicKeyMappings(variants);
		transformedLayout.hasMagicKey =
			hasMagicKeyMarker(rawLayout.keys) || transformedLayout.hasMagicKeyMappings;
		transformedLayout.hasRepeatKey = hasRepeatKey(rawLayout.keys, defaultMagicMappings(variants));
		transformedLayout.cyanophageStatsNeedMagicMappings = cyanophageStatsNeedMagicMappings(
			defaultMagicMappings(variants),
			rawLayout.keys
		);
		transformedLayout.hasAdaptiveSwapMappings = hasAdaptiveSwapMappings(variants);
		transformedLayout.hasAdaptiveSwap =
			adaptiveLayoutNames.has(rawLayout.name) || transformedLayout.hasAdaptiveSwapMappings;

		return encodeLayout(transformedLayout);
	}

	for (let i = 0; i < layoutFiles.length; i += SYNC_CONCURRENCY) {
		const batch = layoutFiles.slice(i, i + SYNC_CONCURRENCY);
		const results = await Promise.all(
			batch.map((filename) =>
				processLayoutFile(filename).catch((err) => {
					console.error(`  ⚠ Error processing ${filename}:`, err.message);
					return null;
				})
			)
		);
		for (const encoded of results) {
			if (encoded) transformedLayouts.push(encoded);
		}
	}

	transformedLayouts.sort((a, b) => a[0].localeCompare(b[0]));
	await writeFile(LAYOUTS_FILE, JSON.stringify(transformedLayouts) + '\n', 'utf-8');

	const validLayoutNames = new Set(transformedLayouts.map((layout) => layout[0]));
	const publishedSupplemental = Object.fromEntries(
		[...supplementalByLayout.keys()]
			.filter((name) => validLayoutNames.has(name))
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [
				name,
				markStaleVariants(supplementalByLayout.get(name), staleVariantIds.get(name))
			])
	);
	await writeFile(SUPPLEMENTAL_FILE, JSON.stringify(publishedSupplemental) + '\n', 'utf-8');
	console.log(`  ✔ Catalog: ${transformedLayouts.length} layouts`);
	console.log(`  ✔ Supplemental data for ${Object.keys(publishedSupplemental).length} layouts`);

	console.log('→ Building layout likes...');
	const layoutLikes = await loadLayoutLikes(validLayoutNames);
	await writeFile(LIKES_FILE, JSON.stringify(layoutLikes) + '\n', 'utf-8');
	console.log(`  ✔ Likes for ${Object.keys(layoutLikes).length} layouts`);

	console.log('→ Syncing authors...');
	await $`cp ${CMINI_CACHE_DIR}/authors.json static/authors.json`;

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
				const reason = blacklist.has(name) ? ' (blacklisted)' : ' (removed from repo)';
				console.log(`    - ${name}${reason}`);
			});
		}
	}

	await mkdir(join(process.cwd(), '.cache'), { recursive: true });
	await writeFile(SYNCED_HEAD_FILE, `${head}\n`, 'utf-8');
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ catalog-sync failed:', err);
	process.exit(1);
});
