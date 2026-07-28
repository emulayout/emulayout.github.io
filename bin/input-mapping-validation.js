import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateMagicKeyMappingsForLayout } from './magic-key-data.js';
import { validateAdaptiveSwapSourceForLayout } from './adaptive-swap-data.js';

/**
 * Validate all curated mapping profiles against the matching Cmini layouts.
 *
 * @param {{
 *   layoutsDir: string;
 *   layoutFiles: readonly string[];
 *   blacklist: ReadonlySet<string>;
 *   magicKeyMappings: ReadonlyMap<string, unknown>;
 *   adaptiveSwapSources: ReadonlyMap<string, unknown>;
 *   allowOrphanedProfiles?: boolean;
 * }} options
 */
export async function validateInputMappingsForLayouts({
	layoutsDir,
	layoutFiles,
	blacklist,
	magicKeyMappings,
	adaptiveSwapSources,
	allowOrphanedProfiles = false
}) {
	const layoutFileSet = new Set(layoutFiles);
	/** @type {string[]} */
	const orphanedProfiles = [];

	/**
	 * @param {string} profileName
	 * @param {string} featureLabel
	 */
	async function loadProfileLayout(profileName, featureLabel) {
		const filename = `${profileName}.json`;
		if (!layoutFileSet.has(filename)) {
			if (allowOrphanedProfiles) {
				orphanedProfiles.push(`${featureLabel} ${profileName}`);
				return undefined;
			}
			throw new Error(`${featureLabel} ${profileName} has no matching Cmini layout file`);
		}
		if (blacklist.has(profileName) || blacklist.has(filename)) {
			throw new Error(`${featureLabel} ${profileName} belongs to a blacklisted layout`);
		}
		try {
			return JSON.parse(await readFile(join(layoutsDir, filename), 'utf-8'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Could not read Cmini layout ${filename}: ${message}`, { cause: error });
		}
	}

	for (const [profileName, mappings] of magicKeyMappings) {
		const rawLayout = await loadProfileLayout(profileName, 'Magic-key profile');
		if (!rawLayout) continue;
		validateMagicKeyMappingsForLayout(profileName, mappings, rawLayout);
	}

	for (const [profileName, source] of adaptiveSwapSources) {
		const rawLayout = await loadProfileLayout(profileName, 'Adaptive-swap profile');
		if (!rawLayout) continue;
		validateAdaptiveSwapSourceForLayout(profileName, source, rawLayout);
	}

	return {
		magicKeyProfileCount: magicKeyMappings.size,
		adaptiveSwapProfileCount: adaptiveSwapSources.size,
		orphanedProfiles
	};
}
