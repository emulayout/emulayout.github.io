import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Port of cmini util/analyzer.py and cmds/fingers.py (usage metric).
 * Keep in sync with Apsu/cmini when those functions change.
 */

const BIN_DIR = dirname(fileURLToPath(import.meta.url));
export const TABLE_PATH = join(BIN_DIR, 'cmini-data', 'table.json');

/** @type {Promise<Record<string, string>> | null} */
let tablePromise = null;

/** @type {string[] | null} */
let tableCountKeys = null;

async function loadFingerComboTable() {
	if (!tablePromise) {
		tablePromise = readFile(TABLE_PATH, 'utf-8').then((text) => {
			const table = JSON.parse(text);
			tableCountKeys = [...new Set([...Object.values(table), 'sfR', 'unknown'])];
			return table;
		});
	}
	return tablePromise;
}

/** @typedef {Record<string, { finger?: string }>} FingerKeys */

/**
 * @typedef {Object} FingerIndex
 * @property {Record<string, string>} fingerByKey
 * @property {Set<string>} validKeys
 */

/** @type {readonly ['LI', 'LM', 'LR', 'LP', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT', 'TB']} */
export const FINGERS = ['LI', 'LM', 'LR', 'LP', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT', 'TB'];

export const LEFT_HAND = ['LI', 'LM', 'LR', 'LP'];
export const RIGHT_HAND = ['RI', 'RM', 'RR', 'RP'];

/**
 * Shared finger lookup for SFB / hands / usage / trigrams.
 * @param {FingerKeys} keys
 * @returns {FingerIndex}
 */
export function buildFingerIndex(keys) {
	/** @type {Record<string, string>} */
	const fingerByKey = {};
	const validKeys = new Set();
	for (const [key, info] of Object.entries(keys)) {
		validKeys.add(key);
		if (info?.finger) fingerByKey[key] = info.finger;
	}
	return { fingerByKey, validKeys };
}

/**
 * @param {Record<string, string>} table
 */
function emptyTrigramCounts(table) {
	const keys = tableCountKeys ?? [...new Set([...Object.values(table), 'sfR', 'unknown'])];
	return Object.fromEntries(keys.map((key) => [key, 0]));
}

/**
 * Same-finger bigram rate (bot display SFB).
 * @param {FingerKeys} keys
 * @param {Record<string, number>} bigrams
 * @param {FingerIndex} [index]
 */
export function sfbBigram(keys, bigrams, index = buildFingerIndex(keys)) {
	const { fingerByKey, validKeys } = index;
	if (Object.keys(fingerByKey).length === 0) return null;

	let total = 0;
	for (const count of Object.values(bigrams)) total += count;
	if (total === 0) return null;

	let sfbCount = 0;
	for (const [gram, count] of Object.entries(bigrams)) {
		const g = gram.toLowerCase();
		if (g.length < 2) continue;
		if (g.includes(' ') || g[0] === g[1]) continue;

		let allValid = true;
		for (let i = 0; i < g.length; i++) {
			if (!validKeys.has(g[i])) {
				allValid = false;
				break;
			}
		}
		if (!allValid) continue;

		const f0 = fingerByKey[g[0]];
		const f1 = fingerByKey[g[1]];
		if (!f0 || !f1) continue;
		if (f0 === f1) sfbCount += count;
	}

	return sfbCount / total;
}

/**
 * Left/right hand typing share (bot LH/RH line).
 * @param {FingerKeys} keys
 * @param {Record<string, number>} monograms
 * @param {FingerIndex} [index]
 */
export function handUse(keys, monograms, index = buildFingerIndex(keys)) {
	const { fingerByKey } = index;
	/** @type {Record<string, number>} */
	const fingers = {};

	for (const [gram, count] of Object.entries(monograms)) {
		const finger = fingerByKey[gram.toLowerCase()];
		if (!finger) continue;
		fingers[finger] = (fingers[finger] ?? 0) + count;
	}

	const total = Object.values(fingers).reduce((sum, n) => sum + n, 0);
	if (total === 0) return null;

	let lh = 0;
	let rh = 0;
	for (const [finger, count] of Object.entries(fingers)) {
		const share = count / total;
		if (finger[0] === 'L') lh += share;
		else if (finger[0] === 'R' || finger[0] === 'T') rh += share;
	}

	return { lh, rh };
}

/**
 * Per-finger usage (cmini `fingers [layout] usage`).
 * @param {FingerKeys} keys
 * @param {Record<string, number>} trigrams
 * @param {FingerIndex} [index]
 * @returns {Record<(typeof FINGERS)[number], number> | null}
 */
export function fingerUsage(keys, trigrams, index = buildFingerIndex(keys)) {
	const { fingerByKey } = index;
	/** @type {Record<string, number>} */
	const usage = Object.fromEntries(FINGERS.map((finger) => [finger, 0]));
	let total = 0;

	for (const [trigram, freq] of Object.entries(trigrams)) {
		if (trigram.includes(' ')) continue;

		const fingerList = [];
		const g = trigram.toLowerCase();
		for (let i = 0; i < g.length; i++) {
			let finger = fingerByKey[g[i]];
			if (!finger) continue;
			if (finger === 'TB') finger = 'RT';
			if (usage[finger] === undefined) continue;
			fingerList.push(finger);
		}

		if (fingerList.length === 0) continue;

		const share = freq / fingerList.length;
		for (const finger of fingerList) {
			usage[finger] += share;
		}
		total += freq;
	}

	if (total === 0) return null;

	for (const finger of FINGERS) {
		usage[finger] /= total;
	}

	return /** @type {Record<(typeof FINGERS)[number], number>} */ (usage);
}

/**
 * Trigram distribution (cmini `trigrams()` / monkeyracer cache stats).
 * @param {FingerKeys} keys
 * @param {Record<string, number>} grams
 * @param {Record<string, string>} table
 * @param {FingerIndex} [index]
 * @returns {Record<string, number>}
 */
export function trigramStats(keys, grams, table, index = buildFingerIndex(keys)) {
	/** @type {Record<string, number>} */
	const counts = emptyTrigramCounts(table);
	const { fingerByKey } = index;

	for (const [gram, count] of Object.entries(grams)) {
		const g = gram.toLowerCase();
		if (g.includes(' ')) continue;
		if (g.length < 3) continue;

		if (g[0] === g[1] || g[1] === g[2] || g[0] === g[2]) {
			counts.sfR += count;
			continue;
		}

		let fingerCombo = '';
		for (let i = 0; i < g.length; i++) {
			const finger = fingerByKey[g[i]];
			if (!finger) continue;
			if (fingerCombo) fingerCombo += '-';
			fingerCombo += finger === 'TB' ? 'RT' : finger;
		}
		const gramType = table[fingerCombo] ?? 'unknown';
		counts[gramType] += count;
	}

	const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
	if (total === 0) return counts;

	for (const key of Object.keys(counts)) {
		counts[key] /= total;
	}

	return counts;
}

/**
 * @param {FingerKeys} keys
 * @param {Record<string, number>} grams
 * @param {FingerIndex} [index]
 */
export async function computeTrigramStats(keys, grams, index) {
	const table = await loadFingerComboTable();
	return trigramStats(keys, grams, table, index);
}
