import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { $ } from 'bun';

const TIMESTAMP_CACHE_FILE = join(process.cwd(), '.cache', 'layout-timestamps.json');

/**
 * Walks git history (newest first) and returns a map of layout filename → ISO commit date.
 * Uses an on-disk cache keyed by cmini HEAD for incremental updates on nightly syncs.
 */
export async function buildLayoutTimestamps(cacheDir, layoutFilenames) {
	const needed = new Set(layoutFilenames);
	const headSha = (await $`git -C ${cacheDir} rev-parse HEAD`.text()).trim();

	const cache = await loadTimestampCache();
	let timestamps = cache?.timestamps ? { ...cache.timestamps } : {};

	for (const key of Object.keys(timestamps)) {
		if (!needed.has(key)) {
			delete timestamps[key];
		}
	}

	if (cache?.commitSha === headSha && layoutFilenames.every((f) => timestamps[f])) {
		return timestamps;
	}

	const cacheValid = cache?.commitSha && (await commitExists(cacheDir, cache.commitSha));

	if (cacheValid && cache.commitSha !== headSha) {
		const newCommits = await getRevList(cacheDir, `${cache.commitSha}..HEAD`);
		await applyCommits(cacheDir, newCommits, needed, timestamps, true);
	}

	const missing = layoutFilenames.filter((f) => !timestamps[f]);
	if (missing.length > 0) {
		const missingSet = new Set(missing);
		const allCommits = await getRevList(cacheDir, 'HEAD');
		await applyCommits(cacheDir, allCommits, missingSet, timestamps, false);
	}

	const stillMissing = layoutFilenames.filter((f) => !timestamps[f]);
	if (stillMissing.length > 0) {
		console.warn(
			`  ⚠ No git timestamp for ${stillMissing.length} layout(s); using current time as fallback`
		);
		const fallback = new Date().toISOString();
		for (const filename of stillMissing) {
			timestamps[filename] = fallback;
		}
	}

	await saveTimestampCache(headSha, timestamps);
	return timestamps;
}

async function applyCommits(cacheDir, commits, needed, timestamps, overwrite) {
	const dates = await loadCommitDates(cacheDir, commits);
	const filesByCommit = await loadChangedLayoutFilesByCommit(cacheDir, commits);

	for (const sha of commits) {
		const date = dates.get(sha);
		if (!date) continue;
		const files = filesByCommit.get(sha) ?? [];

		for (const filename of files) {
			if (!needed.has(filename)) continue;
			if (overwrite || !timestamps[filename]) {
				timestamps[filename] = date;
			}
		}

		if (!overwrite && [...needed].every((f) => timestamps[f])) {
			break;
		}
	}
}

/** @param {string} cacheDir @param {string[]} commits @returns {Promise<Map<string, string>>} */
async function loadCommitDates(cacheDir, commits) {
	/** @type {Map<string, string>} */
	const dates = new Map();
	if (commits.length === 0) return dates;

	for (let i = 0; i < commits.length; i += 256) {
		const chunk = commits.slice(i, i + 256);
		const output = await $`git -C ${cacheDir} log --format=%H%x09%aI ${chunk}`.text();
		for (const line of output.trim().split('\n')) {
			if (!line) continue;
			const tab = line.indexOf('\t');
			if (tab === -1) continue;
			dates.set(line.slice(0, tab), line.slice(tab + 1));
		}
	}
	return dates;
}

/** @param {string} cacheDir @param {string[]} commits @returns {Promise<Map<string, string[]>>} */
async function loadChangedLayoutFilesByCommit(cacheDir, commits) {
	/** @type {Map<string, string[]>} */
	const filesByCommit = new Map();
	if (commits.length === 0) return filesByCommit;

	for (let i = 0; i < commits.length; i += 256) {
		const chunk = commits.slice(i, i + 256);
		const output = await $`git -C ${cacheDir} log --name-only --format=commit:%H ${chunk}`.text();
		let currentSha = '';
		for (const line of output.trim().split('\n')) {
			if (!line) continue;
			if (line.startsWith('commit:')) {
				currentSha = line.slice('commit:'.length);
				if (!filesByCommit.has(currentSha)) {
					filesByCommit.set(currentSha, []);
				}
				continue;
			}
			if (!currentSha || !line.startsWith('layouts/')) continue;
			filesByCommit.get(currentSha).push(line.replace(/^layouts\//, ''));
		}
	}
	return filesByCommit;
}

async function loadTimestampCache() {
	try {
		const content = await readFile(TIMESTAMP_CACHE_FILE, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

async function saveTimestampCache(commitSha, timestamps) {
	await mkdir(dirname(TIMESTAMP_CACHE_FILE), { recursive: true });
	await writeFile(
		TIMESTAMP_CACHE_FILE,
		JSON.stringify({ commitSha, timestamps }, null, '\t') + '\n',
		'utf-8'
	);
}

async function commitExists(cacheDir, sha) {
	const result = await $`git -C ${cacheDir} cat-file -e ${sha}`.quiet().nothrow();
	return result.exitCode === 0;
}

async function getRevList(cacheDir, range) {
	const output = await $`git -C ${cacheDir} rev-list ${range}`.text();
	return output
		.trim()
		.split('\n')
		.filter(Boolean);
}
