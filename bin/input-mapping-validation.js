import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { variantLayoutKeys } from '../src/lib/layoutSupplemental.ts';
import { isExcludedLayout } from './cminibrowser-meme-filter.js';

/**
 * Validate curated supplemental data against the matching Cmini layouts.
 *
 * Mappings are keyed on characters rather than positions, so a key moving does
 * not break them. The one failure that matters is a referenced key the layout
 * no longer has. Pull-request validation treats that as fatal so broken data
 * cannot merge; production sync sets `allowStaleVariants` instead, marking the
 * variant stale so an existing mapping survives an upstream layout change.
 *
 * @param {{
 *   layoutsDir: string;
 *   layoutFiles: readonly string[];
 *   excludedLayouts: ReadonlySet<string>;
 *   supplementalByLayout: ReadonlyMap<string, import('../src/lib/layoutSupplemental.ts').LayoutSupplemental>;
 *   allowOrphanedProfiles?: boolean;
 *   allowStaleVariants?: boolean;
 * }} options
 */
export async function validateSupplementalDataForLayouts({
	layoutsDir,
	layoutFiles,
	excludedLayouts,
	supplementalByLayout,
	allowOrphanedProfiles = false,
	allowStaleVariants = false
}) {
	const layoutFileSet = new Set(layoutFiles);
	/** @type {string[]} */
	const orphanedProfiles = [];
	/** @type {{ layoutName: string, variantId: string, missingKeys: string[] }[]} */
	const staleVariants = [];
	let variantCount = 0;

	for (const [layoutName, supplemental] of supplementalByLayout) {
		const filename = `${layoutName}.json`;
		if (!layoutFileSet.has(filename)) {
			if (!allowOrphanedProfiles) {
				throw new Error(`Supplemental data ${layoutName} has no matching Cmini layout file`);
			}
			orphanedProfiles.push(layoutName);
			continue;
		}
		if (isExcludedLayout(layoutName, excludedLayouts)) {
			throw new Error(`Supplemental data ${layoutName} belongs to a meme-filtered layout`);
		}

		let rawLayout;
		try {
			rawLayout = JSON.parse(await readFile(join(layoutsDir, filename), 'utf-8'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Could not read Cmini layout ${filename}: ${message}`, { cause: error });
		}

		if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
			throw new Error(`Supplemental data ${layoutName} has no matching layout object`);
		}
		if (rawLayout.name !== layoutName) {
			throw new Error(
				`Supplemental data ${layoutName} matched layout named ${JSON.stringify(rawLayout.name)}`
			);
		}
		if (!rawLayout.keys || typeof rawLayout.keys !== 'object' || Array.isArray(rawLayout.keys)) {
			throw new Error(`Supplemental layout ${layoutName} has an invalid key map`);
		}

		for (const variant of supplemental.variants) {
			variantCount += 1;
			const missingKeys = variantLayoutKeys(variant).filter((key) => !(key in rawLayout.keys));
			if (missingKeys.length === 0) continue;
			const described = missingKeys.map((key) => JSON.stringify(key)).join(', ');
			if (!allowStaleVariants) {
				throw new Error(
					`Supplemental data ${layoutName} variant ${JSON.stringify(variant.id)} uses ${described}, which is not on the layout`
				);
			}
			staleVariants.push({ layoutName, variantId: variant.id, missingKeys });
		}
	}

	return {
		layoutCount: supplementalByLayout.size,
		variantCount,
		orphanedProfiles,
		staleVariants
	};
}
