/**
 * Download, validate, and cache one coordinated AKLDB catalog snapshot.
 *
 * Spark is the stored source format. AKLDB's Mana2 projection is cached beside
 * it because that projection is the server's authoritative compilation of
 * Magic and chiral authoring intent into executable rules.
 */

import { createHash } from 'node:crypto';
import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeFileAtomically } from './sync-shared.js';

export const AKLDB_ORIGIN = 'https://api.akldb.org';
export const AKLDB_FORMAT = 'spark/1';
export const AKLDB_MANA_FORMAT = 'mana2/1';
export const AKLDB_LAYOUTS_URL = `${AKLDB_ORIGIN}/v1/layouts?full=1&format=spark%2F1`;
export const AKLDB_MANA_LAYOUTS_URL = `${AKLDB_ORIGIN}/v1/layouts?full=1&format=mana2%2F1`;
export const AKLDB_AUTHORS_URL = `${AKLDB_ORIGIN}/v1/authors`;
export const AKLDB_META_URL = `${AKLDB_ORIGIN}/v1/meta`;
export const AKLDB_CACHE_DIR = join(process.cwd(), '.cache', 'akldb');
export const AKLDB_SNAPSHOT_CACHE_FILE = 'catalog-v1.json';
export const AKLDB_SYNCED_HASH_FILE = join(process.cwd(), '.cache', 'akldb-synced-hash');
export const AKLDB_REQUEST_TIMEOUT_MS = 90_000;

const SNAPSHOT_VERSION = 1;
const USER_AGENT = 'emulayout-akldb-sync/1.0 (+https://github.com/emulayout/emulayout.github.io)';
const FINGERS = new Set(['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT']);

/**
 * @typedef {{ char?: string, row: number, col: number, finger: string }} AkldbKey
 * @typedef {{ magic_keys?: unknown[], chiral_keys?: unknown[], adaptive_swaps?: unknown[], rules?: unknown[] }} AkldbMagic
 * @typedef {{ rules: { inputs: string, output: string }[], magicKeys?: string[] | null }} AkldbManaMagic
 * @typedef {{
 *   id: string,
 *   name: string,
 *   owner: string,
 *   layoutRev: number,
 *   createdAt: string,
 *   modifiedAt: string,
 *   formatModifiedAt: string,
 *   keys: AkldbKey[],
 *   magic?: AkldbMagic,
 *   manaMagic?: AkldbManaMagic,
 *   likes: string[],
 *   likeCount: number,
 *   link: string | null
 * }} AkldbLayout
 * @typedef {{ layouts: AkldbLayout[], authors: Record<string, string> }} ParsedAkldbCatalog
 * @typedef {{
 *   layout_count: number,
 *   author_count: number,
 *   seq: number,
 *   revision: string,
 *   layouts_modified_at: string,
 *   authors_modified_at: string,
 *   authors_version?: number,
 *   formats: string[],
 *   api: { major: number, minor: number }
 * }} AkldbMeta
 */

export class AkldbCatalogUnavailableError extends Error {
	/** @param {string} message @param {{ cause?: unknown }} [options] */
	constructor(message, options) {
		super(message, options);
		this.name = 'AkldbCatalogUnavailableError';
	}
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @param {string} label @returns {string} */
function parseTimestamp(value, label) {
	if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) {
		throw new Error(`${label} must be a valid timestamp`);
	}
	return value;
}

/** @param {unknown} value @param {string} label */
function parseId(value, label) {
	if (typeof value === 'string' && /^\d+$/.test(value)) return value;
	throw new Error(`${label} must be a decimal string`);
}

/** @param {unknown} value @param {string} label @returns {string} */
function parseCharacter(value, label) {
	if (typeof value !== 'string' || Array.from(value).length !== 1) {
		throw new Error(`${label} must be one character`);
	}
	return value;
}

/** @param {unknown} value @param {string} label */
function parseStringArray(value, label) {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(`${label} must be an array of strings`);
	}
}

