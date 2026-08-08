#!/usr/bin/env bun

/**
 * Interactive sync for catalog + analyzer static data.
 *
 *   bun run sync
 *
 * Non-interactive flags (skip the TUI):
 *   --catalog --cmini-stats --mana2-stats --cyanophage --details
 *   --all                     all of the above
 *   --force                   re-download cminibrowser dumps (stats tasks)
 *   --offline                 reuse caches; no network (catalog + dump stats)
 *   --yes / -y                accept defaults without prompting
 *
 * Corpus selection belongs to the individual dump-import scripts. This wrapper
 * always syncs every configured corpus so generated detail payloads stay complete.
 */

import * as p from '@clack/prompts';
import { $ } from 'bun';

/** @typedef {'catalog' | 'cmini-stats' | 'mana2-stats' | 'cyanophage' | 'details'} SyncTarget */
/** @typedef {'normal' | 'force' | 'offline'} SyncMode */

const ALL_TARGETS = /** @type {const} */ ([
	'catalog',
	'cmini-stats',
	'mana2-stats',
	'cyanophage',
	'details'
]);

const TARGET_OPTIONS = /** @type {const} */ ([
	{
		value: 'catalog',
		label: 'Catalog',
		hint: 'cmini repo → all-layouts, supplemental, likes, authors'
	},
	{
		value: 'cmini-stats',
		label: 'cmini stats',
		hint: 'cminibrowser dumps → layout-stats-cmini-{corpus}'
	},
	{
		value: 'mana2-stats',
		label: 'Mana2 stats',
		hint: 'cminibrowser dumps → layout-stats-mana2-{corpus}-*'
	},
	{
		value: 'cyanophage',
		label: 'Cyanophage stats',
		hint: 'local compute → layout-stats-cyanophage.json'
	},
	{
		value: 'details',
		label: 'Layout details',
		hint: 'show-page detail payloads'
	}
]);

const MODE_OPTIONS = /** @type {const} */ ([
	{
		value: 'normal',
		label: 'Normal',
		hint: 'fetch catalog updates; reuse cached dumps when present'
	},
	{
		value: 'force',
		label: 'Force',
		hint: 're-download cminibrowser dumps (stats tasks)'
	},
	{
		value: 'offline',
		label: 'Offline',
		hint: 'reuse cmini-repo + dump caches; no network'
	}
]);

/** Targets that accept --force / --offline dump flags. */
const DUMP_TARGETS = new Set(/** @type {SyncTarget[]} */ (['cmini-stats', 'mana2-stats']));
/** Targets that accept --offline for the cmini git cache. */
const CATALOG_TARGETS = new Set(/** @type {SyncTarget[]} */ (['catalog']));
const SYNC_OPTIONS = new Set([
	'--catalog',
	'--cmini-stats',
	'--cmini',
	'--mana2-stats',
	'--mana2',
	'--cyanophage',
	'--details',
	'--all',
	'--force',
	'--offline',
	'--yes',
	'-y'
]);

/**
 * @param {string[]} argv
 */
export function parseSyncArgs(argv) {
	const unsupported = argv.filter((arg) => !SYNC_OPTIONS.has(arg));
	if (unsupported.length > 0) {
		const suffix = unsupported.some((arg) => arg.startsWith('--corpus'))
			? ' Use --corpus=NAME with the individual cmini-stats-sync or mana2-stats-sync script.'
			: '';
		throw new Error(`Unsupported sync option: ${unsupported.join(', ')}.${suffix}`);
	}

	const force = argv.includes('--force');
	const offline = argv.includes('--offline');
	const yes = argv.includes('--yes') || argv.includes('-y');
	/** @type {SyncTarget[]} */
	const targets = [];
	if (argv.includes('--catalog')) targets.push('catalog');
	if (argv.includes('--cmini-stats') || argv.includes('--cmini')) targets.push('cmini-stats');
	if (argv.includes('--mana2-stats') || argv.includes('--mana2')) targets.push('mana2-stats');
	if (argv.includes('--cyanophage')) targets.push('cyanophage');
	if (argv.includes('--details')) targets.push('details');
	if (argv.includes('--all')) targets.push(...ALL_TARGETS);

	if (force && offline) {
		throw new Error('Cannot combine --force and --offline');
	}

	/** @type {SyncMode | null} */
	let mode = null;
	if (force) mode = 'force';
	else if (offline) mode = 'offline';
	else if (targets.length > 0 || yes) mode = 'normal';

	return {
		targets: [...new Set(targets)],
		mode,
		yes,
		interactive: targets.length === 0 && !yes && mode === null
	};
}

