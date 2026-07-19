#!/usr/bin/env bun

/**
 * Clone Mana2 (Codeberg), build the CLI, convert cmini layouts, and write
 * gitignored static/layout-stats-mana2.json.
 *
 * Requires Go ≥ 1.26.4 and a prior cmini-sync (layouts in .cache/cmini-repo).
 * Use --offline to skip git fetch when caches already exist.
 * Use --skip-if-no-go to exit 0 when Go is unavailable (local predev).
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { $ } from 'bun';
import {
	convertCminiLayoutToMana2,
	mana2LayoutIdFromFilename
} from './mana2-layout.js';
import {
	buildMana2AnalyzerFingerprint,
	createMana2StatsCacheContext,
	encodeMana2Stats,
	extractJsonValues,
	getCachedMana2Stats,
	hashContent,
	pathExists,
	pruneMana2StatsCache,
	saveMana2StatsCache,
	setCachedMana2Stats
} from './mana2-stats.js';

const CMINI_CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
const MANA2_CACHE_DIR = join(process.cwd(), '.cache', 'mana2');
const MANA2_STATS_FILE = 'static/layout-stats-mana2.json';
const BLACKLIST_FILE = 'layout-blacklist.txt';
const MANA2_REPO = 'https://codeberg.org/Zakkkk/mana2.git';
/**
 * Pin for reproducibility; bump intentionally when upgrading Mana2.
 * When changing this, also refresh `bin/mana2-go/go.mod` + `go.sum` from that commit
 * so Actions `setup-go` caching stays accurate.
 */
const MANA2_COMMIT = process.env.MANA2_COMMIT ?? '218a675954507c8ba7a851c018270e8c7540bd02';
const MANA2_BIN = join(MANA2_CACHE_DIR, 'mana2');
const BATCH_SIZE = Number(process.env.MANA2_BATCH_SIZE ?? 24);
const MIN_GO_VERSION = [1, 26, 4];

/**
 * @returns {Promise<boolean>}
 */
async function goAvailable() {
	const probe = await $`go version`.quiet().nothrow();
	if (probe.exitCode !== 0) return false;
	const text = probe.stdout.toString();
	const match = text.match(/go(\d+)\.(\d+)(?:\.(\d+))?/);
	if (!match) return false;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3] ?? 0);
	if (major > MIN_GO_VERSION[0]) return true;
	if (major < MIN_GO_VERSION[0]) return false;
	if (minor > MIN_GO_VERSION[1]) return true;
	if (minor < MIN_GO_VERSION[1]) return false;
	return patch >= MIN_GO_VERSION[2];
}

async function loadBlacklist() {
	try {
		const content = await readFile(BLACKLIST_FILE, 'utf-8');
		/** @type {Set<string>} */
		const blacklist = new Set();
		for (const line of content.split('\n')) {
			const entry = line.trim();
			if (!entry || entry.startsWith('#')) continue;
			blacklist.add(entry);
			blacklist.add(entry.replace(/\.json$/i, ''));
			if (!entry.endsWith('.json')) blacklist.add(`${entry}.json`);
		}
		return blacklist;
	} catch {
		return new Set();
	}
}

/**
 * @param {boolean} offline
 */
async function ensureMana2Checkout(offline) {
	const exists = await pathExists(join(MANA2_CACHE_DIR, '.git'));
	if (!exists) {
		if (offline) {
			throw new Error(`mana2 cache missing at ${MANA2_CACHE_DIR}. Run without --offline.`);
		}
		console.log('→ Cloning mana2 from Codeberg...');
		await mkdir(join(process.cwd(), '.cache'), { recursive: true });
		await $`git clone ${MANA2_REPO} ${MANA2_CACHE_DIR}`;
	} else if (offline) {
		console.log('→ Using existing mana2 cache (offline)...');
	} else {
		console.log('→ Updating mana2 cache...');
		await $`git -C ${MANA2_CACHE_DIR} fetch --tags origin`.nothrow();
	}

	const current = (await $`git -C ${MANA2_CACHE_DIR} rev-parse HEAD`.text()).trim();
	if (current !== MANA2_COMMIT) {
		console.log(`→ Checking out mana2 @ ${MANA2_COMMIT.slice(0, 12)}...`);
		const fetched = await $`git -C ${MANA2_CACHE_DIR} cat-file -e ${MANA2_COMMIT}^{commit}`
			.quiet()
			.nothrow();
		if (fetched.exitCode !== 0) {
			await $`git -C ${MANA2_CACHE_DIR} fetch origin ${MANA2_COMMIT}`;
		}
		await $`git -C ${MANA2_CACHE_DIR} checkout --detach ${MANA2_COMMIT}`;
	} else {
		console.log(`→ mana2 already at ${MANA2_COMMIT.slice(0, 12)}`);
	}

	// Keep CI logs clean; parsed corpus stays on disk for cache hits.
	const configPath = join(MANA2_CACHE_DIR, 'config.jsonc');
	try {
		const config = JSON.parse(
			(await readFile(configPath, 'utf-8')).replace(/\/\/.*$/gm, '')
		);
		config.hideUpdateMessage = true;
		config.corpus = config.corpus || 'monkeyracer';
		config.engine = config.engine || 'standard';
		await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
	} catch {
		await writeFile(
			configPath,
			JSON.stringify(
				{
					corpus: 'monkeyracer',
					engine: 'standard',
					disableSuggestions: true,
					parseOptions: {
						includeSpacegrams: true,
						keepCapitalisation: false,
						trigramsMax: 2000
					},
					hideUpdateMessage: true
				},
				null,
				2
			) + '\n',
			'utf-8'
		);
	}
}