/** @param {unknown} value @param {string} label @returns {unknown[]} */
function parseArray(value, label) {
	if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
	return value;
}

/** @param {unknown} value @param {string} label */
function parseMagicValue(value, label) {
	if (!isRecord(value) || (value.kind !== 'repeat' && value.kind !== 'char')) {
		throw new Error(`${label} must be a tagged Magic value`);
	}
	if (value.kind === 'char') parseCharacter(value.char, `${label}.char`);
}

/** @param {unknown} value @param {string} label @returns {AkldbMagic} */
function parseSparkMagic(value, label) {
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	const magicKeys = parseArray(value.magic_keys ?? [], `${label}.magic_keys`);
	const chiralKeys = parseArray(value.chiral_keys ?? [], `${label}.chiral_keys`);
	const adaptiveSwaps = parseArray(value.adaptive_swaps ?? [], `${label}.adaptive_swaps`);
	const rawRules = parseArray(value.rules ?? [], `${label}.rules`);

	for (const [index, entry] of magicKeys.entries()) {
		const itemLabel = `${label}.magic_keys[${index}]`;
		if (!isRecord(entry)) throw new Error(`${itemLabel} must be an object`);
		parseCharacter(entry.key, `${itemLabel}.key`);
		if (entry.default !== undefined) parseMagicValue(entry.default, `${itemLabel}.default`);
		if (entry.except !== undefined) parseStringArray(entry.except, `${itemLabel}.except`);
		const rules = entry.rules ?? [];
		if (!Array.isArray(rules)) throw new Error(`${itemLabel}.rules must be an array`);
		for (const [ruleIndex, rule] of rules.entries()) {
			if (
				!isRecord(rule) ||
				typeof rule.after !== 'string' ||
				!rule.after ||
				typeof rule.emit !== 'string' ||
				!rule.emit
			) {
				throw new Error(`${itemLabel}.rules[${ruleIndex}] must contain after and emit text`);
			}
		}
	}

	for (const [index, entry] of chiralKeys.entries()) {
		const itemLabel = `${label}.chiral_keys[${index}]`;
		if (!isRecord(entry)) throw new Error(`${itemLabel} must be an object`);
		parseCharacter(entry.key, `${itemLabel}.key`);
		for (const side of ['same', 'opposite']) {
			if (entry[side] !== undefined && entry[side] !== null) {
				parseMagicValue(entry[side], `${itemLabel}.${side}`);
			}
		}
		if (entry.except !== undefined) parseStringArray(entry.except, `${itemLabel}.except`);
	}

	for (const [index, entry] of adaptiveSwaps.entries()) {
		const itemLabel = `${label}.adaptive_swaps[${index}]`;
		if (!isRecord(entry)) throw new Error(`${itemLabel} must be an object`);
		parseCharacter(entry.trigger, `${itemLabel}.trigger`);
		if (!Array.isArray(entry.swap) || entry.swap.length !== 2) {
			throw new Error(`${itemLabel}.swap must contain two characters`);
		}
		parseCharacter(entry.swap[0], `${itemLabel}.swap[0]`);
		parseCharacter(entry.swap[1], `${itemLabel}.swap[1]`);
	}

	for (const [index, rule] of rawRules.entries()) {
		if (
			!isRecord(rule) ||
			typeof rule.inputs !== 'string' ||
			Array.from(rule.inputs).length < 2 ||
			typeof rule.output !== 'string' ||
			!rule.output
		) {
			throw new Error(`${label}.rules[${index}] must contain usable inputs and output text`);
		}
	}
	return /** @type {AkldbMagic} */ (value);
}

