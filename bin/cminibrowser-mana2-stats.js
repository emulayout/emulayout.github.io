/**
 * Map cminibrowser mana2 named dumps into Emulayout compact Mana2 arrays
 * (`MANA2_STAT_KEYS` / `MANA2_STAT_VALUE_SCALE`), and preserve the full dump
 * entry for per-layout detail payloads (show pages).
 *
 * Dump URL: `/data/mana2/named/{corpus}.{board}.{space}.json`
 * Key order/scale must stay aligned with `src/lib/statsDerivation.ts`.
 */

/** Default corpus / board / space for published Mana2 catalog stats. */
export const CMINIBROWSER_MANA2_DEFAULT_CORPUS = 'monkeyracer';
export const CMINIBROWSER_MANA2_DEFAULT_BOARD = 'rowstag';
export const CMINIBROWSER_MANA2_DEFAULT_SPACE = 'none';

/** Fixed-point scale for compact Mana2 arrays (4 decimal places). */
export const CMINIBROWSER_MANA2_STAT_VALUE_SCALE = 10_000;

/**
 * Compact field order — keep in sync with MANA2_STAT_KEYS in statsDerivation.ts.
 * @type {readonly string[]}
 */
export const CMINIBROWSER_MANA2_STAT_KEYS = [
	'finger-usage-LP',
	'finger-usage-LR',
	'finger-usage-LM',
	'finger-usage-LI',
	'finger-usage-LT',
	'finger-usage-RT',
	'finger-usage-RI',
	'finger-usage-RM',
	'finger-usage-RR',
	'finger-usage-RP',
	'offpinky',
	'sfb',
	'sfbw',
	'skb',
	'lsb',
	'vsb',
	'sfs',
	'sfsw',
	'sks',
	'lss',
	'vss',
	'alt',
	'altnothumbs',
	'altsfs',
	'altsfsnothumbs',
	'redirect',
	'redirectnothumbs',
	'redirectsfs',
	'redirectsfsnothumbs',
	'redirectweak',
	'redirectweaknothumbs',
	'redirectsfsweak',
	'redirectsfsweaknothumbs',
	'roll',
	'rollnothumbs',
	'inroll2',
	'inroll2nothumbs',
	'outroll2',
	'outroll2nothumbs',
	'inroll3',
	'inroll3nothumbs',
	'outroll3',
	'outroll3nothumbs',
	'goodroll',
	'goodrollnothumbs'
];

const FINGER_USAGE_ORDER = ['LP', 'LR', 'LM', 'LI', 'LT', 'RT', 'RI', 'RM', 'RR', 'RP'];

/** Dump big.* → Mana2 bigram ids (cminibrowser reuses sfs/sfsw names for both big and skip). */
const BIG_FIELD_MAP = [
	['sfs', 'sfb'],
	['sfsw', 'sfbw'],
	['sks', 'skb'],
	['lss', 'lsb'],
	['vss', 'vsb']
];

const SKIP_FIELD_MAP = [
	['sfs', 'sfs'],
	['sfsw', 'sfsw'],
	['sks', 'sks'],
	['lss', 'lss'],
	['vss', 'vss']
];

const TRI_FIELDS = [
	'alt',
	'altsfs',
	'redirect',
	'redirectsfs',
	'redirectweak',
	'redirectsfsweak',
	'roll',
	'inroll2',
	'outroll2',
	'inroll3',
	'outroll3'
];

/**
 * @typedef {{
 *   dumpId: string,
 *   compact: number[],
 *   extended: Record<string, unknown>
 * }} CminibrowserMana2LayoutStats
 */

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {number} value
 */
export function encodeCminibrowserMana2StatValue(value) {
	return Math.round(value * CMINIBROWSER_MANA2_STAT_VALUE_SCALE);
}

/**
 * @param {string} corpus
 * @param {string} board
 * @param {string} space
 */
export function cminibrowserMana2NamedDumpPath(corpus, board, space) {
	return `mana2/named/${corpus}.${board}.${space}.json`;
}

/**
 * Preserve the dump entry for show-page detail payloads.
 * @param {unknown} entry
 * @returns {Record<string, unknown> | null}
 */
