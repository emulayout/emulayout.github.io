import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSupplementalDataForLayouts } from '../bin/input-mapping-validation.js';
import { validateLayoutSupplemental } from '$lib/layoutSupplemental';

const temporaryDirectories: string[] = [];

async function createLayouts(layouts: Record<string, unknown>) {
	const directory = await mkdtemp(join(tmpdir(), 'emulayout-mapping-validation-'));
	temporaryDirectories.push(directory);
	await Promise.all(
		Object.entries(layouts).map(([name, layout]) =>
			writeFile(join(directory, `${name}.json`), JSON.stringify(layout))
		)
	);
	return directory;
}

function supplementalMap(files: Record<string, unknown>) {
	return new Map(
		Object.entries(files).map(([name, file]) => [name, validateLayoutSupplemental(file)])
	);
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
	);
});

describe('supplemental data validation', () => {
	test('accepts variants whose keys exist on their layouts', async () => {
		const layoutsDir = await createLayouts({
			magic: { name: 'magic', keys: { '*': {}, a: {}, o: {} } },
			'odd-symbol': { name: 'odd-symbol', keys: { '#': {}, a: {}, o: {} } },
			adaptive: { name: 'adaptive', keys: { l: {}, y: {}, j: {} } }
		});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: ['magic.json', 'odd-symbol.json', 'adaptive.json'],
				blacklist: new Set(),
				supplementalByLayout: supplementalMap({
					magic: { schema: 1, magicKeys: { mappings: { '*': { a: 'o' } } } },
					'odd-symbol': { schema: 1, magicKeys: { mappings: { '#': { a: 'o' } } } },
					adaptive: { schema: 1, adaptiveSwaps: { mappings: { l: { y: 'j' } } } }
				})
			})
		).resolves.toEqual({
			layoutCount: 3,
			variantCount: 3,
			orphanedProfiles: [],
			staleVariants: []
		});
	});

	test('counts every variant of a layout that offers alternatives', async () => {
		const layoutsDir = await createLayouts({
			magic: { name: 'magic', keys: { '*': {}, a: {}, o: {} } }
		});

		const result = await validateSupplementalDataForLayouts({
			layoutsDir,
			layoutFiles: ['magic.json'],
			blacklist: new Set(),
			supplementalByLayout: supplementalMap({
				magic: {
					schema: 1,
					variants: [
						{ id: 'v2', label: 'Revised', magicKeys: { mappings: { '*': { a: 'o' } } } },
						{ id: 'v1', label: 'Original', magicKeys: { mappings: { '*': { a: 'e' } } } }
					]
				}
			})
		});

		expect(result).toMatchObject({ layoutCount: 1, variantCount: 2, staleVariants: [] });
	});

	test('rejects supplemental data without a matching Cmini layout file', async () => {
		const layoutsDir = await createLayouts({});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: [],
				blacklist: new Set(),
				supplementalByLayout: supplementalMap({
					missing: { schema: 1, magicKeys: { mappings: { '*': { a: 'o' } } } }
				})
			})
		).rejects.toThrow('Supplemental data missing has no matching Cmini layout file');
	});

	test('rejects data whose filename does not match the layout it points at', async () => {
		const layoutsDir = await createLayouts({
			magic: { name: 'renamed', keys: { '*': {}, a: {}, o: {} } }
		});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: ['magic.json'],
				blacklist: new Set(),
				supplementalByLayout: supplementalMap({
					magic: { schema: 1, magicKeys: { mappings: { '*': { a: 'o' } } } }
				})
			})
		).rejects.toThrow('matched layout named "renamed"');
	});

	test('can report and skip orphans during production sync', async () => {
		const layoutsDir = await createLayouts({});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: [],
				blacklist: new Set(),
				supplementalByLayout: supplementalMap({
					'missing-magic': { schema: 1, magicKeys: { mappings: { '*': { a: 'o' } } } },
					'missing-adaptive': { schema: 1, adaptiveSwaps: { mappings: { l: { y: 'j' } } } }
				}),
				allowOrphanedProfiles: true
			})
		).resolves.toEqual({
			layoutCount: 2,
			variantCount: 0,
			orphanedProfiles: ['missing-magic', 'missing-adaptive'],
			staleVariants: []
		});
	});

	test('rejects a magic trigger the layout does not have', async () => {
		const layoutsDir = await createLayouts({
			magic: { name: 'magic', keys: { '*': {}, a: {}, o: {} } }
		});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: ['magic.json'],
				blacklist: new Set(),
				supplementalByLayout: supplementalMap({
					magic: { schema: 1, magicKeys: { mappings: { '@': { a: 'o' } } } }
				})
			})
		).rejects.toThrow('uses "@", which is not on the layout');
	});

	test('rejects adaptive swaps that reference keys absent from their layout', async () => {
		const layoutsDir = await createLayouts({
			adaptive: { name: 'adaptive', keys: { l: {}, y: {} } }
		});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: ['adaptive.json'],
				blacklist: new Set(),
				supplementalByLayout: supplementalMap({
					adaptive: { schema: 1, adaptiveSwaps: { mappings: { l: { y: 'j' } } } }
				})
			})
		).rejects.toThrow('uses "j", which is not on the layout');
	});

	test('marks a variant stale instead of failing when sync allows it', async () => {
		const layoutsDir = await createLayouts({
			adaptive: { name: 'adaptive', keys: { l: {}, y: {} } }
		});

		const result = await validateSupplementalDataForLayouts({
			layoutsDir,
			layoutFiles: ['adaptive.json'],
			blacklist: new Set(),
			supplementalByLayout: supplementalMap({
				adaptive: { schema: 1, adaptiveSwaps: { mappings: { l: { y: 'j' } } } }
			}),
			allowStaleVariants: true
		});

		expect(result.staleVariants).toEqual([
			{ layoutName: 'adaptive', variantId: 'default', missingKeys: ['j'] }
		]);
	});

	test('rejects supplemental data for a blacklisted layout', async () => {
		const layoutsDir = await createLayouts({
			magic: { name: 'magic', keys: { '*': {}, a: {}, o: {} } }
		});

		await expect(
			validateSupplementalDataForLayouts({
				layoutsDir,
				layoutFiles: ['magic.json'],
				blacklist: new Set(['magic']),
				supplementalByLayout: supplementalMap({
					magic: { schema: 1, magicKeys: { mappings: { '*': { a: 'o' } } } }
				})
			})
		).rejects.toThrow('belongs to a blacklisted layout');
	});
});
