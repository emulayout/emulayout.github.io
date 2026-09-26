/**
 * Deterministic hashes used by the deploy workflow.
 *
 * `--artifacts` fingerprints published source artifacts to decide whether a
 * scheduled run needs a build and deploy. `--cache` also includes downloaded
 * source caches so GitHub Actions can preserve the newest last-good snapshot.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const ROOT = process.cwd();
const STATIC_DIR = resolve(ROOT, 'static');
const REQUIRED_ARTIFACTS = [
	'all-layouts.json',
	'layout-supplemental.json',
	'authors.json',
	'layout-likes.json',
	'layout-stats-cyanophage-column-stagger.json',
	'layout-stats-cyanophage-row-stagger.json'
];
const STATS_ARTIFACT_PATTERN = /^layout-stats-(?:cmini|mana2)-.+\.json$/;

async function artifactPaths() {
	let entries = [];
	try {
		entries = await readdir(STATIC_DIR);
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
	}
	return [
		...REQUIRED_ARTIFACTS.map((name) => resolve(STATIC_DIR, name)),
		...entries
			.filter((name) => STATS_ARTIFACT_PATTERN.test(name))
			.map((name) => resolve(STATIC_DIR, name))
	];
}

/** @param {string} path */
async function walkFiles(path) {
	try {
		const info = await stat(path);
		if (info.isFile()) return [path];
		if (!info.isDirectory()) return [];
		const entries = await readdir(path, { withFileTypes: true });
		const nested = await Promise.all(
			entries
				.filter((entry) => !entry.name.endsWith('.tmp'))
				.map((entry) => walkFiles(resolve(path, entry.name)))
		);
		return nested.flat();
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return [];
		throw error;
	}
}

/** @param {'artifacts' | 'cache'} scope */
export async function hashDataState(scope) {
	const artifacts = await artifactPaths();
	const roots =
		scope === 'cache'
			? [
					...artifacts,
					resolve(ROOT, '.cache', 'akldb'),
					resolve(ROOT, '.cache', 'akl-stats-v1'),
					resolve(ROOT, '.cache', 'akldb-synced-hash')
				]
			: artifacts;
	const discovered = await Promise.all(roots.map(walkFiles));
	const files = [...new Set(discovered.flat())].sort((left, right) => left.localeCompare(right));
	const hash = createHash('sha256');
	for (const required of REQUIRED_ARTIFACTS) {
		const path = resolve(STATIC_DIR, required);
		if (!files.includes(path)) hash.update(`missing:${relative(ROOT, path)}\0`);
	}
	for (const path of files) {
		const body = await readFile(path);
		hash.update(relative(ROOT, path));
		hash.update('\0');
		hash.update(String(body.length));
		hash.update('\0');
		hash.update(body);
		hash.update('\0');
	}
	return hash.digest('hex');
}

if (import.meta.main) {
	const scope = process.argv.includes('--cache') ? 'cache' : 'artifacts';
	console.log(await hashDataState(scope));
}
