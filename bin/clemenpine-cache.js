/**
 * Download and cache one coordinated Clemenpine catalog snapshot.
 *
 * Layouts: GET /layoutapi/v3/layouts?full=1
 * Authors: GET /layoutapi/v3/authors
 * Metadata: GET /layoutapi/v3/meta
 *
 * Metadata is checked first so unchanged resources do not need to be downloaded.
 * Changed resources are fetched and validated before a single atomic snapshot
 * is replaced. Network, HTTP, timeout, parse, and schema failures reuse the
 * complete last-good snapshot when present.
 */

import { createHash } from 'node:crypto';
import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeFileAtomically } from './sync-shared.js';

export const CLEMENPINE_ORIGIN = 'https://clemenpine.com';
export const CLEMENPINE_LAYOUTS_URL = `${CLEMENPINE_ORIGIN}/layoutapi/v3/layouts?full=1`;
export const CLEMENPINE_AUTHORS_URL = `${CLEMENPINE_ORIGIN}/layoutapi/v3/authors`;
export const CLEMENPINE_META_URL = `${CLEMENPINE_ORIGIN}/layoutapi/v3/meta`;
export const CLEMENPINE_CACHE_DIR = join(process.cwd(), '.cache', 'clemenpine');
export const CLEMENPINE_SNAPSHOT_CACHE_FILE = 'catalog-v1.json';
export const CLEMENPINE_LAYOUTS_CACHE_FILE = 'layouts-full.json';
export const CLEMENPINE_AUTHORS_CACHE_FILE = 'authors.json';
export const CLEMENPINE_SYNCED_HASH_FILE = join(process.cwd(), '.cache', 'clemenpine-synced-hash');

export const CLEMENPINE_REQUEST_TIMEOUT_MS = 30_000;

const USER_AGENT =
	'emulayout-clemenpine-sync/0.3 (+https://github.com/emulayout/emulayout.github.io)';
const SNAPSHOT_VERSION = 1;
const BOARD_TYPES = new Set(['angle', 'stagger', 'ortho', 'mini']);

/**
 * @typedef {{ row: number, col: number, finger?: string }} ClemenpineKeyInfo
 * @typedef {{
 *   name: string,
 *   user: string,
 *   board: 'angle' | 'stagger' | 'ortho' | 'mini',
 *   modifiedAt: string,
 *   keys: Record<string, ClemenpineKeyInfo>,
 *   likes?: string[]
 * }} ClemenpineLayout
 * @typedef {{ layouts: ClemenpineLayout[], skipped: 0 }} ParsedClemenpineLayouts
 * @typedef {{ layouts: ParsedClemenpineLayouts, authors: Record<string, string> }} ParsedClemenpineCatalog
 * @typedef {{
 *   author_count: number,
 *   authors_modified_at: string,
 *   layout_count: number,
 *   layouts_modified_at: string,
 *   revision: string
 * }} ClemenpineMeta
 * @typedef {{
 *   version: typeof SNAPSHOT_VERSION,
 *   fetchedAt: string,
 *   layoutsUrl: string,
 *   authorsUrl: string,
 *   metaUrl?: string,
 *   meta?: unknown,
 *   layouts: unknown,
 *   authors: unknown
 * }} ClemenpineSnapshot
 */

export class ClemenpineCatalogUnavailableError extends Error {
	/** @param {string} message @param {{ cause?: unknown }} [options] */
	constructor(message, options) {
		super(message, options);
		this.name = 'ClemenpineCatalogUnavailableError';
	}
}

