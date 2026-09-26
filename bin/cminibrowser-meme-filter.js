/**
 * Derive the former akl.gg meme filter from supported stats/v1 fields.
 *
 * A layout is excluded when it is incomplete or its row-staggered cmini
 * Fspeed exceeds the corpus cutoff. akl.gg no longer publishes a composed
 * meme_filter.json object, so Emulayout owns the historical cutoffs.
 */

import { ensureAklStatsLayouts, getAklStatsCell } from './akl-stats-v1.js';
import { CMINIBROWSER_CMINI_DEFAULT_CORPUS } from './cminibrowser-cmini-stats.js';
import { assertStatsCatalogCoverage } from './sync-shared.js';

export const CMINIBROWSER_MEME_FILTER_DEFAULT_CORPUS = CMINIBROWSER_CMINI_DEFAULT_CORPUS;

export const MEME_FILTER_FSPEED_CUTOFFS = {
	akl: 250,
	e10k: 250,
	e200: 250,
	finnish: 250,
	french: 250,
	german: 340,
	indonesian: 340,
	monkeyracer: 250,
	polish: 250,
	reddit: 250,
	russian: 700,
	spanish: 330
};

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} layoutName
 * @param {ReadonlySet<string>} excluded lowercase layout ids and `id.json` aliases
 */
export function isExcludedLayout(layoutName, excluded) {
	const lower = layoutName.toLowerCase();
	return excluded.has(lower) || excluded.has(`${lower}.json`);
}

/** @param {Iterable<string>} ids */
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
 * @param {Array<{ id: string, name: string }>} layouts
 * @param {ReadonlyMap<string, Record<string, unknown>>} objects
 * @param {string} corpus
 * @param {number} cutoff
 */
export function deriveMemeFilterExclusions(layouts, objects, corpus, cutoff) {
	const names = [];
	for (const layout of layouts) {
		const object = objects.get(layout.id);
		if (!object || object.deleted !== false) continue;
		const apiLayout = isRecord(object.layout) ? object.layout : null;
		const candidateCell = getAklStatsCell(object, 'cmini', `${corpus}.rowstag.none`);
		const cell = isRecord(candidateCell) ? candidateCell : null;
		const incomplete = apiLayout?.complete === false;
		const fspeed = cell?.fspeed;
		if (incomplete || (typeof fspeed === 'number' && Number.isFinite(fspeed) && fspeed > cutoff)) {
			names.push(layout.name);
		}
	}
	return exclusionSetFromIds(names);
}

/** @param {string[]} [argv] */
export function resolveMemeFilterCorpus(argv = process.argv.slice(2)) {
	const flag = argv.find((arg) => arg.startsWith('--meme-corpus='));
	if (flag) {
		const corpus = flag.slice('--meme-corpus='.length).trim();
		if (!corpus) throw new Error('Empty --meme-corpus= value');
		return corpus;
	}
	const fromEnv =
		process.env.AKL_STATS_MEME_FILTER_CORPUS?.trim() ??
		process.env.CMINIBROWSER_MEME_FILTER_CORPUS?.trim();
	if (fromEnv) return fromEnv;
	return CMINIBROWSER_MEME_FILTER_DEFAULT_CORPUS;
}

/**
 * @param {{
 *   layouts: Array<{ id: string, name: string, layoutRev: number }>,
 *   offline?: boolean,
 *   force?: boolean,
 *   corpus?: string,
 *   argv?: string[]
 * }} options
 */
export async function loadMemeFilterExclusions(options) {
	const {
		layouts,
		offline = false,
		force = false,
		corpus = resolveMemeFilterCorpus(options.argv ?? process.argv.slice(2))
	} = options;
	const cutoff = /** @type {Record<string, number>} */ (MEME_FILTER_FSPEED_CUTOFFS)[corpus];
	if (cutoff === undefined) {
		throw new Error(
			`No owned meme-filter cutoff for ${JSON.stringify(corpus)}; known: ${Object.keys(MEME_FILTER_FSPEED_CUTOFFS).join(', ')}`
		);
	}
	const result = await ensureAklStatsLayouts(layouts, { offline, force });
	assertStatsCatalogCoverage(
		'akl.gg stats/v1 meme-filter inputs',
		result.objects.size,
		layouts.length
	);
	const excluded = deriveMemeFilterExclusions(layouts, result.objects, corpus, cutoff);
	return {
		corpus,
		excluded,
		cutoff,
		size: layouts.filter((layout) => isExcludedLayout(layout.name, excluded)).length,
		updated: result.updated
	};
}
