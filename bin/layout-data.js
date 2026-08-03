import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileAdaptiveSwapSource } from '../src/lib/adaptiveSwaps.ts';
import { compileMagicKeyMappings } from '../src/lib/magicKeys.ts';
import { validateLayoutSupplemental } from '../src/lib/layoutSupplemental.ts';

const LAYOUT_DATA_DIR = join(process.cwd(), 'data', 'layouts');

/**
 * Surface structural problems the shape validator cannot see, such as an
 * adaptive trigger that assigns one key to two swaps.
 *
 * @param {import('../src/lib/layoutSupplemental.ts').LayoutSupplemental} supplemental
 */
function assertVariantsCompile(supplemental) {
	for (const variant of supplemental.variants) {
		try {
			if (variant.magicKeys) compileMagicKeyMappings(variant.magicKeys.mappings);
			if (variant.adaptiveSwaps) compileAdaptiveSwapSource(variant.adaptiveSwaps);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Variant ${JSON.stringify(variant.id)}: ${message}`, { cause: error });
		}
	}
}

/**
 * Load curated supplemental data. Filenames are Cmini layout names, so adding
 * data/layouts/<layout>.json is enough for the next sync to publish it.
 *
 * @returns {Promise<Map<string, import('../src/lib/layoutSupplemental.ts').LayoutSupplemental>>}
 */
export async function loadLayoutSupplementalData() {
	/** @type {Map<string, import('../src/lib/layoutSupplemental.ts').LayoutSupplemental>} */
	const supplemental = new Map();
	/** @type {string[]} */
	let filenames;
	try {
		filenames = (await readdir(LAYOUT_DATA_DIR))
			.filter((filename) => filename.endsWith('.json'))
			.sort((a, b) => a.localeCompare(b));
	} catch (error) {
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			/** @type {{ code?: unknown }} */ (error).code === 'ENOENT'
		) {
			return supplemental;
		}
		throw error;
	}

	for (const filename of filenames) {
		const layoutName = filename.replace(/\.json$/i, '');
		const path = join(LAYOUT_DATA_DIR, filename);
		try {
			const parsed = validateLayoutSupplemental(JSON.parse(await readFile(path, 'utf-8')));
			assertVariantsCompile(parsed);
			supplemental.set(layoutName, parsed);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Invalid supplemental layout data ${path}: ${message}`, { cause: error });
		}
	}

	return supplemental;
}
