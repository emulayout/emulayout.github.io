#!/usr/bin/env bun

/**
 * Compare cminibrowser cmini stats dumps to the published corpus artifact.
 * Optional diagnostic only — not required in CI.
 *
 * Usage:
 *   bun run ./bin/verify-cminibrowser-cmini-stats.js
 *   bun run ./bin/verify-cminibrowser-cmini-stats.js --offline
 *   bun run ./bin/verify-cminibrowser-cmini-stats.js --corpus=reddit
 *   bun run ./bin/verify-cminibrowser-cmini-stats.js --corpus=monkeyracer
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readCminibrowserJson } from './cminibrowser-cache.js';
import {
	CMINIBROWSER_CMINI_DEFAULT_CORPUS,
	CMINIBROWSER_CMINI_STAT_KEYS,
	CMINIBROWSER_CMINI_STAT_VALUE_SCALE,
	encodeCminibrowserCminiDump
} from './cminibrowser-cmini-stats.js';
import { cminiCompactStatsRelPath } from './stats-artifact-paths.js';
const MAX_REPORTED = Number(process.env.CMINIBROWSER_VERIFY_MAX_REPORTED ?? 15);

/** Absolute fixed-point delta (1 = 0.0001 in fraction space) treated as equal. */
const ABS_TOLERANCE = Number(process.env.CMINIBROWSER_VERIFY_ABS_TOLERANCE ?? 1);

/**
 * Keys that are known to drift more between our analyzer and the dump.
 * Reported separately so scalar parity stays visible.
 */