/** @param {unknown} value @param {string} label @returns {AkldbKey} */
function parseKey(value, label) {
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	if (
		!Number.isInteger(value.row) ||
		/** @type {number} */ (value.row) < 0 ||
		/** @type {number} */ (value.row) > 4
	) {
		throw new Error(`${label}.row must be an integer from 0 through 4`);
	}
	if (!Number.isInteger(value.col) || /** @type {number} */ (value.col) < 0) {
		throw new Error(`${label}.col must be a non-negative integer`);
	}
	if (typeof value.finger !== 'string' || !FINGERS.has(value.finger)) {
		throw new Error(`${label}.finger is not recognized`);
	}
	if (value.char !== undefined) parseCharacter(value.char, `${label}.char`);
	return {
		...(typeof value.char === 'string' ? { char: value.char } : {}),
		row: /** @type {number} */ (value.row),
		col: /** @type {number} */ (value.col),
		finger: value.finger
	};
}

/** @param {unknown} value @param {string} label */
function parseSparkPayload(value, label) {
	if (!isRecord(value) || !Array.isArray(value.keys)) {
		throw new Error(`${label} must contain a keys array`);
	}
	const keys = value.keys.map((key, index) => parseKey(key, `${label}.keys[${index}]`));
	const slots = new Set();
	for (const key of keys) {
		const slot = `${key.row},${key.col}`;
		if (slots.has(slot)) throw new Error(`${label} repeats position ${slot}`);
		slots.add(slot);
	}
	return {
		keys,
		...(value.magic !== undefined ? { magic: parseSparkMagic(value.magic, `${label}.magic`) } : {})
	};
}

/** @param {unknown} value @param {string} label @returns {AkldbManaMagic | undefined} */
function parseManaMagic(value, label) {
	if (value === undefined || value === null) return undefined;
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	const rawRules = value.rules ?? [];
	if (!Array.isArray(rawRules)) throw new Error(`${label}.rules must be an array`);
	const rules = rawRules.map((rule, index) => {
		if (!isRecord(rule) || typeof rule.inputs !== 'string' || typeof rule.output !== 'string') {
			throw new Error(`${label}.rules[${index}] must contain inputs and output strings`);
		}
		if (Array.from(rule.inputs).length < 2 || !rule.output) {
			throw new Error(`${label}.rules[${index}] must contain usable input and output text`);
		}
		return { inputs: rule.inputs, output: rule.output };
	});
	let magicKeys;
	if (value.magicKeys === null) magicKeys = null;
	else if (value.magicKeys !== undefined) {
		if (!Array.isArray(value.magicKeys) || value.magicKeys.some((key) => typeof key !== 'string')) {
			throw new Error(`${label}.magicKeys must be an array of strings or null`);
		}
		magicKeys = /** @type {string[]} */ (value.magicKeys);
	}
	return { rules, ...(magicKeys !== undefined ? { magicKeys } : {}) };
}

/** @param {unknown} json @returns {Map<string, { name: string, magic: AkldbManaMagic | undefined }>} */
function parseManaLayouts(json) {
	if (!isRecord(json) || !Array.isArray(json.items)) {
		throw new Error('AKLDB Mana2 layouts payload must contain an items array');
	}
	const result = new Map();
	for (const [index, item] of json.items.entries()) {
		if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
			throw new Error(`AKLDB Mana2 layout ${index} must contain id and name`);
		}
		if (result.has(item.id)) throw new Error(`AKLDB Mana2 payload repeats layout id ${item.id}`);
		if (!isRecord(item.payload)) throw new Error(`AKLDB Mana2 layout ${item.name} lacks payload`);
		result.set(item.id, {
			name: item.name,
			magic: parseManaMagic(item.payload.magic, `AKLDB Mana2 layout ${item.name}.magic`)
		});
	}
	return result;
}

