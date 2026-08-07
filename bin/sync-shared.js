/**
 * Shared helpers for catalog and analyzer sync scripts.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const LAYOUTS_FILE = 'static/all-layouts.json';
export const BLACKLIST_FILE = 'layout-blacklist.txt';
export const CMINI_CACHE_DIR = join(process.cwd(), '.cache', 'cmini-repo');

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