async function ensureMana2Binary() {
	const commit = (await $`git -C ${MANA2_CACHE_DIR} rev-parse HEAD`.text()).trim();
	const stampPath = join(MANA2_CACHE_DIR, '.emulayout-bin-commit');
	let stamp = '';
	try {
		stamp = (await readFile(stampPath, 'utf-8')).trim();
	} catch {
		// missing
	}

	const binOk = await pathExists(MANA2_BIN);
	if (binOk && stamp === commit) {
		console.log('→ mana2 binary up to date');
		return commit;
	}

	console.log('→ Building mana2 CLI...');
	await $`go build -o ${MANA2_BIN} ./cmd/cli`.cwd(MANA2_CACHE_DIR);
	await writeFile(stampPath, commit + '\n', 'utf-8');
	return commit;
}

/**
 * @param {string} arg
 * @returns {Promise<{ exitCode: number, text: string }>}
 */
async function runMana2Cli(arg) {
	const proc = Bun.spawn([MANA2_BIN, arg], {
		cwd: MANA2_CACHE_DIR,
		stdout: 'pipe',
		stderr: 'pipe'
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited
	]);
	return { exitCode, text: stdout + (stderr ? `\n${stderr}` : '') };
}

/**
 * @param {string[]} layoutIds
 * @returns {Promise<Map<string, import('./mana2-stats.js').Mana2StatsJson>>}
 */
async function runMana2JsonBatch(layoutIds) {
	/** @type {Map<string, import('./mana2-stats.js').Mana2StatsJson>} */
	const byId = new Map();
	if (layoutIds.length === 0) return byId;

	const command = layoutIds.map((id) => `(json ${id})`).join(' ');
	const result = await runMana2Cli(command);
	const values = extractJsonValues(result.text);
	if (values.length === layoutIds.length) {
		for (let i = 0; i < layoutIds.length; i++) {
			byId.set(layoutIds[i], /** @type {import('./mana2-stats.js').Mana2StatsJson} */ (values[i]));
		}
		return byId;
	}

	// Fallback: analyze one-by-one so a single bad layout does not drop the batch.
	for (const id of layoutIds) {
		const single = await runMana2Cli(`json ${id}`);
		const parsed = extractJsonValues(single.text);
		if (parsed.length >= 1) {
			byId.set(id, /** @type {import('./mana2-stats.js').Mana2StatsJson} */ (parsed[0]));
		} else {
			console.warn(
				`  ⚠ mana2 failed for ${id}: ${single.text.slice(0, 200).replace(/\s+/g, ' ')}`
			);
		}
	}
	return byId;
}