/** @param {unknown} json @param {unknown} manaJson @returns {{ layouts: AkldbLayout[], skipped: 0 }} */
export function parseAkldbLayouts(json, manaJson) {
	if (!isRecord(json) || !Array.isArray(json.items)) {
		throw new Error('AKLDB Spark layouts payload must contain an items array');
	}
	const manaById = parseManaLayouts(manaJson);
	const seenNames = new Set();
	const layouts = json.items.map((item, index) => {
		const label = `AKLDB Spark layout ${index}`;
		if (!isRecord(item)) throw new Error(`${label} must be an object`);
		if (typeof item.id !== 'string' || !item.id) throw new Error(`${label}.id is required`);
		if (typeof item.name !== 'string' || !item.name) throw new Error(`${label}.name is required`);
		const lowerName = item.name.toLowerCase();
		if (seenNames.has(lowerName)) throw new Error(`AKLDB repeats layout name ${item.name}`);
		seenNames.add(lowerName);
		if (item.format !== AKLDB_FORMAT) throw new Error(`${label} did not return ${AKLDB_FORMAT}`);
		if (!isRecord(item.formats) || !isRecord(item.formats[AKLDB_FORMAT])) {
			throw new Error(`${label} has no stored ${AKLDB_FORMAT} metadata`);
		}
		const formatMeta = /** @type {Record<string, unknown>} */ (item.formats[AKLDB_FORMAT]);
		const createdAt = parseTimestamp(item.created_at, `${label}.created_at`);
		const modifiedAt = parseTimestamp(item.modified_at, `${label}.modified_at`);
		const formatModifiedAt = parseTimestamp(
			formatMeta.modified_at,
			`${label}.formats[${AKLDB_FORMAT}].modified_at`
		);
		if (!isRecord(item.payload)) throw new Error(`${label}.payload must be an object`);
		const payload = parseSparkPayload(item.payload, `${label}.payload`);
		if (!Array.isArray(item.likes)) throw new Error(`${label}.likes must be an array`);
		const likes = item.likes.map((id, likeIndex) => parseId(id, `${label}.likes[${likeIndex}]`));
		if (!Number.isInteger(item.like_count) || item.like_count !== likes.length) {
			throw new Error(`${label}.like_count must match likes`);
		}
		if (!Number.isInteger(item.layout_rev) || /** @type {number} */ (item.layout_rev) < 1) {
			throw new Error(`${label}.layout_rev must be a positive integer`);
		}
		if (item.link !== null && typeof item.link !== 'string') {
			throw new Error(`${label}.link must be a string or null`);
		}
		const mana = manaById.get(item.id);
		if (!mana) throw new Error(`${label} is absent from the Mana2 projection`);
		if (mana.name !== item.name) {
			throw new Error(`${label} disagrees with the Mana2 layout name ${mana.name}`);
		}
		return {
			id: item.id,
			name: item.name,
			owner: parseId(item.owner, `${label}.owner`),
			layoutRev: /** @type {number} */ (item.layout_rev),
			createdAt,
			modifiedAt,
			formatModifiedAt,
			...payload,
			manaMagic: mana.magic,
			likes,
			likeCount: /** @type {number} */ (item.like_count),
			link: /** @type {string | null} */ (item.link)
		};
	});
	if (manaById.size !== layouts.length) {
		throw new Error(
			`AKLDB format projections disagree: ${layouts.length} Spark layouts, ${manaById.size} Mana2 layouts`
		);
	}
	return { layouts, skipped: 0 };
}

