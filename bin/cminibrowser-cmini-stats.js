/**
 * Map one cmini cell from akl.gg stats/v1 into Emulayout's compact arrays
 * (`BOT_STAT_KEYS` / `STAT_VALUE_SCALE`).
 *
 * Key order and scale must stay aligned with `src/lib/statsDerivation.ts`.
 */

/** Default corpus for published cmini catalog stats. */
export const CMINIBROWSER_CMINI_DEFAULT_CORPUS = 'monkeyracer';

/** Fixed-point scale for compact stat arrays (4 decimal places). */
export const CMINIBROWSER_CMINI_STAT_VALUE_SCALE = 10_000;

/**
 * Finger-use field order in an AKL cmini cell.
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
	['red', 'redirect'],
	['bad_redirect', 'bad-redirect'],
	['sfs_red', 'dsfb-red'],
	['sfs_alt', 'dsfb-alt'],
	['sfb', 'sfb'],
	['lh', 'lh'],
	['rh', 'rh']
];

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
	// stats/v1 publishes cmini percentages as percentage points. Emulayout's
	// cmini decoder expects normalized 0–1 fractions.
	return Math.round((value / 100) * CMINIBROWSER_CMINI_STAT_VALUE_SCALE);
}

/**
 * Convert one layout's stats/v1 cmini cell to a compact array, or null if unusable.
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
