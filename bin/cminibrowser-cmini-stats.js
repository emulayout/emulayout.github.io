/**
 * Map cminibrowser cmini engine dumps (`/data/stats/{corpus}.json`) into Emulayout's
 * compact monkeyracer arrays (`BOT_STAT_KEYS` / `STAT_VALUE_SCALE`).
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
 *   dumpId: string,
 *   compact: number[]
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
		if (!compact) continue;
		index.set(dumpId.toLowerCase(), { dumpId, compact });
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
