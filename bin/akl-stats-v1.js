/**
 * Download and cache the supported akl.gg stats/v1 per-layout objects.
 *
 * AKLDB remains the catalog authority. Its ids and revisions select the matching
 * stats objects, which keeps generated catalog and analyzer artifacts aligned.
 */

import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeFileAtomically } from './sync-shared.js';

export const AKL_STATS_CURRENT_URL = 'https://data.akl.gg/stats/v1/current.json';
export const AKL_STATS_CURRENT_SCHEMA = 'akl.gg/stats/v1/current';
export const AKL_STATS_LAYOUT_SCHEMA = 'akl.gg/stats/v1/layout';
export const AKL_STATS_CACHE_DIR = join(process.cwd(), '.cache', 'akl-stats-v1');
export const AKL_STATS_REQUEST_TIMEOUT_MS = 90_000;

const CURRENT_FILE = 'current.json';
const CURRENT_META_FILE = 'current.meta.json';
const USER_AGENT =
	'emulayout-akl-stats-sync/1.0 (+https://github.com/emulayout/emulayout.github.io)';

/**
 * @typedef {Record<string, unknown> & {
 *   schema: string,
 *   stats_version: string,
 *   db_seq: number,
 *   synced_at: string,
 *   layouts_url: string,
 *   defs: string,
 *   snapshot: Record<string, unknown> & { id: string },
 *   deprecated?: boolean,
 *   sunset?: string,
 *   successor?: string
 * }} AklStatsCurrent
 * @typedef {Record<string, unknown> & {
 *   schema: string,
 *   id: string,
 *   deleted: boolean,
 *   stats_version: string,
 *   db_seq: number,
 *   layout_rev: number | null,
 *   layout?: Record<string, unknown> & { name: string },
 *   cmini?: Record<string, unknown>,
 *   mana2?: Record<string, unknown>
 * }} AklStatsLayout
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {string} cacheDir @param {string} filename */
function cachePath(cacheDir, filename) {
	return join(cacheDir, filename.replace(/^\/+/, ''));
}

/** @param {string} path */
async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

/** @param {unknown} value @returns {AklStatsCurrent} */
export function parseAklStatsCurrent(value) {
	if (!isRecord(value) || value.schema !== AKL_STATS_CURRENT_SCHEMA) {
		const schema = isRecord(value) ? value.schema : undefined;
		throw new Error(`Unexpected akl.gg current schema: ${String(schema)}`);
	}
	for (const field of ['stats_version', 'layouts_url', 'defs', 'synced_at']) {
		if (typeof value[field] !== 'string' || !value[field]) {
			throw new Error(`akl.gg current.${field} must be a nonempty string`);
		}
	}
	if (typeof value.db_seq !== 'number' || !Number.isInteger(value.db_seq) || value.db_seq < 0) {
		throw new Error('akl.gg current.db_seq must be a non-negative integer');
	}
	if (!isRecord(value.snapshot) || typeof value.snapshot.id !== 'string') {
		throw new Error('akl.gg current.snapshot must contain an id');
	}
	if (value.deprecated === true) {
		if (typeof value.sunset !== 'string' || typeof value.successor !== 'string') {
			throw new Error('Deprecated akl.gg stats API must name its sunset and successor');
		}
	}
	return /** @type {AklStatsCurrent} */ (value);
}

