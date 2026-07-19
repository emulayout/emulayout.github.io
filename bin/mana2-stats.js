/**
 * Mana2 stats encoding + CLI invocation helpers.
 * Values come from Mana2's `json <layout>` command (percentages / ratings as emitted).
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANA2_CONVERTER_VERSION } from './mana2-layout.js';

const BIN_DIR = dirname(fileURLToPath(import.meta.url));
const STATS_CACHE_FILE = join(process.cwd(), '.cache', 'layout-stats-mana2.json');

/** Analyzer id for the generated artifact (frontend wiring is a later milestone). */
export const MANA2_ANALYZER = 'mana2';

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const MANA2_STAT_VALUE_SCALE = 10_000;

/**
 * Stable key order matching Mana2 builtin registration
 * (monogram → bigram → skipgram → trigram, including `nothumbs` twins).
 */
export const MANA2_STAT_KEYS = [
	'finger-usage-LP',
	'finger-usage-LR',
	'finger-usage-LM',
	'finger-usage-LI',
	'finger-usage-LT',
	'finger-usage-RT',
	'finger-usage-RI',
	'finger-usage-RM',
	'finger-usage-RR',
	'finger-usage-RP',
	'offpinky',
	'sfb',
	'sfbw',
	'skb',
	'lsb',
	'vsb',
	'sfs',
	'sfsw',
	'sks',
	'lss',
	'vss',
	'alt',
	'altnothumbs',
	'altsfs',
	'altsfsnothumbs',
	'redirect',
	'redirectnothumbs',
	'redirectsfs',
	'redirectsfsnothumbs',
	'redirectweak',
	'redirectweaknothumbs',
	'redirectsfsweak',
	'redirectsfsweaknothumbs',
	'roll',
	'rollnothumbs',
	'inroll2',
	'inroll2nothumbs',
	'outroll2',
	'outroll2nothumbs',
	'inroll3',
	'inroll3nothumbs',
	'outroll3',
	'outroll3nothumbs',
	'goodroll',
	'goodrollnothumbs'
];

/** Bump when encode key order / parsing changes. */
export const MANA2_STATS_ALGORITHM_VERSION = 1;

/**
 * @typedef {{ Id?: string, id?: string, Value?: number, value?: number }} Mana2StatEntry
 * @typedef {{
 *   monogramStats?: Mana2StatEntry[],
 *   bigramStats?: Mana2StatEntry[],
 *   skipgramStats?: Mana2StatEntry[],
 *   trigramStats?: Mana2StatEntry[]
 * }} Mana2StatsJson
 */

/**
 * Flatten Mana2 JSON stats into a compact fixed-point array.
 * @param {Mana2StatsJson} stats
 * @returns {number[] | null}
 */
export function encodeMana2Stats(stats) {
	/** @type {Map<string, number>} */
	const byId = new Map();
	for (const group of [
		stats.monogramStats,
		stats.bigramStats,
		stats.skipgramStats,
		stats.trigramStats
	]) {
		if (!Array.isArray(group)) continue;
		for (const entry of group) {
			const id = entry?.Id ?? entry?.id;
			const value = entry?.Value ?? entry?.value;
			if (typeof id !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) continue;
			byId.set(id, value);
		}
	}

	if (byId.size === 0) return null;

	/** @type {number[]} */
	const compact = [];
	for (const key of MANA2_STAT_KEYS) {
		const value = byId.get(key);
		if (typeof value !== 'number') return null;
		compact.push(Math.round(value * MANA2_STAT_VALUE_SCALE));
	}
	return compact;
}

/**
 * Extract one or more JSON values from Mana2 CLI stdout (may include log lines).
 * @param {string} text
 * @returns {unknown[]}
 */
