/**
 * Shared helpers for catalog and analyzer sync scripts.
 */

import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const LAYOUTS_FILE = 'static/all-layouts.json';
export const BLACKLIST_FILE = 'layout-blacklist.txt';
export const CMINI_CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');
export const MIN_STATS_CATALOG_COVERAGE = 0.9;

/**
 * Replace a file atomically so interrupted syncs cannot leave a partial cache or
 * generated artifact behind. The temporary file lives beside the destination,
 * which keeps the rename on the same filesystem.
 *
 * @param {string} path
 * @param {string | Uint8Array} body
 */
export async function writeFileAtomically(path, body) {
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, body);
		await rename(temporaryPath, path);
	} catch (error) {
		try {
			await unlink(temporaryPath);
		} catch {
			// Preserve the original write/rename failure if temporary cleanup also fails.
		}
		throw error;
	}
}

/**
 * Write generated text only when its bytes changed, preserving stable mtimes for
 * downstream caches while still re-deriving the content on every sync.
 *
 * @param {string} path
 * @param {string} body
 * @returns {Promise<boolean>} whether the file was written
 */
export async function writeTextFileIfChanged(path, body) {
	try {
		if ((await readFile(path, 'utf-8')) === body) return false;
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
	}
	await writeFileAtomically(path, body);
	return true;
}

/**
 * Reject suspiciously incomplete analyzer dumps before they can replace a good
 * cache or published artifact.
 *
 * @param {string} label
 * @param {number} loaded
 * @param {number} eligible
 * @param {number} [minimum]
 */
export function assertStatsCatalogCoverage(
	label,
	loaded,
	eligible,
	minimum = MIN_STATS_CATALOG_COVERAGE
) {
	const coverage = eligible > 0 ? loaded / eligible : 0;
	if (eligible > 0 && coverage >= minimum) return;

	throw new Error(
		`${label} covers ${loaded}/${eligible} eligible layouts (${(coverage * 100).toFixed(1)}%); ` +
			`minimum is ${(minimum * 100).toFixed(1)}%. Refusing to update cached or published stats.`
	);
}

/**
 * @returns {Promise<Set<string>>}
 */
export async function loadBlacklist() {
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
 * @param {string[]} argv
 * @param {{ offlineEnv?: string, forceEnv?: string }} [envKeys]
 */
export function parseOfflineForceArgs(argv, envKeys = {}) {
	const offline =
		argv.includes('--offline') ||
		(envKeys.offlineEnv ? process.env[envKeys.offlineEnv] === '1' : false);
	const force =
		argv.includes('--force') || (envKeys.forceEnv ? process.env[envKeys.forceEnv] === '1' : false);
	if (offline && force) {
		throw new Error('Cannot combine --offline and --force');
	}
	return { offline, force };
}

/**
 * Resolve corpora to sync: `--corpus=` wins, then an optional env override, else the defaults.
 *
 * @param {string[]} argv
 * @param {{ env?: string, defaultCorpora: readonly string[] }} options
 * @returns {string[]}
 */
export function parseCorpusArgs(argv, { env, defaultCorpora }) {
	const flag = argv.find((arg) => arg.startsWith('--corpus='));
	if (flag) {
		const corpus = flag.slice('--corpus='.length).trim();
		if (!corpus) throw new Error('Empty --corpus= value');
		return [corpus];
	}
	if (env) {
		const fromEnv = process.env[env]?.trim();
		if (fromEnv) return [fromEnv];
	}
	return [...defaultCorpora];
}