/** @param {unknown} json @returns {Record<string, string>} */
export function parseAkldbAuthors(json) {
	if (!isRecord(json)) throw new Error('AKLDB authors payload must be an object of name → user id');
	const entries = Object.entries(json).map(([name, id]) => {
		if (!name) throw new Error('AKLDB author names must be nonempty');
		return [name, parseId(id, `AKLDB author ${JSON.stringify(name)}`)];
	});
	return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

/** @param {unknown} json @returns {AkldbMeta} */
export function parseAkldbMeta(json) {
	if (!isRecord(json) || !isRecord(json.api)) throw new Error('AKLDB meta payload is malformed');
	for (const field of ['layout_count', 'author_count', 'seq']) {
		if (!Number.isInteger(json[field]) || /** @type {number} */ (json[field]) < 0) {
			throw new Error(`AKLDB meta ${field} must be a non-negative integer`);
		}
	}
	for (const field of ['revision', 'layouts_modified_at', 'authors_modified_at']) {
		parseTimestamp(json[field], `AKLDB meta ${field}`);
	}
	if (json.api.major !== 1 || !Number.isInteger(json.api.minor)) {
		throw new Error(`Unsupported AKLDB API version ${json.api.major}.${json.api.minor}`);
	}
	if (
		!Array.isArray(json.formats) ||
		!json.formats.includes(AKLDB_FORMAT) ||
		!json.formats.includes(AKLDB_MANA_FORMAT)
	) {
		throw new Error(
			`AKLDB does not advertise required formats ${AKLDB_FORMAT} and ${AKLDB_MANA_FORMAT}`
		);
	}
	return /** @type {AkldbMeta} */ (json);
}

/** @param {unknown} layouts @param {unknown} manaLayouts @param {unknown} authors */
export function parseAkldbCatalog(layouts, manaLayouts, authors) {
	return { layouts: parseAkldbLayouts(layouts, manaLayouts), authors: parseAkldbAuthors(authors) };
}

/** @param {readonly AkldbLayout[]} layouts */
export function deriveLayoutLikes(layouts) {
	return Object.fromEntries(
		layouts
			.filter((layout) => layout.likeCount > 0)
			.sort((left, right) => left.name.localeCompare(right.name))
			.map((layout) => [layout.name, layout.likeCount])
	);
}

/** @param {string} filename */
export function akldbCachePath(filename) {
	return join(AKLDB_CACHE_DIR, filename.replace(/^\/+/, ''));
}

/** @param {string} path */
async function pathExists(path) {
	return access(path)
		.then(() => true)
		.catch(() => false);
}

/** @param {unknown} error */
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

/** @param {string} url @param {{ fetchImpl: typeof fetch, timeoutMs: number }} options */
async function fetchJson(url, { fetchImpl, timeoutMs }) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, {
			headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
		return JSON.parse(await response.text());
	} catch (error) {
		if (controller.signal.aborted) throw new Error(`Request timed out: ${url}`, { cause: error });
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

/** @param {unknown} value */
function isSnapshot(value) {
	return (
		isRecord(value) &&
		value.version === SNAPSHOT_VERSION &&
		'layouts' in value &&
		'manaLayouts' in value &&
		'authors' in value
	);
}

/** @param {string} snapshotPath */
async function readCachedCatalog(snapshotPath) {
	try {
		const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
		if (!isSnapshot(snapshot)) return null;
		return {
			snapshot,
			parsed: parseAkldbCatalog(snapshot.layouts, snapshot.manaLayouts, snapshot.authors)
		};
	} catch {
		return null;
	}
}

/** @param {AkldbMeta} left @param {AkldbMeta} right */
function metaIsEqual(left, right) {
	return (
		left.seq === right.seq &&
		left.layout_count === right.layout_count &&
		left.author_count === right.author_count &&
		left.revision === right.revision &&
		left.layouts_modified_at === right.layouts_modified_at &&
		left.authors_modified_at === right.authors_modified_at
	);
}

/**
 * @param {{ offline?: boolean, force?: boolean, fetchImpl?: typeof fetch, timeoutMs?: number, snapshotPath?: string }} [options]
 */
export async function ensureAkldbCatalog(options = {}) {
	const snapshotPath = options.snapshotPath ?? akldbCachePath(AKLDB_SNAPSHOT_CACHE_FILE);
	const previous = await readCachedCatalog(snapshotPath);
	if (options.offline) {
		if (!previous) throw new AkldbCatalogUnavailableError(`AKLDB cache missing at ${snapshotPath}`);
		return { json: previous.parsed, updated: false, fromCache: true };
	}

	try {
		const fetchOptions = {
			fetchImpl: options.fetchImpl ?? fetch,
			timeoutMs: options.timeoutMs ?? AKLDB_REQUEST_TIMEOUT_MS
		};
		const metaJson = await fetchJson(AKLDB_META_URL, fetchOptions);
		const meta = parseAkldbMeta(metaJson);
		const previousMeta = previous?.snapshot.meta ? parseAkldbMeta(previous.snapshot.meta) : null;
		if (!options.force && previous && previousMeta && metaIsEqual(previousMeta, meta)) {
			return { json: previous.parsed, updated: false, fromCache: false };
		}

		const [layouts, manaLayouts, authors] = await Promise.all([
			fetchJson(AKLDB_LAYOUTS_URL, fetchOptions),
			fetchJson(AKLDB_MANA_LAYOUTS_URL, fetchOptions),
			fetchJson(AKLDB_AUTHORS_URL, fetchOptions)
		]);
		const parsed = parseAkldbCatalog(layouts, manaLayouts, authors);
		if (parsed.layouts.layouts.length !== meta.layout_count) {
			throw new Error('AKLDB meta layout count does not match the downloaded catalog');
		}
		if (Object.keys(parsed.authors).length !== meta.author_count) {
			throw new Error('AKLDB meta author count does not match the downloaded authors');
		}
		const confirmedMetaJson = await fetchJson(AKLDB_META_URL, fetchOptions);
		const confirmedMeta = parseAkldbMeta(confirmedMetaJson);
		if (!metaIsEqual(meta, confirmedMeta)) {
			throw new Error(`AKLDB changed while downloading (${meta.seq} → ${confirmedMeta.seq})`);
		}

		const snapshot = {
			version: SNAPSHOT_VERSION,
			fetchedAt: new Date().toISOString(),
			layoutsUrl: AKLDB_LAYOUTS_URL,
			manaLayoutsUrl: AKLDB_MANA_LAYOUTS_URL,
			authorsUrl: AKLDB_AUTHORS_URL,
			metaUrl: AKLDB_META_URL,
			meta: confirmedMetaJson,
			layouts,
			manaLayouts,
			authors
		};
		const body = JSON.stringify(snapshot) + '\n';
		await mkdir(dirname(snapshotPath), { recursive: true });
		await writeFileAtomically(snapshotPath, body);
		return { json: parsed, updated: true, fromCache: false };
	} catch (error) {
		if (previous) {
			console.warn(`  ⚠ AKLDB update rejected (${errorMessage(error)}); keeping last snapshot`);
			return { json: previous.parsed, updated: false, fromCache: true };
		}
		throw new AkldbCatalogUnavailableError(
			`AKLDB catalog unavailable and no valid cache exists: ${errorMessage(error)}`,
			{ cause: error }
		);
	}
}

export async function readCachedAkldbLayouts() {
	const cached = await readCachedCatalog(akldbCachePath(AKLDB_SNAPSHOT_CACHE_FILE));
	if (!cached) throw new Error(`AKLDB catalog missing at ${AKLDB_CACHE_DIR}`);
	return cached.parsed.layouts;
}

export async function akldbCacheExists() {
	return pathExists(akldbCachePath(AKLDB_SNAPSHOT_CACHE_FILE));
}

export async function hashCachedAkldbSources() {
	const cached = await readCachedCatalog(akldbCachePath(AKLDB_SNAPSHOT_CACHE_FILE));
	if (!cached) throw new Error(`AKLDB catalog cache is missing at ${AKLDB_CACHE_DIR}`);
	const hash = createHash('sha256');
	hash.update(JSON.stringify(cached.snapshot.layouts));
	hash.update('\n');
	hash.update(JSON.stringify(cached.snapshot.manaLayouts));
	hash.update('\n');
	hash.update(JSON.stringify(cached.snapshot.authors));
	return hash.digest('hex');
}