/** @param {unknown} value @returns {AklStatsLayout} */
export function parseAklStatsLayout(value) {
	if (!isRecord(value) || value.schema !== AKL_STATS_LAYOUT_SCHEMA) {
		const schema = isRecord(value) ? value.schema : undefined;
		throw new Error(`Unexpected akl.gg layout schema: ${String(schema)}`);
	}
	if (typeof value.id !== 'string' || !value.id) throw new Error('akl.gg layout.id is required');
	if (typeof value.stats_version !== 'string' || !value.stats_version) {
		throw new Error('akl.gg layout.stats_version is required');
	}
	if (typeof value.db_seq !== 'number' || !Number.isInteger(value.db_seq) || value.db_seq < 0) {
		throw new Error('akl.gg layout.db_seq must be a non-negative integer');
	}
	if (value.deleted !== true && value.deleted !== false) {
		throw new Error('akl.gg layout.deleted must be boolean');
	}
	if (
		value.layout_rev !== null &&
		(typeof value.layout_rev !== 'number' ||
			!Number.isInteger(value.layout_rev) ||
			value.layout_rev < 1)
	) {
		throw new Error('akl.gg layout.layout_rev must be a positive integer or null');
	}
	if (value.deleted === true) return /** @type {AklStatsLayout} */ (value);
	if (value.layout_rev === null) throw new Error('Live akl.gg layout.layout_rev cannot be null');
	if (!isRecord(value.layout) || typeof value.layout.name !== 'string') {
		throw new Error('akl.gg layout.layout must contain a name');
	}
	if (!isRecord(value.cmini) || !isRecord(value.mana2)) {
		throw new Error('akl.gg layout must contain cmini and mana2 cells');
	}
	return /** @type {AklStatsLayout} */ (value);
}

/**
 * Read one analyzer cell while keeping additive/unknown API fields opaque.
 * @param {Record<string, unknown> | undefined} object
 * @param {'cmini' | 'mana2'} analyzer
 * @param {string} cell
 */
export function getAklStatsCell(object, analyzer, cell) {
	if (!object) return undefined;
	const cells = object[analyzer];
	if (!isRecord(cells)) return undefined;
	return cells[cell];
}

/** @template T @param {string} path @param {(value: unknown) => T} parse @returns {Promise<T | null>} */
async function readCachedJson(path, parse) {
	try {
		return parse(JSON.parse(await readFile(path, 'utf8')));
	} catch {
		return null;
	}
}

/**
 * @param {string} url
 * @param {{ fetchImpl: typeof fetch, timeoutMs: number, headers?: Record<string, string> }} options
 */
async function fetchResponse(url, { fetchImpl, timeoutMs, headers = {} }) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetchImpl(url, {
			headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
			signal: controller.signal
		});
	} catch (error) {
		if (controller.signal.aborted) throw new Error(`Request timed out: ${url}`, { cause: error });
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

/** @param {Response} response @param {string} label */
async function responseJson(response, label) {
	if (!response.ok) throw new Error(`${label}: HTTP ${response.status} ${response.statusText}`);
	try {
		return JSON.parse(await response.text());
	} catch (error) {
		throw new Error(`${label}: invalid JSON`, { cause: error });
	}
}

/**
 * @param {{ offline: boolean, force: boolean, fetchImpl: typeof fetch, timeoutMs: number, cacheDir: string }} options
 */
async function ensureCurrent(options) {
	const currentPath = cachePath(options.cacheDir, CURRENT_FILE);
	const metaPath = cachePath(options.cacheDir, CURRENT_META_FILE);
	const cached = await readCachedJson(currentPath, parseAklStatsCurrent);
	if (options.offline) {
		if (!cached) throw new Error(`akl.gg stats cache missing at ${currentPath}`);
		return { current: cached, updated: false, fromCache: true };
	}

	/** @type {Record<string, string>} */
	const conditionalHeaders = {};
	if (cached && !options.force) {
		const meta = await readCachedJson(metaPath, (value) =>
			isRecord(value) ? /** @type {Record<string, unknown>} */ (value) : null
		);
		if (meta && typeof meta.etag === 'string') conditionalHeaders['If-None-Match'] = meta.etag;
	}

	try {
		const response = await fetchResponse(AKL_STATS_CURRENT_URL, {
			...options,
			headers: conditionalHeaders
		});
		if (response.status === 304) {
			if (!cached) throw new Error('akl.gg current returned 304 without a cached object');
			return { current: cached, updated: false, fromCache: false };
		}
		const current = parseAklStatsCurrent(await responseJson(response, 'akl.gg current'));
		await mkdir(options.cacheDir, { recursive: true });
		await writeFileAtomically(currentPath, `${JSON.stringify(current)}\n`);
		const etag = response.headers.get('etag');
		await writeFileAtomically(
			metaPath,
			`${JSON.stringify({ ...(etag ? { etag } : {}), fetchedAt: new Date().toISOString() })}\n`
		);
		return {
			current,
			updated:
				!cached ||
				cached.stats_version !== current.stats_version ||
				cached.db_seq !== current.db_seq,
			fromCache: false
		};
	} catch (error) {
		if (!cached) throw error;
		console.warn(
			`  ⚠ Could not refresh akl.gg current state; keeping cached ${cached.stats_version}`
		);
		return { current: cached, updated: false, fromCache: true };
	}
}

/**
 * @template T
 * @param {T[]} values
 * @param {number} concurrency
 * @param {(value: T) => Promise<void>} work
 */
async function forEachConcurrent(values, concurrency, work) {
	let next = 0;
	const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
		while (next < values.length) {
			const index = next++;
			await work(values[index]);
		}
	});
	await Promise.all(workers);
}

