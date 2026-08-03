/**
 * Adapt Emulayout Magic / Repeat profiles to Cyanophage's corpus-rewrite model
 * (`keyboard_svg_magic.js` `modWord`).
 *
 * Cyanophage rewrites high-frequency expansions onto the Magic / Repeat key
 * before scoring. It does not model Emulayout fallbacks, multi-character
 * preceding sequences, or multiple Magic triggers.
 */

import { hasMagicKey, hasRepeatKey } from './layout-features.js';

/**
 * @typedef {{
 *   magicKey?: string,
 *   magicTable: Readonly<Record<string, string>>,
 *   repeatKey?: string,
 *   rewrite: (word: string) => string
 * }} CyanophageContextualRewrite
 */

/** @param {unknown} value */
function runeLength(value) {
	return typeof value === 'string' ? [...value].length : 0;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} value
 * @param {string} key
 */
function hasOwn(value, key) {
	return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Extract Cyanophage-compatible single-letter Magic rules from one trigger.
 * Multi-character contexts and empty outputs are skipped. Fallbacks are ignored.
 *
 * @param {unknown} rawRules
 * @returns {Record<string, string> | null}
 */
function extractSingleLetterMagicTable(rawRules) {
	if (!isRecord(rawRules)) return null;

	let rawRuleMap = rawRules;
	if (hasOwn(rawRules, 'rules') || hasOwn(rawRules, 'fallback')) {
		if (!isRecord(rawRules.rules)) return null;
		rawRuleMap = rawRules.rules;
	}

	/** @type {Record<string, string>} */
	const magicTable = {};
	for (const [after, emit] of Object.entries(rawRuleMap)) {
		if (runeLength(after) !== 1) continue;
		if (typeof emit !== 'string' || emit.length === 0) continue;
		magicTable[after.toLowerCase()] = emit;
	}

	return Object.keys(magicTable).length > 0 ? magicTable : null;
}

/** Letters Cyanophage's Magic page rewrites for Repeat (`keyboard_svg_magic.js`). */
const CYANOPHAGE_REPEAT_LETTERS = 'abcdefghiklmnoprstuxz';

/**
 * Apply Cyanophage `modWord` Magic + Repeat rewrites.
 *
 * @param {string} word
 * @param {{
 *   magicKey?: string,
 *   magicTable?: Readonly<Record<string, string>>,
 *   repeatKey?: string
 * }} options
 */
export function rewriteCyanophageWord(word, options) {
	let modded = word;

	const repeatKey = options.repeatKey;
	if (repeatKey) {
		for (const letter of CYANOPHAGE_REPEAT_LETTERS) {
			modded = modded.replaceAll(letter + letter, letter + repeatKey);
		}
	}

	const magicKey = options.magicKey;
	const magicTable = options.magicTable;
	if (magicKey && magicTable) {
		for (const [letter, replaceString] of Object.entries(magicTable)) {
			if (!replaceString) continue;
			const needle = letter + replaceString;
			if (modded.includes(needle)) {
				modded = modded.replaceAll(needle, letter + magicKey);
			}
		}
	}

	return modded;
}

/**
 * Prepare corpus rewriting for Cyanophage measurement.
 *
 * @param {unknown} rawMappings
 * @param {Record<string, unknown>} layoutKeys
 * @returns {CyanophageContextualRewrite | null}
 */
export function prepareCyanophageContextualRewrite(rawMappings, layoutKeys) {
	if (!layoutKeys || typeof layoutKeys !== 'object') return null;

	/** @type {string | undefined} */
	let magicKey;
	/** @type {Record<string, string>} */
	let magicTable = {};

	if (isRecord(rawMappings)) {
		const triggers = Object.entries(rawMappings);
		if (triggers.length === 1) {
			const [trigger, rawRules] = triggers[0];
			if (runeLength(trigger) === 1 && trigger in layoutKeys) {
				const table = extractSingleLetterMagicTable(rawRules);
				if (table) {
					magicKey = trigger;
					magicTable = table;
				}
			}
		}
	}

	const repeatEnabled = hasRepeatKey(layoutKeys, rawMappings);
	const repeatKey = repeatEnabled ? '@' : undefined;

	if (!magicKey && !repeatKey) return null;

	/** @type {CyanophageContextualRewrite} */
	const prepared = {
		magicTable: magicKey ? magicTable : {},
		rewrite: (word) =>
			rewriteCyanophageWord(word, {
				magicKey,
				magicTable: magicKey ? magicTable : undefined,
				repeatKey
			})
	};
	if (magicKey) prepared.magicKey = magicKey;
	if (repeatKey) prepared.repeatKey = repeatKey;
	return prepared;
}

/**
 * Whether Cyanophage cannot measure this layout's Magic behavior without a
 * different default mapping profile. This follows the same default-profile
 * support boundary as stats generation rather than catalog-wide availability.
 *
 * @param {unknown} rawMappings
 * @param {Record<string, unknown>} layoutKeys
 */
export function cyanophageStatsNeedMagicMappings(rawMappings, layoutKeys) {
	if (!hasMagicKey(layoutKeys, rawMappings)) return false;
	return !prepareCyanophageContextualRewrite(rawMappings, layoutKeys)?.magicKey;
}
