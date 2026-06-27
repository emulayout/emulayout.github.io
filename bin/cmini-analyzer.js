/**
 * Port of cmini util/analyzer.py and cmds/fingers.py (usage metric).
 * Keep in sync with Apsu/cmini when those functions change.
 */

/** @typedef {Record<string, { finger?: string }>} FingerKeys */

/** @type {readonly ['LI', 'LM', 'LR', 'LP', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT', 'TB']} */
export const FINGERS = ['LI', 'LM', 'LR', 'LP', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT', 'TB'];

export const LEFT_HAND = ['LI', 'LM', 'LR', 'LP'];
export const RIGHT_HAND = ['RI', 'RM', 'RR', 'RP'];

/**
 * Same-finger bigram rate (bot display SFB).
 * @param {FingerKeys} keys
 * @param {Record<string, number>} bigrams
 */
export function sfbBigram(keys, bigrams) {
	const validKeys = new Set(Object.keys(keys));
	const fingerByKey = /** @type {Record<string, string>} */ ({});
	for (const [key, info] of Object.entries(keys)) {
		if (info?.finger) fingerByKey[key] = info.finger;
	}
	if (Object.keys(fingerByKey).length === 0) return null;

	let total = 0;
	for (const count of Object.values(bigrams)) total += count;
	if (total === 0) return null;

	let sfbCount = 0;
	for (const [gram, count] of Object.entries(bigrams)) {
		const g = gram.toLowerCase();
		if (g.length < 2) continue;
		if ([...g].some((ch) => !validKeys.has(ch))) continue;
		if (g.includes(' ') || g[0] === g[1]) continue;

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
 */
export function handUse(keys, monograms) {
	/** @type {Record<string, number>} */
	const fingers = {};

	for (const [gram, count] of Object.entries(monograms)) {
		const g = gram.toLowerCase();
		const info = keys[g];
		if (!info?.finger) continue;
		fingers[info.finger] = (fingers[info.finger] ?? 0) + count;
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
 * @returns {Record<(typeof FINGERS)[number], number> | null}
 */
export function fingerUsage(keys, trigrams) {
	/** @type {Record<string, number>} */
	const usage = Object.fromEntries(FINGERS.map((finger) => [finger, 0]));
	let total = 0;

	for (const [trigram, freq] of Object.entries(trigrams)) {
		if (trigram.includes(' ')) continue;

		const fingerList = [];
		for (const ch of trigram.toLowerCase()) {
			const info = keys[ch];
			if (!info?.finger) continue;
			let finger = info.finger;
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
