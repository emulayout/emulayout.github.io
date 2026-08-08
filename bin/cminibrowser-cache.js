/**
 * Download and cache cminibrowser static dumps under `.cache/cminibrowser/`.
 * Same bytes as the site's Quick download / `/data/...` URLs.
 *
 * Normal mode uses conditional requests (ETag / Last-Modified) so unchanged
 * dumps are not re-downloaded. Pass `force: true` to ignore validators.
 */

import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeFileAtomically } from './sync-shared.js';

export const CMINIBROWSER_ORIGIN = 'https://cminibrowser.com';
export const CMINIBROWSER_CACHE_DIR = join(process.cwd(), '.cache', 'cminibrowser');

const USER_AGENT =
	'emulayout-cminibrowser-sync/0.1 (+https://github.com/emulayout/emulayout.github.io)';

/**
 * @param {string} dataPath path under /data, e.g. `stats/monkeyracer.json`
 */
export function cminibrowserDataUrl(dataPath) {
	const normalized = dataPath.replace(/^\/+/, '').replace(/^data\//, '');
	return `${CMINIBROWSER_ORIGIN}/data/${normalized}`;
}

/**
 * @param {string} dataPath
 */
export function cminibrowserCachePath(dataPath) {
	const normalized = dataPath.replace(/^\/+/, '').replace(/^data\//, '');
	return join(CMINIBROWSER_CACHE_DIR, normalized);
}

/**
 * @param {string} cachePath
 */
function metaPathFor(cachePath) {
	return `${cachePath}.meta.json`;
}

/**
 * @param {string} cachePath
 */
async function pathExists(cachePath) {
	try {
		await access(cachePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} cachePath
 * @returns {Promise<{ etag?: string, lastModified?: string } | null>}
 */
async function readDumpMeta(cachePath) {
	try {
		const raw = JSON.parse(await readFile(metaPathFor(cachePath), 'utf-8'));
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
		/** @type {{ etag?: string, lastModified?: string }} */
		const meta = {};
		if (typeof raw.etag === 'string' && raw.etag) meta.etag = raw.etag;
		if (typeof raw.lastModified === 'string' && raw.lastModified)
			meta.lastModified = raw.lastModified;
		return Object.keys(meta).length > 0 ? meta : null;
	} catch {
		return null;
	}
}

/**
 * @param {string} cachePath
 * @param {Response} response
 */
async function writeDumpMeta(cachePath, response) {
	const etag = response.headers.get('etag') ?? undefined;
	const lastModified = response.headers.get('last-modified') ?? undefined;
	if (!etag && !lastModified) return;
	await writeFileAtomically(
		metaPathFor(cachePath),
		JSON.stringify({
			...(etag ? { etag } : {}),
			...(lastModified ? { lastModified } : {}),
			url: response.url,
			fetchedAt: new Date().toISOString()
		}) + '\n'
	);
}

/**
 * @param {string | Uint8Array} body
 * @param {string} source
 */
function parseDumpJson(body, source) {
	try {
		return JSON.parse(typeof body === 'string' ? body : Buffer.from(body).toString('utf-8'));
	} catch (error) {
		throw new Error(
			`Invalid JSON in cminibrowser dump from ${source}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		);
	}
}

/**
 * @param {string} cachePath
 * @param {((value: unknown) => void) | undefined} validateJson
 */
async function readAndValidateCachedDump(cachePath, validateJson) {
	const json = parseDumpJson(await readFile(cachePath, 'utf-8'), cachePath);
	validateJson?.(json);
	return json;
}

/**
 * Ensure a dump is on disk.
 * - `offline`: require an existing cache file (no network).
 * - online + cached + !force: conditional GET (ETag / Last-Modified); 304 reuses cache.
 * - `force` or missing cache: unconditional download.
 *
 * @param {string} dataPath path under /data, e.g. `stats/monkeyracer.json`
 * @param {{ offline?: boolean, force?: boolean, validateJson?: (value: unknown) => void }} [options]
 * @returns {Promise<{ path: string, updated: boolean, json: unknown }>}
 */
export async function ensureCminibrowserDump(dataPath, options = {}) {
	const { offline = false, force = false, validateJson } = options;
	const cachePath = cminibrowserCachePath(dataPath);
	const cached = await pathExists(cachePath);

	if (offline) {
		if (!cached) {
			throw new Error(
				`cminibrowser dump missing at ${cachePath}. Run without --offline to download.`
			);
		}
		const json = await readAndValidateCachedDump(cachePath, validateJson);
		return { path: cachePath, updated: false, json };
	}

	const url = cminibrowserDataUrl(dataPath);
	/** @type {Record<string, string>} */
	const headers = {
		Accept: 'application/json',
		'User-Agent': USER_AGENT
	};

	if (cached && !force) {
		const meta = await readDumpMeta(cachePath);
		if (meta?.etag) headers['If-None-Match'] = meta.etag;
		if (meta?.lastModified) headers['If-Modified-Since'] = meta.lastModified;
	}

	console.log(`→ ${cached && !force ? 'Checking' : 'Downloading'} ${url}`);
	const response = await fetch(url, { headers });

	if (response.status === 304) {
		if (!cached) {
			throw new Error(`Received HTTP 304 for ${url} but cache file is missing at ${cachePath}`);
		}
		console.log(`  ✔ Not modified (cache hit): ${cachePath}`);
		const json = await readAndValidateCachedDump(cachePath, validateJson);
		return { path: cachePath, updated: false, json };
	}

	if (!response.ok) {
		throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
	}

	const body = Buffer.from(await response.arrayBuffer());
	const json = parseDumpJson(body, url);
	validateJson?.(json);
	await mkdir(dirname(cachePath), { recursive: true });
	await writeFileAtomically(cachePath, body);
	await writeDumpMeta(cachePath, response);
	console.log(`  ✔ ${cachePath} (${body.length.toLocaleString()} bytes)`);
	return { path: cachePath, updated: true, json };
}

/**
 * @param {string} dataPath
 * @param {{ offline?: boolean, force?: boolean, validateJson?: (value: unknown) => void }} [options]
 */
export async function readCminibrowserJson(dataPath, options = {}) {
	const { json } = await ensureCminibrowserDump(dataPath, options);
	return json;
}
