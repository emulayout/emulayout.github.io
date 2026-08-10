/**
 * cminibrowser meme filter dump (`/data/meme_filter.json`).
 *
 * A layout is meme-tier for a corpus when it is incomplete or its row-staggered
 * Fspeed exceeds that corpus's cutoff. Emulayout uses the dump as the catalog
 * exclusion list (same role as the former local layout blacklist).
 */

import { ensureCminibrowserDump } from './cminibrowser-cache.js';
import { CMINIBROWSER_CMINI_DEFAULT_CORPUS } from './cminibrowser-cmini-stats.js';

export const CMINIBROWSER_MEME_FILTER_PATH = 'meme_filter.json';
export const CMINIBROWSER_MEME_FILTER_DEFAULT_CORPUS = CMINIBROWSER_CMINI_DEFAULT_CORPUS;

/**
 * @param {string} layoutName
 * @param {ReadonlySet<string>} excluded lowercase layout ids and `id.json` aliases
 */
export function isExcludedLayout(layoutName, excluded) {
	const lower = layoutName.toLowerCase();
	return excluded.has(lower) || excluded.has(`${lower}.json`);
}

/**
 * Expand layout ids into lowercase name / `name.json` pairs for membership checks.
 *
 * @param {Iterable<string>} ids
 * @returns {Set<string>}
 */
export function exclusionSetFromIds(ids) {
	/** @type {Set<string>} */
	const excluded = new Set();
	for (const raw of ids) {
		const entry = String(raw).trim().toLowerCase();
		if (!entry) continue;
		excluded.add(entry);
		excluded.add(entry.replace(/\.json$/i, ''));
		if (!entry.endsWith('.json')) excluded.add(`${entry}.json`);
	}
	return excluded;
}

/**
 * @param {unknown} dump
 * @returns {{ board: string | null, corpora: Map<string, { cutoff: number | null, memeIds: string[] }> }}
 */
export function indexMemeFilterDump(dump) {
	/** @type {Map<string, { cutoff: number | null, memeIds: string[] }>} */
	const corpora = new Map();
	if (!dump || typeof dump !== 'object' || Array.isArray(dump)) {
		return { board: null, corpora };
	}

	const record = /** @type {{ board?: unknown, corpora?: unknown }} */ (dump);
	const board = typeof record.board === 'string' ? record.board : null;
	const corporaRaw = record.corpora;
	if (!corporaRaw || typeof corporaRaw !== 'object' || Array.isArray(corporaRaw)) {
		return { board, corpora };
	}

	for (const [corpus, info] of Object.entries(corporaRaw)) {
		if (!info || typeof info !== 'object' || Array.isArray(info)) continue;
		const cutoffRaw = /** @type {{ cutoff?: unknown }} */ (info).cutoff;
		const cutoff = typeof cutoffRaw === 'number' && Number.isFinite(cutoffRaw) ? cutoffRaw : null;
		const memeIdsRaw = /** @type {{ meme_ids?: unknown }} */ (info).meme_ids;
		const memeIds = Array.isArray(memeIdsRaw)
			? memeIdsRaw.filter((id) => typeof id === 'string' || typeof id === 'number').map(String)
			: [];
		corpora.set(corpus, { cutoff, memeIds });
	}

	return { board, corpora };
}

/**
 * @param {unknown} dump
 * @param {string} corpus
 * @returns {Set<string>}
 */
export function memeFilterExclusionSet(dump, corpus) {
	const { corpora } = indexMemeFilterDump(dump);
	const entry = corpora.get(corpus);
	if (!entry) {
		const known = [...corpora.keys()].sort().join(', ') || '(none)';
		throw new Error(
			`cminibrowser meme filter has no corpus ${JSON.stringify(corpus)}; known: ${known}`
		);
	}
	return exclusionSetFromIds(entry.memeIds);
}

/**
 * Resolve which meme-filter corpus drives catalog exclusion.
 *
 * @param {string[]} [argv]
 * @returns {string}
 */
export function resolveMemeFilterCorpus(argv = process.argv.slice(2)) {
	const flag = argv.find((arg) => arg.startsWith('--meme-corpus='));
	if (flag) {
		const corpus = flag.slice('--meme-corpus='.length).trim();
		if (!corpus) throw new Error('Empty --meme-corpus= value');
		return corpus;
	}
	const fromEnv = process.env.CMINIBROWSER_MEME_FILTER_CORPUS?.trim();
	if (fromEnv) return fromEnv;
	return CMINIBROWSER_MEME_FILTER_DEFAULT_CORPUS;
}

/**
 * Download (or reuse) the meme filter dump and return an exclusion set.
 *
 * @param {{
 *   offline?: boolean,
 *   force?: boolean,
 *   corpus?: string,
 *   argv?: string[]
 * }} [options]
 * @returns {Promise<{ corpus: string, excluded: Set<string>, cutoff: number | null, size: number, updated: boolean }>}
 */
export async function loadMemeFilterExclusions(options = {}) {
	const {
		offline = false,
		force = false,
		corpus = resolveMemeFilterCorpus(options.argv ?? process.argv.slice(2))
	} = options;

	const { json: dump, updated } = await ensureCminibrowserDump(CMINIBROWSER_MEME_FILTER_PATH, {
		offline,
		force
	});
	const { corpora } = indexMemeFilterDump(dump);
	const entry = corpora.get(corpus);
	if (!entry) {
		const known = [...corpora.keys()].sort().join(', ') || '(none)';
		throw new Error(
			`cminibrowser meme filter has no corpus ${JSON.stringify(corpus)}; known: ${known}`
		);
	}
	const excluded = exclusionSetFromIds(entry.memeIds);
	return {
		corpus,
		excluded,
		cutoff: entry.cutoff,
		size: entry.memeIds.length,
		updated
	};
}