const FINGER_KEYS = new Set(['LI', 'LM', 'LR', 'LP', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT', 'TB']);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	let corpus = CMINIBROWSER_CMINI_DEFAULT_CORPUS;
	let offline = false;
	let force = false;
	for (const arg of argv) {
		if (arg === '--offline') offline = true;
		else if (arg === '--force') force = true;
		else if (arg.startsWith('--corpus=')) corpus = arg.slice('--corpus='.length);
	}
	return { corpus, offline, force };
}

/**
 * @param {number[]} a
 * @param {number[]} b
 */
function diffCompact(a, b) {
	/** @type {Array<{ key: string, local: number, dump: number, delta: number }>} */
	const diffs = [];
	for (let i = 0; i < CMINIBROWSER_CMINI_STAT_KEYS.length; i++) {
		const local = a[i] ?? 0;
		const dump = b[i] ?? 0;
		const delta = local - dump;
		if (Math.abs(delta) > ABS_TOLERANCE) {
			diffs.push({ key: CMINIBROWSER_CMINI_STAT_KEYS[i], local, dump, delta });
		}
	}
	return diffs;
}

/**
 * @param {Array<{ key: string, local: number, dump: number, delta: number }>} diffs
 */
function splitFingerDiffs(diffs) {
	return {
		scalar: diffs.filter((d) => !FINGER_KEYS.has(d.key)),
		finger: diffs.filter((d) => FINGER_KEYS.has(d.key))
	};
}

async function run() {
	const { corpus, offline, force } = parseArgs(process.argv.slice(2));
	const dumpPath = `stats/${corpus}.json`;
	const localStatsFile = join(process.cwd(), cminiCompactStatsRelPath(corpus));

	console.log(`→ Loading local ${localStatsFile}`);
	/** @type {Record<string, number[]>} */
	const localStats = JSON.parse(await readFile(localStatsFile, 'utf-8'));

	console.log(`→ Loading cminibrowser ${dumpPath}`);
	const dump = await readCminibrowserJson(dumpPath, { offline, force });
	const dumpEncoded = encodeCminibrowserCminiDump(dump);

	/** @type {Map<string, string>} lowercase dump id → original dump id */
	const dumpByLower = new Map();
	for (const id of dumpEncoded.keys()) {
		dumpByLower.set(id.toLowerCase(), id);
	}

	/** @type {Array<{ localName: string, dumpId: string }>} */
	const paired = [];
	/** @type {string[]} */
	const onlyLocal = [];
	for (const localName of Object.keys(localStats).sort((a, b) => a.localeCompare(b))) {
		const dumpId = dumpByLower.get(localName.toLowerCase());
		if (dumpId) paired.push({ localName, dumpId });
		else onlyLocal.push(localName);
	}
	const pairedDumpIds = new Set(paired.map((p) => p.dumpId));
	const onlyDump = [...dumpEncoded.keys()].filter((id) => !pairedDumpIds.has(id));

	let exact = 0;
	let scalarExact = 0;
	let scalarNear = 0; // all scalar |Δ| ≤ 5 (typical rounding band)
	let compared = 0;
	let caseMismatchPairs = 0;
	/** @type {Array<{ name: string, scalar: ReturnType<typeof diffCompact>, finger: ReturnType<typeof diffCompact> }>} */
	const mismatches = [];

	/** @type {Record<string, { count: number, absSum: number, absMax: number }>} */
	const perKey = Object.fromEntries(
		CMINIBROWSER_CMINI_STAT_KEYS.map((key) => [key, { count: 0, absSum: 0, absMax: 0 }])
	);

	for (const { localName, dumpId } of paired) {
		const local = localStats[localName];
		const remote = dumpEncoded.get(dumpId);
		if (!Array.isArray(local) || !remote) continue;
		if (local.length !== CMINIBROWSER_CMINI_STAT_KEYS.length) continue;
		compared++;
		if (localName !== dumpId) caseMismatchPairs++;

		const diffs = diffCompact(local, remote);
		if (diffs.length === 0) {
			exact++;
			scalarExact++;
			scalarNear++;
			continue;
		}

		const { scalar, finger } = splitFingerDiffs(diffs);
		if (scalar.length === 0) {
			scalarExact++;
			scalarNear++;
		} else if (scalar.every((d) => Math.abs(d.delta) <= 5)) {
			scalarNear++;
		}
		mismatches.push({ name: localName, scalar, finger });

		for (const diff of diffs) {
			const stats = perKey[diff.key];
			const abs = Math.abs(diff.delta);
			stats.count++;
			stats.absSum += abs;
			stats.absMax = Math.max(stats.absMax, abs);
		}
	}

	console.log('');
	console.log(`Corpus: ${corpus}`);
	console.log(`  Local layouts:     ${Object.keys(localStats).length}`);
	console.log(`  Dump layouts:      ${dumpEncoded.size}`);
	console.log(`  Shared compared:   ${compared} (case-insensitive join)`);
	console.log(`  Id case differs:   ${caseMismatchPairs}`);
	console.log(`  Exact match:       ${exact} (${pct(exact, compared)})`);
	console.log(`  Scalar-exact:      ${scalarExact} (${pct(scalarExact, compared)})`);
	console.log(`  Scalar within ±5:  ${scalarNear} (${pct(scalarNear, compared)})`);
	console.log(`  Only local:        ${onlyLocal.length}`);
	console.log(`  Only dump:         ${onlyDump.length}`);
	console.log(
		`  Tolerance:         ±${ABS_TOLERANCE} fixed-point (1/${CMINIBROWSER_CMINI_STAT_VALUE_SCALE})`
	);

	const noisyKeys = Object.entries(perKey)
		.filter(([, s]) => s.count > 0)
		.sort((a, b) => b[1].absMax - a[1].absMax || b[1].count - a[1].count);

	if (noisyKeys.length > 0) {
		console.log('\nPer-key drift (fixed-point units):');
		for (const [key, s] of noisyKeys.slice(0, 20)) {
			const mean = s.absSum / s.count;
			console.log(
				`  ${key.padEnd(14)} layouts=${String(s.count).padStart(5)}  mean|Δ|=${mean.toFixed(1).padStart(7)}  max|Δ|=${s.absMax}`
			);
		}
	}

	const scalarMismatches = mismatches.filter((m) => m.scalar.length > 0);
	if (scalarMismatches.length > 0) {
		console.log(`\nScalar mismatches (showing up to ${MAX_REPORTED}):`);
		for (const row of scalarMismatches.slice(0, MAX_REPORTED)) {
			const summary = row.scalar
				.map((d) => `${d.key}:${fmt(d.local)}→${fmt(d.dump)} (Δ${d.delta})`)
				.join(', ');
			console.log(`  ${row.name}: ${summary}`);
		}
		if (scalarMismatches.length > MAX_REPORTED) {
			console.log(`  … ${scalarMismatches.length - MAX_REPORTED} more`);
		}
	}

	if (onlyLocal.length > 0) {
		console.log(
			`\nOnly local (up to ${MAX_REPORTED}): ${onlyLocal.slice(0, MAX_REPORTED).join(', ')}`
		);
	}
	if (onlyDump.length > 0) {
		console.log(
			`\nOnly dump (up to ${MAX_REPORTED}): ${onlyDump.slice(0, MAX_REPORTED).join(', ')}`
		);
	}

	// Informational spike: always exit 0 unless dump failed to load usable rows.
	if (compared === 0) {
		console.error('\n❌ No overlapping layouts to compare');
		process.exit(1);
	}
	console.log('\nDone (informational; does not fail on drift)');
}

/**
 * @param {number} n
 * @param {number} d
 */
function pct(n, d) {
	if (d === 0) return '0%';
	return `${((100 * n) / d).toFixed(1)}%`;
}

/**
 * @param {number} fixed
 */
function fmt(fixed) {
	return (fixed / CMINIBROWSER_CMINI_STAT_VALUE_SCALE).toFixed(4);
}

run().catch((err) => {
	console.error('❌ Verify failed:', err);
	process.exit(1);
});
