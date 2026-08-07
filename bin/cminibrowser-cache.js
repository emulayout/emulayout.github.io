/**
 * Download and cache cminibrowser static dumps under `.cache/cminibrowser/`.
 * Same bytes as the site's Quick download / `/data/...` URLs.
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
async function pathExists(cachePath) {
	try {
		await access(cachePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Ensure a dump is on disk; download unless `offline` and already cached.
 * Pass `force: true` to re-download even when a cache file exists.
 *
 * @param {string} dataPath path under /data, e.g. `stats/monkeyracer.json`
 * @param {{ offline?: boolean, force?: boolean }} [options]
 * @returns {Promise<string>} absolute cache file path
 */
export async function ensureCminibrowserDump(dataPath, options = {}) {
	const { offline = false, force = false } = options;
	const cachePath = cminibrowserCachePath(dataPath);
	const cached = await pathExists(cachePath);

	if (cached && !force) {
		return cachePath;
	}
	if (offline) {
		throw new Error(
			`cminibrowser dump missing at ${cachePath}. Run without --offline to download.`
		);
	}

	const url = cminibrowserDataUrl(dataPath);
	console.log(`→ Downloading ${url}`);
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': USER_AGENT
		}
	});
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
	}

	const body = Buffer.from(await response.arrayBuffer());
	await mkdir(dirname(cachePath), { recursive: true });
	await writeFile(cachePath, body);
	console.log(`  ✔ ${cachePath} (${body.length.toLocaleString()} bytes)`);
	return cachePath;
}

/**
 * @param {string} dataPath
 * @param {{ offline?: boolean, force?: boolean }} [options]
 */
export async function readCminibrowserJson(dataPath, options = {}) {
	const cachePath = await ensureCminibrowserDump(dataPath, options);
	return JSON.parse(await readFile(cachePath, 'utf-8'));
}
