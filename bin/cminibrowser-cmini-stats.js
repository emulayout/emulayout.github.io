/**
 * Map cminibrowser cmini engine dumps (`/data/stats/{corpus}.json`) into Emulayout's
 * compact monkeyracer arrays (`BOT_STAT_KEYS` / `STAT_VALUE_SCALE`). Validated extended
 * fields are retained in the in-memory index for diagnostics.
 *
 * Key order and scale must stay aligned with `src/lib/statsDerivation.ts`.
 */

/** Default corpus for published cmini catalog stats. */
export const CMINIBROWSER_CMINI_DEFAULT_CORPUS = 'monkeyracer';

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const CMINIBROWSER_CMINI_STAT_VALUE_SCALE = 10_000;

/**
 * Finger-use field order in the cminibrowser cmini dump.
 * @type {readonly ['LI', 'LM', 'LR', 'LP', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT', 'TB']}
 */
export const CMINIBROWSER_CMINI_FINGER_KEYS = [
	'LI',
	'LM',
	'LR',
	'LP',
	'RI',
	'RM',
	'RR',
	'RP',
	'LT',
	'RT',
	'TB'
];

/**
 * Compact field order — keep in sync with BOT_STAT_KEYS in statsDerivation.ts.
 * @type {readonly string[]}
 */
export const CMINIBROWSER_CMINI_STAT_KEYS = [
	'alternate',
	'roll-in',
	'roll-out',
	'oneh-in',
	'oneh-out',
	'redirect',
	'bad-redirect',
	'dsfb-red',
	'dsfb-alt',
	'sfb',
	'lh',
	'rh',
	...CMINIBROWSER_CMINI_FINGER_KEYS
];

/** Dump scalar field → Emulayout BOT_STAT_KEYS entry. */
export const CMINIBROWSER_CMINI_SCALAR_FIELDS = [
	['alt', 'alternate'],
	['roll_in', 'roll-in'],
	['roll_out', 'roll-out'],
	['oneh_in', 'oneh-in'],
	['oneh_out', 'oneh-out'],
	['redirect', 'redirect'],
	['bad_redirect', 'bad-redirect'],
	['sfs_red', 'dsfb-red'],
	['sfs_alt', 'dsfb-alt'],
	['sfb', 'sfb'],
	['lh', 'lh'],
	['rh', 'rh']
];

/**
 * @typedef {{
 *   use?: number,
 *   fsp?: number,
 *   wfsp?: number,
 *   sfb?: number,
 *   sfs?: number
 * }} CminibrowserCminiFingerStats
 */

/**
 * Additional validated dump fields retained for diagnostics.
 * @typedef {{
 *   roll_in: number,
 *   roll_out: number,
 *   alt: number,
 *   redirect: number,
 *   bad_redirect: number,
 *   oneh_in: number,
 *   oneh_out: number,
 *   sfr?: number,
 *   sfs?: number,
 *   sfs_alt: number,
 *   sfs_red: number,
 *   sfb: number,
 *   lh: number,
 *   rh: number,
 *   pinky?: number,
 *   fspeed?: number,
 *   fspeed_weighted?: number,
 *   fspeed_ortho?: number,
 *   fspeed_rowstag?: number,
 *   fspeed_weighted_ortho?: number,
 *   fspeed_weighted_rowstag?: number,
 *   redirect_thumb?: number,
 *   bad_redirect_thumb?: number,
 *   fingers?: Record<string, CminibrowserCminiFingerStats>,
 *   fingers_ortho?: Record<string, CminibrowserCminiFingerStats>,
 *   fingers_rowstag?: Record<string, CminibrowserCminiFingerStats>
 * }} CminibrowserCminiExtendedStats
 */

/**
 * @typedef {{
 *   dumpId: string,
 *   compact: number[],
 *   extended: CminibrowserCminiExtendedStats
 * }} CminibrowserCminiLayoutStats
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
export function encodeCminibrowserStatValue(value) {
	return Math.round(value * CMINIBROWSER_CMINI_STAT_VALUE_SCALE);
}

/**
 * @param {unknown} value
 * @returns {CminibrowserCminiFingerStats | null}
 */
function normalizeFingerStats(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const raw = /** @type {Record<string, unknown>} */ (value);
	/** @type {CminibrowserCminiFingerStats} */
	const out = {};
	for (const key of /** @type {const} */ (['use', 'fsp', 'wfsp', 'sfb', 'sfs'])) {
		const metric = raw[key];
		if (isFiniteNumber(metric)) out[key] = metric;
	}
	return Object.keys(out).length > 0 ? out : null;
}

/**
 * @param {unknown} value
 * @returns {Record<string, CminibrowserCminiFingerStats> | undefined}
 */
