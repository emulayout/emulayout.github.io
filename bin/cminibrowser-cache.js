/**
 * Download and cache cminibrowser static dumps under `.cache/cminibrowser/`.
 * Same bytes as the site's Quick download / `/data/...` URLs.
 *
 * Normal mode uses conditional requests (ETag / Last-Modified) so unchanged
 * dumps are not re-downloaded. Pass `force: true` to ignore validators.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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
	await writeFile(
		metaPathFor(cachePath),
		JSON.stringify({
			...(etag ? { etag } : {}),
			...(lastModified ? { lastModified } : {}),
			url: response.url,
			fetchedAt: new Date().toISOString()
		}) + '\n',
		'utf-8'
	);
}

/**
 * Ensure a dump is on disk.
 * - `offline`: require an existing cache file (no network).
 * - online + cached + !force: conditional GET (ETag / Last-Modified); 304 reuses cache.
 * - `force` or missing cache: unconditional download.
 *
 * @param {string} dataPath path under /data, e.g. `stats/monkeyracer.json`
 * @param {{ offline?: boolean, force?: boolean }} [options]
 * @returns {Promise<{ path: string, updated: boolean }>}
 */
export async function ensureCminibrowserDump(dataPath, options = {}) {
	const { offline = false, force = false } = options;
	const cachePath = cminibrowserCachePath(dataPath);
	const cached = await pathExists(cachePath);

	if (offline) {
		if (!cached) {
			throw new Error(
				`cminibrowser dump missing at ${cachePath}. Run without --offline to download.`
			);
		}
		return { path: cachePath, updated: false };
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
		return { path: cachePath, updated: false };
	}

	if (!response.ok) {
		throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
	}

	const body = Buffer.from(await response.arrayBuffer());
	await mkdir(dirname(cachePath), { recursive: true });
	await writeFile(cachePath, body);
	await writeDumpMeta(cachePath, response);
	console.log(`  ✔ ${cachePath} (${body.length.toLocaleString()} bytes)`);
	return { path: cachePath, updated: true };
}

/**
 * @param {string} dataPath
 * @param {{ offline?: boolean, force?: boolean }} [options]
 */
export async function readCminibrowserJson(dataPath, options = {}) {
	const { path } = await ensureCminibrowserDump(dataPath, options);
	return JSON.parse(await readFile(path, 'utf-8'));
}