/** @param {string} filename */
export function clemenpineCachePath(filename) {
	return join(CLEMENPINE_CACHE_DIR, filename.replace(/^\/+/, ''));
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {string} path */
async function pathExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/** @param {unknown} error */
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * v3 emits Discord-style ids as decimal strings so they retain full precision.
 * Numeric values remain accepted only for last-good v1 cache compatibility.
 * @param {unknown} value
 * @param {string} label
 */
function parseId(value, label) {
	if (typeof value === 'string' && /^\d+$/.test(value)) return value;
	if (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Number.isInteger(value) &&
		value >= 0
	) {
		return String(value);
	}
	throw new Error(`${label} must be a non-negative integer id encoded as a string`);
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {ClemenpineKeyInfo}
 */
function parseKeyInfo(value, label) {
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	if (!Number.isFinite(value.row) || !Number.isFinite(value.col)) {
		throw new Error(`${label} must have finite numeric row and col values`);
	}
	if (value.finger !== undefined && typeof value.finger !== 'string') {
		throw new Error(`${label}.finger must be a string when present`);
	}
	return {
		row: /** @type {number} */ (value.row),
		col: /** @type {number} */ (value.col),
		...(typeof value.finger === 'string' ? { finger: value.finger } : {})
	};
}

/**
 * @param {unknown} value
 * @param {number} index
 * @returns {ClemenpineLayout}
 */
function parseLayoutRecord(value, index) {
	const label = `Clemenpine layout record ${index}`;
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	if (typeof value.name !== 'string' || value.name.length === 0) {
		throw new Error(`${label}.name must be a non-empty string`);
	}
	const user = parseId(value.user, `${label} (${value.name}).user`);
	if (typeof value.board !== 'string' || !BOARD_TYPES.has(value.board)) {
		throw new Error(`${label} (${value.name}).board is not a recognized board type`);
	}
	if (
		typeof value.modified_at !== 'string' ||
		value.modified_at.length === 0 ||
		Number.isNaN(Date.parse(value.modified_at))
	) {
		throw new Error(`${label} (${value.name}).modified_at must be a valid timestamp`);
	}
	if (!isRecord(value.keys)) {
		throw new Error(`${label} (${value.name}).keys must be an object`);
	}

	/** @type {Record<string, ClemenpineKeyInfo>} */
	const keys = {};
	for (const [key, info] of Object.entries(value.keys)) {
		if (key.length === 0) throw new Error(`${label} (${value.name}) has an empty key name`);
		keys[key] = parseKeyInfo(info, `${label} (${value.name}).keys[${JSON.stringify(key)}]`);
	}

	let likes;
	if (value.likes !== undefined) {
		if (!Array.isArray(value.likes)) {
			throw new Error(`${label} (${value.name}).likes must be an array when present`);
		}
		likes = value.likes.map((id, likeIndex) =>
			parseId(id, `${label} (${value.name}).likes[${likeIndex}]`)
		);
	}

	return {
		name: value.name,
		user,
		board: /** @type {ClemenpineLayout['board']} */ (value.board),
		modifiedAt: value.modified_at,
		keys,
		...(likes ? { likes } : {})
	};
}

/**
 * Strictly parse the versioned layouts contract. Unknown fields remain allowed
 * so additive API changes do not require an importer update.
 *
 * @param {unknown} json
 * @returns {ParsedClemenpineLayouts}
 */
export function parseClemenpineLayouts(json) {
	if (!isRecord(json) || !Array.isArray(json.layouts)) {
		throw new Error('Clemenpine layouts payload must be an object with a layouts array');
	}
	if (
		json.total !== undefined &&
		(!Number.isInteger(json.total) || json.total !== json.layouts.length)
	) {
		throw new Error('Clemenpine layouts payload total must match the layouts array length');
	}

	const layouts = json.layouts.map(parseLayoutRecord);
	const seen = new Set();
	for (const layout of layouts) {
		const key = layout.name.toLowerCase();
		if (seen.has(key)) {
			throw new Error(`Clemenpine layouts payload contains duplicate layout name ${layout.name}`);
		}
		seen.add(key);
	}
	return { layouts, skipped: 0 };
}

/** @param {unknown} json @returns {Record<string, string>} */
export function parseClemenpineAuthors(json) {
	if (!isRecord(json)) {
		throw new Error('Clemenpine authors payload must be an object of name → user id');
	}

	/** @type {[string, string][]} */
	const entries = [];
	for (const [name, id] of Object.entries(json)) {
		if (!name) throw new Error('Clemenpine author names must be non-empty strings');
		entries.push([name, parseId(id, `Clemenpine author ${JSON.stringify(name)}`)]);
	}
	return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Strictly parse the fields used to decide whether a resource changed. Unknown
 * fields remain allowed so additive v1 changes are harmless.
 *
 * @param {unknown} json
 * @returns {ClemenpineMeta}
 */
export function parseClemenpineMeta(json) {
	if (!isRecord(json)) throw new Error('Clemenpine meta payload must be an object');
	for (const field of ['author_count', 'layout_count']) {
		if (!Number.isInteger(json[field]) || /** @type {number} */ (json[field]) < 0) {
			throw new Error(`Clemenpine meta ${field} must be a non-negative integer`);
		}
	}
	for (const field of ['authors_modified_at', 'layouts_modified_at', 'revision']) {
		if (
			typeof json[field] !== 'string' ||
			json[field].length === 0 ||
			Number.isNaN(Date.parse(json[field]))
		) {
			throw new Error(`Clemenpine meta ${field} must be a valid timestamp`);
		}
	}
	return /** @type {ClemenpineMeta} */ ({
		author_count: json.author_count,
		authors_modified_at: json.authors_modified_at,
		layout_count: json.layout_count,
		layouts_modified_at: json.layouts_modified_at,
		revision: json.revision
	});
}

/**
 * @param {unknown} layoutsJson
 * @param {unknown} authorsJson
 * @returns {ParsedClemenpineCatalog}
 */
export function parseClemenpineCatalog(layoutsJson, authorsJson) {
	const layouts = parseClemenpineLayouts(layoutsJson);
	const authors = parseClemenpineAuthors(authorsJson);
	return { layouts, authors };
}

/**
 * Like counts keyed by layout name. Layouts without a likes array are omitted (count 0).
 * @param {readonly ClemenpineLayout[]} layouts
 * @returns {Record<string, number>}
 */
export function deriveLayoutLikes(layouts) {
	/** @type {Record<string, number>} */
	const likes = {};
	for (const layout of layouts) {
		if (!layout.likes || layout.likes.length === 0) continue;
		likes[layout.name] = layout.likes.length;
	}
	return Object.fromEntries(
		Object.keys(likes)
			.sort((a, b) => a.localeCompare(b))
			.map((name) => [name, likes[name]])
	);
}

/** @param {unknown} value @returns {value is ClemenpineSnapshot} */
function isSnapshot(value) {
	return (
		isRecord(value) &&
		value.version === SNAPSHOT_VERSION &&
		typeof value.fetchedAt === 'string' &&
		typeof value.layoutsUrl === 'string' &&
		typeof value.authorsUrl === 'string' &&
		'layouts' in value &&
		'authors' in value
	);
}

/** @param {ClemenpineSnapshot} snapshot */
function readSnapshotMeta(snapshot) {
	if (snapshot.meta === undefined) return null;
	try {
		return parseClemenpineMeta(snapshot.meta);
	} catch {
		return null;
	}
}

/** @param {ClemenpineSnapshot} snapshot */
function snapshotUsesCurrentEndpoints(snapshot) {
	return (
		snapshot.layoutsUrl === CLEMENPINE_LAYOUTS_URL &&
		snapshot.authorsUrl === CLEMENPINE_AUTHORS_URL &&
		snapshot.metaUrl === CLEMENPINE_META_URL
	);
}

/** @param {ClemenpineMeta} left @param {ClemenpineMeta} right */
function metaIsEqual(left, right) {
	return (
		left.author_count === right.author_count &&
		left.authors_modified_at === right.authors_modified_at &&
		left.layout_count === right.layout_count &&
		left.layouts_modified_at === right.layouts_modified_at &&
		left.revision === right.revision
	);
}

/** @param {ClemenpineMeta} meta @param {ParsedClemenpineCatalog} catalog */
function assertMetaMatchesCatalog(meta, catalog) {
	if (catalog.layouts.layouts.length !== meta.layout_count) {
		throw new Error(
			`Clemenpine meta reports ${meta.layout_count} layouts but the catalog contains ${catalog.layouts.layouts.length}`
		);
	}
	const authorCount = Object.keys(catalog.authors).length;
	if (authorCount !== meta.author_count) {
		throw new Error(
			`Clemenpine meta reports ${meta.author_count} authors but the catalog contains ${authorCount}`
		);
	}
}

/**
 * @param {string} snapshotPath
 * @param {string} legacyLayoutsPath
 * @param {string} legacyAuthorsPath
 * @returns {Promise<{ snapshot: ClemenpineSnapshot, parsed: ParsedClemenpineCatalog } | null>}
 */
async function readCachedCatalog(snapshotPath, legacyLayoutsPath, legacyAuthorsPath) {
	try {
		const value = JSON.parse(await readFile(snapshotPath, 'utf-8'));
		if (!isSnapshot(value)) throw new Error('Unrecognized Clemenpine snapshot format');
		return {
			snapshot: value,
			parsed: parseClemenpineCatalog(value.layouts, value.authors)
		};
	} catch {
		// Fall through to the two-file cache used before coordinated snapshots.
	}

	try {
		const [layouts, authors] = await Promise.all([
			readFile(legacyLayoutsPath, 'utf-8').then(JSON.parse),
			readFile(legacyAuthorsPath, 'utf-8').then(JSON.parse)
		]);
		return {
			snapshot: {
				version: SNAPSHOT_VERSION,
				fetchedAt: new Date(0).toISOString(),
				layoutsUrl: CLEMENPINE_LAYOUTS_URL,
				authorsUrl: CLEMENPINE_AUTHORS_URL,
				layouts,
				authors
			},
			parsed: parseClemenpineCatalog(layouts, authors)
		};
	} catch {
		return null;
	}
}

/**
 * @param {string} url
 * @param {{ fetchImpl: typeof fetch, timeoutMs: number }} options
 */
async function fetchJson(url, { fetchImpl, timeoutMs }) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, {
			headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
		const body = await response.text();
		try {
			return JSON.parse(body);
		} catch (error) {
			throw new Error(`Invalid JSON from ${url}: ${errorMessage(error)}`, { cause: error });
		}
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`, { cause: error });
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Fetch and atomically cache a coordinated layouts + authors snapshot.
 *
 * @param {{
 *   offline?: boolean,
 *   force?: boolean,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   snapshotPath?: string,
 *   legacyLayoutsPath?: string,
 *   legacyAuthorsPath?: string
 * }} [options]
 * @returns {Promise<{ json: ParsedClemenpineCatalog, updated: boolean, fromCache: boolean }>}
 */
export async function ensureClemenpineCatalog(options = {}) {
	const snapshotPath = options.snapshotPath ?? clemenpineCachePath(CLEMENPINE_SNAPSHOT_CACHE_FILE);
	const legacyLayoutsPath =
		options.legacyLayoutsPath ?? clemenpineCachePath(CLEMENPINE_LAYOUTS_CACHE_FILE);
	const legacyAuthorsPath =
		options.legacyAuthorsPath ?? clemenpineCachePath(CLEMENPINE_AUTHORS_CACHE_FILE);
	const previous = await readCachedCatalog(snapshotPath, legacyLayoutsPath, legacyAuthorsPath);

	if (options.offline) {
		if (!previous) {
			throw new ClemenpineCatalogUnavailableError(
				`Clemenpine cache missing at ${snapshotPath}. Run without --offline to download.`
			);
		}
		return { json: previous.parsed, updated: false, fromCache: true };
	}

	try {
		const fetchImpl = options.fetchImpl ?? fetch;
		const timeoutMs = options.timeoutMs ?? CLEMENPINE_REQUEST_TIMEOUT_MS;
		const fetchOptions = { fetchImpl, timeoutMs };
		const previousMeta = previous ? readSnapshotMeta(previous.snapshot) : null;
		/** @type {unknown | undefined} */
		let metaJson;
		/** @type {ClemenpineMeta | null} */
		let meta = null;
		try {
			console.log(`→ Checking ${CLEMENPINE_META_URL}`);
			metaJson = await fetchJson(CLEMENPINE_META_URL, fetchOptions);
			meta = parseClemenpineMeta(metaJson);
		} catch (error) {
			console.warn(
				`  ⚠ Clemenpine metadata unavailable (${errorMessage(error)}); checking full catalog`
			);
		}

		const endpointsChanged = previous ? !snapshotUsesCurrentEndpoints(previous.snapshot) : false;
		if (
			!options.force &&
			previous &&
			!endpointsChanged &&
			previousMeta &&
			meta &&
			metaIsEqual(previousMeta, meta)
		) {
			console.log(`  ✔ Clemenpine revision unchanged: ${meta.revision}`);
			return { json: previous.parsed, updated: false, fromCache: false };
		}

		let layoutsChanged = true;
		let authorsChanged = true;
		if (!options.force && previous && !endpointsChanged && previousMeta && meta) {
			layoutsChanged =
				previousMeta.layouts_modified_at !== meta.layouts_modified_at ||
				previousMeta.layout_count !== meta.layout_count;
			authorsChanged =
				previousMeta.authors_modified_at !== meta.authors_modified_at ||
				previousMeta.author_count !== meta.author_count;
			if (!layoutsChanged && !authorsChanged && previousMeta.revision !== meta.revision) {
				// A revision change not attributed to either resource is unexpected; refresh both.
				layoutsChanged = true;
				authorsChanged = true;
			}
		}

		console.log(
			`→ ${options.force || !previous ? 'Downloading' : 'Refreshing'} Clemenpine ${[
				layoutsChanged ? 'layouts' : '',
				authorsChanged ? 'authors' : ''
			]
				.filter(Boolean)
				.join(' + ')}`
		);
		const [downloadedLayouts, downloadedAuthors] = await Promise.all([
			layoutsChanged ? fetchJson(CLEMENPINE_LAYOUTS_URL, fetchOptions) : undefined,
			authorsChanged ? fetchJson(CLEMENPINE_AUTHORS_URL, fetchOptions) : undefined
		]);
		const layoutsJson = layoutsChanged ? downloadedLayouts : previous?.snapshot.layouts;
		const authorsJson = authorsChanged ? downloadedAuthors : previous?.snapshot.authors;
		const parsed = parseClemenpineCatalog(layoutsJson, authorsJson);

		if (meta) {
			assertMetaMatchesCatalog(meta, parsed);
			const confirmedMetaJson = await fetchJson(CLEMENPINE_META_URL, fetchOptions);
			const confirmedMeta = parseClemenpineMeta(confirmedMetaJson);
			if (!metaIsEqual(meta, confirmedMeta)) {
				throw new Error(
					`Clemenpine revision changed while downloading (${meta.revision} → ${confirmedMeta.revision})`
				);
			}
			metaJson = confirmedMetaJson;
		}

		const dataUnchanged =
			previous &&
			JSON.stringify(previous.snapshot.layouts) === JSON.stringify(layoutsJson) &&
			JSON.stringify(previous.snapshot.authors) === JSON.stringify(authorsJson);
		const storedMeta = metaJson ?? (dataUnchanged ? previous?.snapshot.meta : undefined);
		const snapshotUnchanged =
			!endpointsChanged &&
			dataUnchanged &&
			JSON.stringify(previous?.snapshot.meta) === JSON.stringify(storedMeta);
		if (snapshotUnchanged) {
			console.log(`  ✔ Unchanged: ${snapshotPath}`);
			return { json: parsed, updated: false, fromCache: false };
		}

		/** @type {ClemenpineSnapshot} */
		const snapshot = {
			version: SNAPSHOT_VERSION,
			fetchedAt: new Date().toISOString(),
			layoutsUrl: CLEMENPINE_LAYOUTS_URL,
			authorsUrl: CLEMENPINE_AUTHORS_URL,
			...(storedMeta === undefined ? {} : { metaUrl: CLEMENPINE_META_URL, meta: storedMeta }),
			layouts: layoutsJson,
			authors: authorsJson
		};
		const body = JSON.stringify(snapshot) + '\n';
		await mkdir(dirname(snapshotPath), { recursive: true });
		await writeFileAtomically(snapshotPath, body);
		console.log(`  ✔ ${snapshotPath} (${Buffer.byteLength(body).toLocaleString()} bytes)`);
		return { json: parsed, updated: true, fromCache: false };
	} catch (error) {
		if (previous) {
			console.warn(
				`  ⚠ Clemenpine update rejected (${errorMessage(error)}); keeping last snapshot`
			);
			return { json: previous.parsed, updated: false, fromCache: true };
		}
		throw new ClemenpineCatalogUnavailableError(
			`Clemenpine catalog unavailable and no valid cache exists: ${errorMessage(error)}`,
			{ cause: error }
		);
	}
}

/** Read the last successful layouts cache without hitting the network. */
export async function readCachedClemenpineLayouts() {
	const cached = await readCachedCatalog(
		clemenpineCachePath(CLEMENPINE_SNAPSHOT_CACHE_FILE),
		clemenpineCachePath(CLEMENPINE_LAYOUTS_CACHE_FILE),
		clemenpineCachePath(CLEMENPINE_AUTHORS_CACHE_FILE)
	);
	if (!cached) {
		throw new Error(
			`Clemenpine catalog missing at ${CLEMENPINE_CACHE_DIR}. Run: bun run ./bin/catalog-sync.js`
		);
	}
	return cached.parsed.layouts;
}

/** @returns {Promise<boolean>} */
export async function clemenpineCacheExists() {
	if (await pathExists(clemenpineCachePath(CLEMENPINE_SNAPSHOT_CACHE_FILE))) return true;
	const [layouts, authors] = await Promise.all([
		pathExists(clemenpineCachePath(CLEMENPINE_LAYOUTS_CACHE_FILE)),
		pathExists(clemenpineCachePath(CLEMENPINE_AUTHORS_CACHE_FILE))
	]);
	return layouts && authors;
}

/** SHA-256 of the active cached layouts + authors values, excluding snapshot metadata. */
export async function hashCachedClemenpineSources() {
	const cached = await readCachedCatalog(
		clemenpineCachePath(CLEMENPINE_SNAPSHOT_CACHE_FILE),
		clemenpineCachePath(CLEMENPINE_LAYOUTS_CACHE_FILE),
		clemenpineCachePath(CLEMENPINE_AUTHORS_CACHE_FILE)
	);
	if (!cached) throw new Error(`Clemenpine catalog cache is missing at ${CLEMENPINE_CACHE_DIR}`);
	const hash = createHash('sha256');
	hash.update(JSON.stringify(cached.snapshot.layouts));
	hash.update('\n');
	hash.update(JSON.stringify(cached.snapshot.authors));
	return hash.digest('hex');
}