function normalizeFingerMap(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	/** @type {Record<string, CminibrowserCminiFingerStats>} */
	const out = {};
	for (const [finger, entry] of Object.entries(value)) {
		const normalized = normalizeFingerStats(entry);
		if (normalized) out[finger] = normalized;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Extract additional validated dump fields for diagnostics.
 * @param {unknown} entry
 * @returns {CminibrowserCminiExtendedStats | null}
 */
export function extractCminibrowserCminiExtended(entry) {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
	const raw = /** @type {Record<string, unknown>} */ (entry);

	/** @type {CminibrowserCminiExtendedStats} */
	const extended = {
		roll_in: 0,
		roll_out: 0,
		alt: 0,
		redirect: 0,
		bad_redirect: 0,
		oneh_in: 0,
		oneh_out: 0,
		sfs_alt: 0,
		sfs_red: 0,
		sfb: 0,
		lh: 0,
		rh: 0
	};

	for (const key of /** @type {const} */ ([
		'roll_in',
		'roll_out',
		'alt',
		'redirect',
		'bad_redirect',
		'oneh_in',
		'oneh_out',
		'sfs_alt',
		'sfs_red',
		'sfb',
		'lh',
		'rh'
	])) {
		const value = raw[key];
		if (!isFiniteNumber(value)) return null;
		extended[key] = value;
	}

	for (const key of /** @type {const} */ ([
		'sfr',
		'sfs',
		'pinky',
		'fspeed',
		'fspeed_weighted',
		'fspeed_ortho',
		'fspeed_rowstag',
		'fspeed_weighted_ortho',
		'fspeed_weighted_rowstag',
		'redirect_thumb',
		'bad_redirect_thumb'
	])) {
		const value = raw[key];
		if (isFiniteNumber(value)) extended[key] = value;
	}

	const fingers = normalizeFingerMap(raw.fingers);
	if (fingers) extended.fingers = fingers;
	const fingersOrtho = normalizeFingerMap(raw.fingers_ortho);
	if (fingersOrtho) extended.fingers_ortho = fingersOrtho;
	const fingersRowstag = normalizeFingerMap(raw.fingers_rowstag);
	if (fingersRowstag) extended.fingers_rowstag = fingersRowstag;

	return extended;
}

/**
 * Convert one layout's dump object to a compact stats array, or null if unusable.
 *
 * @param {unknown} entry
 * @returns {number[] | null}
 */
export function encodeCminibrowserCminiStats(entry) {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

	/** @type {Record<string, number>} */
	const byKey = {};
	for (const [dumpKey, botKey] of CMINIBROWSER_CMINI_SCALAR_FIELDS) {
		const value = /** @type {Record<string, unknown>} */ (entry)[dumpKey];
		if (!isFiniteNumber(value)) return null;
		byKey[botKey] = value;
	}

	// Alternation must be present and positive — same validity gate as local sync.
	if (!(byKey.alternate > 0)) return null;

	const fingers = /** @type {Record<string, unknown>} */ (entry).fingers;
	const fingerUses =
		fingers && typeof fingers === 'object' && !Array.isArray(fingers)
			? /** @type {Record<string, unknown>} */ (fingers)
			: {};

	for (const finger of CMINIBROWSER_CMINI_FINGER_KEYS) {
		const fingerEntry = fingerUses[finger];
		if (fingerEntry && typeof fingerEntry === 'object' && !Array.isArray(fingerEntry)) {
			const use = /** @type {Record<string, unknown>} */ (fingerEntry).use;
			byKey[finger] = isFiniteNumber(use) ? use : 0;
		} else {
			byKey[finger] = 0;
		}
	}

	return CMINIBROWSER_CMINI_STAT_KEYS.map((key) => encodeCminibrowserStatValue(byKey[key] ?? 0));
}

/**
 * Index a dump for case-insensitive layout lookup.
 * @param {unknown} dump
 * @returns {Map<string, CminibrowserCminiLayoutStats>} lowercase dump id → stats
 */
export function indexCminibrowserCminiDump(dump) {
	/** @type {Map<string, CminibrowserCminiLayoutStats>} */
	const index = new Map();
	if (!dump || typeof dump !== 'object' || Array.isArray(dump)) return index;

	for (const [dumpId, entry] of Object.entries(dump)) {
		const compact = encodeCminibrowserCminiStats(entry);
		const extended = extractCminibrowserCminiExtended(entry);
		if (!compact || !extended) continue;
		index.set(dumpId.toLowerCase(), { dumpId, compact, extended });
	}
	return index;
}

/**
 * @param {Map<string, CminibrowserCminiLayoutStats>} index
 * @param {string} layoutName cmini / Emulayout display name
 * @returns {CminibrowserCminiLayoutStats | null}
 */
export function lookupCminibrowserCminiStats(index, layoutName) {
	return index.get(layoutName.toLowerCase()) ?? null;
}

/**
 * @param {unknown} dump top-level `{ [layoutId]: entry }`
 * @returns {Map<string, number[]>}
 */
export function encodeCminibrowserCminiDump(dump) {
	/** @type {Map<string, number[]>} */
	const encoded = new Map();
	for (const [lowerId, stats] of indexCminibrowserCminiDump(dump)) {
		// Prefer original dump id casing as the map key for verify scripts.
		encoded.set(stats.dumpId || lowerId, stats.compact);
	}
	return encoded;
}