/**
 * @param {SyncTarget[]} targets
 */
function needsModePrompt(targets) {
	return targets.some((t) => DUMP_TARGETS.has(t) || CATALOG_TARGETS.has(t));
}

/**
 * @returns {Promise<{ targets: SyncTarget[], mode: SyncMode }>}
 */
async function promptPlan() {
	p.intro('Emulayout sync');

	const targets = await p.multiselect({
		message: 'What would you like to sync?',
		options: [...TARGET_OPTIONS],
		initialValues: [...ALL_TARGETS],
		required: true
	});
	if (p.isCancel(targets)) {
		p.cancel('Sync cancelled.');
		process.exit(0);
	}

	/** @type {SyncTarget[]} */
	const selected = /** @type {SyncTarget[]} */ ([...targets]);
	/** @type {SyncMode} */
	let mode = 'normal';

	if (needsModePrompt(selected)) {
		const chosen = await p.select({
			message: 'Refresh mode',
			options: [...MODE_OPTIONS],
			initialValue: 'normal'
		});
		if (p.isCancel(chosen)) {
			p.cancel('Sync cancelled.');
			process.exit(0);
		}
		mode = /** @type {SyncMode} */ (chosen);
	}

	return { targets: selected, mode };
}

/**
 * @param {SyncMode} mode
 * @param {SyncTarget} target
 */
function flagsForTarget(mode, target) {
	if (mode === 'offline' && (DUMP_TARGETS.has(target) || CATALOG_TARGETS.has(target))) {
		return ['--offline'];
	}
	if (mode === 'force' && DUMP_TARGETS.has(target)) {
		return ['--force'];
	}
	return [];
}

/**
 * @param {string} script
 * @param {string[]} flags
 */
async function runScript(script, flags) {
	if (flags.length > 0) await $`bun ${script} ${flags}`;
	else await $`bun ${script}`;
}

/**
 * @param {SyncTarget[]} targets
 * @param {SyncMode} mode
 */
async function runPlan(targets, mode) {
	p.log.step(`Running: ${targets.join(', ')} (${mode})`);

	if (targets.includes('catalog')) {
		await runScript('./bin/catalog-sync.js', flagsForTarget(mode, 'catalog'));
	}
	if (targets.includes('cmini-stats')) {
		await runScript('./bin/cmini-stats-sync.js', flagsForTarget(mode, 'cmini-stats'));
	}
	if (targets.includes('mana2-stats')) {
		await runScript('./bin/mana2-stats-sync.js', flagsForTarget(mode, 'mana2-stats'));
	}
	if (targets.includes('cyanophage')) {
		await runScript('./bin/cyanophage-stats-sync.js', []);
	}
	if (targets.includes('details')) {
		await runScript('./bin/layout-details.js', []);
	}

	p.outro('Sync complete');
}

async function run() {
	const parsed = parseSyncArgs(process.argv.slice(2));

	/** @type {SyncTarget[]} */
	let targets = parsed.targets;
	/** @type {SyncMode} */
	let mode = parsed.mode ?? 'normal';

	if (parsed.interactive) {
		if (!process.stdin.isTTY) {
			throw new Error(
				'Interactive sync requires a TTY. Pass targets (--catalog/--cmini-stats/--mana2-stats/--cyanophage/--details/--all) and optionally --force or --offline.'
			);
		}
		const plan = await promptPlan();
		targets = plan.targets;
		mode = plan.mode;
	} else {
		if (targets.length === 0) targets = [...ALL_TARGETS];
		console.log(`→ sync (${targets.join(', ')}; ${mode})`);
	}

	await runPlan(targets, mode);
}

if (import.meta.main) {
	run().catch((err) => {
		console.error('❌ sync failed:', err);
		process.exit(1);
	});
}