/**
 * Ensure stats objects exist for the requested AKLDB layouts.
 *
 * @param {Array<{ id: string, name: string, layoutRev: number }>} layouts
 * @param {{
 *   offline?: boolean,
 *   force?: boolean,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   cacheDir?: string,
 *   concurrency?: number
 * }} [options]
 */
export async function ensureAklStatsLayouts(layouts, options = {}) {
	const resolved = {
		offline: options.offline ?? false,
		force: options.force ?? false,
		fetchImpl: options.fetchImpl ?? fetch,
		timeoutMs: options.timeoutMs ?? AKL_STATS_REQUEST_TIMEOUT_MS,
		cacheDir: options.cacheDir ?? AKL_STATS_CACHE_DIR,
		concurrency: Math.max(1, options.concurrency ?? 16)
	};
	const currentResult = await ensureCurrent(resolved);
	const current = currentResult.current;
	if (current.deprecated === true) {
		console.warn(
			`  ⚠ akl.gg stats/v1 is deprecated; sunset ${current.sunset}, successor ${current.successor}`
		);
	}

	/** @type {Map<string, AklStatsLayout>} */
	const objects = new Map();
	let downloaded = 0;
	let failed = 0;
	await forEachConcurrent(layouts, resolved.concurrency, async (candidate) => {
		const encodedId = encodeURIComponent(candidate.id);
		const objectPath = cachePath(resolved.cacheDir, `layouts/${encodedId}.json`);
		const cached = await readCachedJson(objectPath, parseAklStatsLayout);
		const cachedMatches =
			cached &&
			cached.deleted === false &&
			cached.id === candidate.id &&
			cached.stats_version === current.stats_version &&
			cached.layout_rev === candidate.layoutRev;
		if (cachedMatches && !resolved.force) {
			objects.set(candidate.id, cached);
			return;
		}
		if (resolved.offline) {
			if (cachedMatches) objects.set(candidate.id, cached);
			else failed++;
			return;
		}

		try {
			const url = `${current.layouts_url}${encodedId}.json`;
			const response = await fetchResponse(url, resolved);
			if (response.status === 404) {
				failed++;
				return;
			}
			const object = parseAklStatsLayout(await responseJson(response, candidate.name));
			if (object.id !== candidate.id || object.stats_version !== current.stats_version) {
				throw new Error(`${candidate.name}: stats object identity/version mismatch`);
			}
			await mkdir(dirname(objectPath), { recursive: true });
			await writeFileAtomically(objectPath, `${JSON.stringify(object)}\n`);
			downloaded++;
			if (object.deleted === false && object.layout_rev === candidate.layoutRev) {
				objects.set(candidate.id, object);
			} else {
				failed++;
			}
		} catch {
			if (cachedMatches) objects.set(candidate.id, cached);
			else failed++;
		}
	});

	if (failed > 0) {
		console.warn(`  ⚠ ${failed} akl.gg layout stats object${failed === 1 ? '' : 's'} unavailable`);
	}
	return {
		current,
		objects,
		downloaded,
		missing: failed,
		updated: downloaded > 0,
		fromCache: currentResult.fromCache
	};
}

export async function aklStatsCacheExists(cacheDir = AKL_STATS_CACHE_DIR) {
	return (
		(await pathExists(cachePath(cacheDir, CURRENT_FILE))) &&
		(await pathExists(cachePath(cacheDir, 'layouts')))
	);
}
