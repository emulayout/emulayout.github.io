import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileAdaptiveSwapSource, validateAdaptiveSwapSource } from '../src/lib/adaptiveSwaps.ts';

const ADAPTIVE_SWAPS_DIR = join(process.cwd(), 'data', 'adaptive-swaps');

/** @returns {Promise<Map<string, unknown>>} */
export async function loadAdaptiveSwapSources() {
	/** @type {Map<string, unknown>} */
	const sources = new Map();
	/** @type {string[]} */
	let filenames;
	try {
		filenames = (await readdir(ADAPTIVE_SWAPS_DIR))
			.filter((filename) => filename.endsWith('.json'))
			.sort((a, b) => a.localeCompare(b));
	} catch (error) {
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			/** @type {{ code?: unknown }} */ (error).code === 'ENOENT'
		) {
			return sources;
		}
		throw error;
	}

	for (const filename of filenames) {
		const layoutName = filename.replace(/\.json$/i, '');
		const path = join(ADAPTIVE_SWAPS_DIR, filename);
		try {
			sources.set(
				layoutName,
				validateAdaptiveSwapSource(JSON.parse(await readFile(path, 'utf-8')))
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Invalid adaptive-swap profile ${path}: ${message}`, { cause: error });
		}
	}
	return sources;
}

/**
 * @param {string} profileName
 * @param {unknown} source
 * @param {unknown} rawLayout
 */
export function validateAdaptiveSwapSourceForLayout(profileName, source, rawLayout) {
	if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
		throw new Error(`Adaptive-swap profile ${profileName} has no matching layout object`);
	}
	const layout = /** @type {{ name?: unknown, keys?: unknown }} */ (rawLayout);
	if (layout.name !== profileName) {
		throw new Error(
			`Adaptive-swap profile ${profileName} matched layout named ${JSON.stringify(layout.name)}`
		);
	}
	if (!layout.keys || typeof layout.keys !== 'object' || Array.isArray(layout.keys)) {
		throw new Error(`Adaptive-swap layout ${profileName} has an invalid key map`);
	}

	const profile = compileAdaptiveSwapSource(source);
	for (const rule of [...profile.rules, ...profile.groups.flatMap((group) => group.rules)]) {
		for (const key of [rule.trigger, rule.left, rule.right]) {
			if (!(key in layout.keys)) {
				throw new Error(
					`Adaptive-swap profile ${profileName} uses ${JSON.stringify(key)}, which is not on the layout`
				);
			}
		}
	}
}
