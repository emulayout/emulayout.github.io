import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLE_PATH } from './cmini-analyzer.js';

const STATS_CACHE_FILE = join(process.cwd(), '.cache', 'layout-stats-monkeyracer.json');
const BIN_DIR = dirname(fileURLToPath(import.meta.url));

/** Files whose contents affect computed monkeyracer stats (beyond STATS_ALGORITHM_VERSION). */
const ANALYZER_FINGERPRINT_FILES = [
	TABLE_PATH,
	join(BIN_DIR, 'cmini-analyzer.js'),
	join(BIN_DIR, 'layout-stats.js')
];

/** Bump when trigram / merge logic changes and all cached stats must be rebuilt. */
export const STATS_ALGORITHM_VERSION = 1;

/**
 * @typedef {Object} StatsCacheEntry
 * @property {string} layoutHash
 * @property {string} trigramSourceHash
 * @property {number[]} stats
 */

/**
 * @typedef {Object} StatsCacheFile
 * @property {number} version
 * @property {string} corpusFingerprint
 * @property {string} analyzerFingerprint
 * @property {Record<string, StatsCacheEntry>} layouts
 */

/**
 * @typedef {Object} StatsCacheContext
 * @property {string} corpusFingerprint
 * @property {string} analyzerFingerprint
 * @property {Record<string, StatsCacheEntry>} layouts
 * @property {number} hits
 * @property {number} misses
 */

/**
 * @param {string} layoutContent
 */
export function hashLayoutContent(layoutContent) {
	return createHash('sha256').update(layoutContent).digest('hex');
}

/**
 * @param {string} content
 */
export function hashTrigramSource(content) {
	return createHash('sha256').update(content).digest('hex');
}

/**
 * Hash corpus file buffers (same bytes used for JSON.parse in loadCorpusData).
 * @param {Buffer[]} buffers
 */
export function fingerprintCorpusBuffers(buffers) {
	const hash = createHash('sha256');
	for (const buffer of buffers) hash.update(buffer);
	return hash.digest('hex');
}

export async function buildAnalyzerFingerprint() {
	const hash = createHash('sha256');
	hash.update(String(STATS_ALGORITHM_VERSION));
	for (const file of ANALYZER_FINGERPRINT_FILES) {
		hash.update(await readFile(file));
	}
	return hash.digest('hex');
}

/** @param {string} corpusFingerprint @param {string} analyzerFingerprint */
export async function createStatsCacheContext(corpusFingerprint, analyzerFingerprint) {
	const file = await loadStatsCacheFile();
	const layouts =
		file?.version === STATS_ALGORITHM_VERSION &&
		file.corpusFingerprint === corpusFingerprint &&
		file.analyzerFingerprint === analyzerFingerprint
			? { ...file.layouts }
			: {};

	return /** @type {StatsCacheContext} */ ({
		corpusFingerprint,
		analyzerFingerprint,
		layouts,
		hits: 0,
		misses: 0
	});
}

/**
 * @param {StatsCacheContext} ctx
 * @param {string} layoutFilename
 * @param {string} layoutHash
 * @param {string} trigramSourceHash
 */
export function getCachedLayoutStats(ctx, layoutFilename, layoutHash, trigramSourceHash) {
	const entry = ctx.layouts[layoutFilename];
	if (
		entry &&
		entry.layoutHash === layoutHash &&
		entry.trigramSourceHash === trigramSourceHash
	) {
		ctx.hits++;
		return entry.stats;
	}

	return null;
}

/**
 * @param {StatsCacheContext} ctx
 * @param {string} layoutFilename
 * @param {string} layoutHash
 * @param {string} trigramSourceHash
 * @param {number[]} stats
 */
export function setCachedLayoutStats(
	ctx,
	layoutFilename,
	layoutHash,
	trigramSourceHash,
	stats
) {
	ctx.misses++;
	ctx.layouts[layoutFilename] = { layoutHash, trigramSourceHash, stats };
}

/**
 * @param {StatsCacheContext} ctx
 * @param {Set<string>} layoutFilenames
 */
export function pruneStatsCache(ctx, layoutFilenames) {
	for (const filename of Object.keys(ctx.layouts)) {
		if (!layoutFilenames.has(filename)) {
			delete ctx.layouts[filename];
		}
	}
}

/** @param {StatsCacheContext} ctx */
export async function saveStatsCache(ctx) {
	await mkdir(dirname(STATS_CACHE_FILE), { recursive: true });
	/** @type {StatsCacheFile} */
	const file = {
		version: STATS_ALGORITHM_VERSION,
		corpusFingerprint: ctx.corpusFingerprint,
		analyzerFingerprint: ctx.analyzerFingerprint,
		layouts: ctx.layouts
	};
	await writeFile(STATS_CACHE_FILE, JSON.stringify(file) + '\n', 'utf-8');
}

/** @returns {Promise<StatsCacheFile | null>} */
async function loadStatsCacheFile() {
	try {
		const parsed = JSON.parse(await readFile(STATS_CACHE_FILE, 'utf-8'));
		if (!parsed || typeof parsed !== 'object' || !parsed.layouts) return null;
		return parsed;
	} catch {
		return null;
	}
}
