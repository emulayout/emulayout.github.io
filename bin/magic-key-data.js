import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateMagicKeyMappings } from '../src/lib/magicKeys.ts';
import { hasMagicKey } from './layout-features.js';

const MAGIC_KEYS_DIR = join(process.cwd(), 'data', 'magic-keys');

/**
 * Load the curated per-layout magic-key profiles. Filenames are Cmini layout
 * names, so adding data/magic-keys/<layout>.json is enough for the next sync
 * to mark the layout and publish its mappings.
 *
 * @returns {Promise<Map<string, unknown>>}
 */
export async function loadMagicKeyMappings() {
	/** @type {Map<string, unknown>} */
	const mappings = new Map();
	/** @type {string[]} */
	let filenames;
	try {
		filenames = (await readdir(MAGIC_KEYS_DIR))
			.filter((filename) => filename.endsWith('.json'))
			.sort((a, b) => a.localeCompare(b));
	} catch (error) {
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			/** @type {{ code?: unknown }} */ (error).code === 'ENOENT'
		) {
			return mappings;
		}
		throw error;
	}

	for (const filename of filenames) {
		const layoutName = filename.replace(/\.json$/i, '');
		const path = join(MAGIC_KEYS_DIR, filename);
		try {
			const parsed = JSON.parse(await readFile(path, 'utf-8'));
			mappings.set(layoutName, validateMagicKeyMappings(parsed));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Invalid magic-key profile ${path}: ${message}`, { cause: error });
		}
	}

	return mappings;
}

/**
 * Ensure a curated profile actually belongs to the named Cmini layout and
 * references magic-key triggers present in its key map.
 *
 * @param {string} profileName
 * @param {unknown} mappings
 * @param {unknown} rawLayout
 */
export function validateMagicKeyMappingsForLayout(profileName, mappings, rawLayout) {
	if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
		throw new Error(`Magic-key profile ${profileName} has no matching layout object`);
	}

	const layout = /** @type {{ name?: unknown, keys?: unknown }} */ (rawLayout);
	if (layout.name !== profileName) {
		throw new Error(
			`Magic-key profile ${profileName} matched layout named ${JSON.stringify(layout.name)}`
		);
	}
	if (!hasMagicKey(layout.keys)) {
		throw new Error(`Magic-key profile ${profileName} matched a layout with no magic key`);
	}
	if (!layout.keys || typeof layout.keys !== 'object' || Array.isArray(layout.keys)) {
		throw new Error(`Magic-key layout ${profileName} has an invalid key map`);
	}

	const normalizedMappings = validateMagicKeyMappings(mappings);
	for (const trigger of Object.keys(normalizedMappings)) {
		if (!(trigger in layout.keys)) {
			throw new Error(
				`Magic-key profile ${profileName} uses trigger ${JSON.stringify(trigger)} that is not on the layout`
			);
		}
	}
}