export function extractJsonValues(text) {
	/** @type {unknown[]} */
	const values = [];
	let i = 0;
	while (i < text.length) {
		const start = text.indexOf('{', i);
		if (start === -1) break;

		let depth = 0;
		let inString = false;
		let escaped = false;
		let end = -1;
		for (let j = start; j < text.length; j++) {
			const ch = text[j];
			if (inString) {
				if (escaped) escaped = false;
				else if (ch === '\\') escaped = true;
				else if (ch === '"') inString = false;
				continue;
			}
			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth === 0) {
					end = j;
					break;
				}
			}
		}
		if (end === -1) break;

		const slice = text.slice(start, end + 1);
		try {
			values.push(JSON.parse(slice));
		} catch {
			// skip malformed fragments
		}
		i = end + 1;
	}
	return values;
}

/**
 * @param {string} content
 */
export function hashContent(content) {
	return createHash('sha256').update(content).digest('hex');
}

/**
 * Fingerprint converter + stats encoder sources.
 * @param {string} mana2Commit
 */
export async function buildMana2AnalyzerFingerprint(mana2Commit) {
	const hash = createHash('sha256');
	hash.update(String(MANA2_STATS_ALGORITHM_VERSION));
	hash.update(String(MANA2_CONVERTER_VERSION));
	hash.update(mana2Commit);
	hash.update(await readFile(join(BIN_DIR, 'mana2-layout.js')));
	hash.update(await readFile(join(BIN_DIR, 'mana2-stats.js')));
	hash.update(MANA2_STAT_KEYS.join('\0'));
	return hash.digest('hex');
}

/**
 * @typedef {Object} Mana2StatsCacheEntry
 * @property {string} layoutHash
 * @property {number[]} stats
 */

/**
 * @typedef {Object} Mana2StatsCacheContext
 * @property {string} analyzerFingerprint
 * @property {Record<string, Mana2StatsCacheEntry>} layouts
 * @property {number} hits
 * @property {number} misses
 */

/** @param {string} analyzerFingerprint */
export async function createMana2StatsCacheContext(analyzerFingerprint) {
	const file = await loadMana2StatsCacheFile();
	const layouts =
		file?.version === MANA2_STATS_ALGORITHM_VERSION &&
		file.analyzerFingerprint === analyzerFingerprint
			? { ...file.layouts }
			: {};

	return /** @type {Mana2StatsCacheContext} */ ({
		analyzerFingerprint,
		layouts,
		hits: 0,
		misses: 0
	});
}

/**
 * @param {Mana2StatsCacheContext} ctx
 * @param {string} layoutFilename
 * @param {string} layoutHash
 */
export function getCachedMana2Stats(ctx, layoutFilename, layoutHash) {
	const entry = ctx.layouts[layoutFilename];
	if (entry && entry.layoutHash === layoutHash) {
		ctx.hits++;
		return entry.stats;
	}
	return null;
}

/**
 * @param {Mana2StatsCacheContext} ctx
 * @param {string} layoutFilename
 * @param {string} layoutHash
 * @param {number[]} stats
 */
export function setCachedMana2Stats(ctx, layoutFilename, layoutHash, stats) {
	ctx.misses++;
	ctx.layouts[layoutFilename] = { layoutHash, stats };
}

/**
 * @param {Mana2StatsCacheContext} ctx
 * @param {Set<string>} layoutFilenames
 */
export function pruneMana2StatsCache(ctx, layoutFilenames) {
	for (const filename of Object.keys(ctx.layouts)) {
		if (!layoutFilenames.has(filename)) delete ctx.layouts[filename];
	}
}

/** @param {Mana2StatsCacheContext} ctx */
export async function saveMana2StatsCache(ctx) {
	await mkdir(dirname(STATS_CACHE_FILE), { recursive: true });
	await writeFile(
		STATS_CACHE_FILE,
		JSON.stringify({
			version: MANA2_STATS_ALGORITHM_VERSION,
			analyzerFingerprint: ctx.analyzerFingerprint,
			layouts: ctx.layouts
		}) + '\n',
		'utf-8'
	);
}

async function loadMana2StatsCacheFile() {
	try {
		const parsed = JSON.parse(await readFile(STATS_CACHE_FILE, 'utf-8'));
		if (!parsed || typeof parsed !== 'object' || !parsed.layouts) return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * @param {string} path
 */
export async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}