export function extractCminibrowserMana2Extended(entry) {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
	const raw = /** @type {Record<string, unknown>} */ (entry);
	for (const key of ['hb', 'big', 'skip', 'tri', 'trin', 'fu']) {
		if (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key])) return null;
	}
	/** @type {Record<string, unknown>} */
	const extended = {
		hb: raw.hb,
		big: raw.big,
		skip: raw.skip,
		tri: raw.tri,
		trin: raw.trin,
		fu: raw.fu
	};
	if (raw.fsp && typeof raw.fsp === 'object' && !Array.isArray(raw.fsp)) extended.fsp = raw.fsp;
	if (raw.fspw && typeof raw.fspw === 'object' && !Array.isArray(raw.fspw))
		extended.fspw = raw.fspw;
	return extended;
}

/**
 * Convert one layout's named dump object to a compact Mana2 array, or null if unusable.
 *
 * Dump fields not present in Emulayout's compact schema (`offpinky`, `goodroll*`) encode as 0.
 *
 * @param {unknown} entry
 * @returns {number[] | null}
 */
export function encodeCminibrowserMana2Stats(entry) {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
	const raw = /** @type {Record<string, unknown>} */ (entry);
	const big = raw.big;
	const skip = raw.skip;
	const tri = raw.tri;
	const trin = raw.trin;
	const fu = raw.fu;
	if (
		!big ||
		typeof big !== 'object' ||
		Array.isArray(big) ||
		!skip ||
		typeof skip !== 'object' ||
		Array.isArray(skip) ||
		!tri ||
		typeof tri !== 'object' ||
		Array.isArray(tri) ||
		!trin ||
		typeof trin !== 'object' ||
		Array.isArray(trin) ||
		!fu ||
		typeof fu !== 'object' ||
		Array.isArray(fu)
	) {
		return null;
	}

	/** @type {Record<string, number>} */
	const byKey = {
		offpinky: 0,
		goodroll: 0,
		goodrollnothumbs: 0
	};

	for (const finger of FINGER_USAGE_ORDER) {
		const value = /** @type {Record<string, unknown>} */ (fu)[finger];
		if (!isFiniteNumber(value)) return null;
		byKey[`finger-usage-${finger}`] = value;
	}

	for (const [dumpKey, botKey] of BIG_FIELD_MAP) {
		const value = /** @type {Record<string, unknown>} */ (big)[dumpKey];
		if (!isFiniteNumber(value)) return null;
		byKey[botKey] = value;
	}
	for (const [dumpKey, botKey] of SKIP_FIELD_MAP) {
		const value = /** @type {Record<string, unknown>} */ (skip)[dumpKey];
		if (!isFiniteNumber(value)) return null;
		byKey[botKey] = value;
	}
	for (const field of TRI_FIELDS) {
		const triValue = /** @type {Record<string, unknown>} */ (tri)[field];
		const trinValue = /** @type {Record<string, unknown>} */ (trin)[field];
		if (!isFiniteNumber(triValue) || !isFiniteNumber(trinValue)) return null;
		byKey[field] = triValue;
		byKey[`${field}nothumbs`] = trinValue;
	}

	// Require a positive alternation signal so empty stubs are dropped.
	if (!(byKey.alt > 0)) return null;

	return CMINIBROWSER_MANA2_STAT_KEYS.map((key) =>
		encodeCminibrowserMana2StatValue(byKey[key] ?? 0)
	);
}

/**
 * @param {unknown} dump
 * @returns {Map<string, CminibrowserMana2LayoutStats>} lowercase dump id → stats
 */
export function indexCminibrowserMana2Dump(dump) {
	/** @type {Map<string, CminibrowserMana2LayoutStats>} */
	const index = new Map();
	if (!dump || typeof dump !== 'object' || Array.isArray(dump)) return index;

	for (const [dumpId, entry] of Object.entries(dump)) {
		const compact = encodeCminibrowserMana2Stats(entry);
		const extended = extractCminibrowserMana2Extended(entry);
		if (!compact || !extended) continue;
		index.set(dumpId.toLowerCase(), { dumpId, compact, extended });
	}
	return index;
}

/**
 * @param {Map<string, CminibrowserMana2LayoutStats>} index
 * @param {string} layoutName
 */
export function lookupCminibrowserMana2Stats(index, layoutName) {
	return index.get(layoutName.toLowerCase()) ?? null;
}