async function run() {
	const offline = process.argv.includes('--offline') || process.env.MANA2_SYNC_OFFLINE === '1';
	const skipIfNoGo =
		process.argv.includes('--skip-if-no-go') || process.env.MANA2_SKIP_IF_NO_GO === '1';

	if (!(await goAvailable())) {
		const message = `Go ≥ ${MIN_GO_VERSION.join('.')} is required for mana2-sync`;
		if (skipIfNoGo || !process.env.CI) {
			console.warn(`⚠ ${message}; skipping mana2 stats`);
			process.exit(0);
		}
		throw new Error(message);
	}

	const cminiLayoutsDir = join(CMINI_CACHE_DIR, 'layouts');
	if (!(await pathExists(cminiLayoutsDir))) {
		throw new Error(
			`cmini layouts missing at ${cminiLayoutsDir}. Run: bun run ./bin/cmini-sync.js`
		);
	}

	await ensureMana2Checkout(offline);
	const mana2Commit = await ensureMana2Binary();

	const blacklist = await loadBlacklist();
	const analyzerFingerprint = await buildMana2AnalyzerFingerprint(mana2Commit);
	const statsCache = await createMana2StatsCacheContext(analyzerFingerprint);

	const cacheFiles = (await readdir(cminiLayoutsDir)).filter((f) => f.endsWith('.json'));
	console.log(`→ Converting ${cacheFiles.length} cmini layouts for mana2...`);

	const layoutsOutDir = join(MANA2_CACHE_DIR, 'data', 'layouts');
	await mkdir(layoutsOutDir, { recursive: true });

	/**
	 * @typedef {{
	 *   cminiFilename: string,
	 *   layoutName: string,
	 *   mana2Id: string,
	 *   layoutHash: string,
	 *   cachedStats: number[] | null
	 * }} WorkItem
	 */

	/** @type {WorkItem[]} */
	const work = [];
	let convertSkipped = 0;
	/** @type {Map<string, number>} */
	const skipReasons = new Map();

	for (const filename of cacheFiles) {
		const layoutNameGuess = filename.replace(/\.json$/i, '');
		if (blacklist.has(layoutNameGuess) || blacklist.has(filename)) {
			convertSkipped++;
			continue;
		}

		const path = join(cminiLayoutsDir, filename);
		const content = await readFile(path, 'utf-8');
		let raw;
		try {
			raw = JSON.parse(content);
		} catch {
			convertSkipped++;
			skipReasons.set('invalid-json', (skipReasons.get('invalid-json') ?? 0) + 1);
			continue;
		}

		const converted = convertCminiLayoutToMana2(raw);
		if (!converted.file) {
			convertSkipped++;
			const reason = converted.reason ?? 'incompatible';
			skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
			continue;
		}

		const mana2Id = mana2LayoutIdFromFilename(filename);
		const jsoncPath = join(layoutsOutDir, `${mana2Id}.jsonc`);
		const jsoncBody = JSON.stringify(converted.file, null, 2) + '\n';
		await writeFile(jsoncPath, jsoncBody, 'utf-8');

		const layoutHash = hashContent(content + '\0' + jsoncBody);
		const cachedStats = getCachedMana2Stats(statsCache, filename, layoutHash);
		work.push({
			cminiFilename: filename,
			layoutName: typeof raw.name === 'string' ? raw.name : layoutNameGuess,
			mana2Id,
			layoutHash,
			cachedStats
		});
	}

	console.log(`  ✔ Converted ${work.length} layouts (${convertSkipped} skipped)`);
	if (skipReasons.size > 0) {
		const top = [...skipReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
		for (const [reason, count] of top) {
			console.log(`    · ${count}× ${reason}`);
		}
	}

	/** @type {Record<string, number[]>} */
	const layoutStats = {};
	/** @type {WorkItem[]} */
	const needCompute = [];

	for (const item of work) {
		if (item.cachedStats) {
			layoutStats[item.layoutName] = item.cachedStats;
		} else {
			needCompute.push(item);
		}
	}

	console.log(
		`→ Analyzing with mana2 (${needCompute.length} to compute, ${work.length - needCompute.length} cache hits)...`
	);

	for (let i = 0; i < needCompute.length; i += BATCH_SIZE) {
		const batch = needCompute.slice(i, i + BATCH_SIZE);
		const results = await runMana2JsonBatch(batch.map((item) => item.mana2Id));

		for (const item of batch) {
			const rawStats = results.get(item.mana2Id);
			if (!rawStats) continue;
			const compact = encodeMana2Stats(rawStats);
			if (!compact) {
				console.warn(`  ⚠ Could not encode mana2 stats for ${item.layoutName}`);
				continue;
			}
			layoutStats[item.layoutName] = compact;
			setCachedMana2Stats(statsCache, item.cminiFilename, item.layoutHash, compact);
		}

		if ((i / BATCH_SIZE) % 10 === 0 || i + BATCH_SIZE >= needCompute.length) {
			const done = Math.min(i + BATCH_SIZE, needCompute.length);
			console.log(`  … ${done}/${needCompute.length}`);
		}
	}

	await mkdir('static', { recursive: true });
	const sortedStats = Object.fromEntries(
		Object.keys(layoutStats)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, layoutStats[name]])
	);
	await writeFile(MANA2_STATS_FILE, JSON.stringify(sortedStats) + '\n', 'utf-8');

	pruneMana2StatsCache(statsCache, new Set(work.map((item) => item.cminiFilename)));
	await saveMana2StatsCache(statsCache);

	console.log(
		`  ✔ Mana2 stats for ${Object.keys(sortedStats).length} layouts (cache ${statsCache.hits} hits / ${statsCache.misses} rebuilt)`
	);
	console.log('Done');
}

run().catch((err) => {
	console.error('❌ mana2-sync failed:', err);
	process.exit(1);
});
