import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateInputMappingsForLayouts } from '../bin/input-mapping-validation.js';

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

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
	);
});

describe('input mapping file validation', () => {
	test('accepts structurally valid profiles whose keys exist on their layouts', async () => {
		const layoutsDir = await createLayouts({
			magic: { name: 'magic', keys: { '*': {}, a: {}, o: {} } },
			'odd-symbol': { name: 'odd-symbol', keys: { '#': {}, a: {}, o: {} } },
			adaptive: { name: 'adaptive', keys: { l: {}, y: {}, j: {} } }
		});

		await expect(
			validateInputMappingsForLayouts({
				layoutsDir,
				layoutFiles: ['magic.json', 'odd-symbol.json', 'adaptive.json'],
				blacklist: new Set(),
				magicKeyMappings: new Map([
					['magic', { '*': { a: 'o' } }],
					['odd-symbol', { '#': { a: 'o' } }]
				]),
				adaptiveSwapSources: new Map([['adaptive', { mappings: { l: { y: 'j' } } }]])
			})
		).resolves.toEqual({
			magicKeyProfileCount: 2,
			adaptiveSwapProfileCount: 1,
			orphanedProfiles: []
		});
	});

	test('rejects a profile without a matching Cmini layout file', async () => {
		const layoutsDir = await createLayouts({});

		await expect(
			validateInputMappingsForLayouts({
				layoutsDir,
				layoutFiles: [],
				blacklist: new Set(),
				magicKeyMappings: new Map([['missing', { '*': { a: 'o' } }]]),
				adaptiveSwapSources: new Map()
			})
		).rejects.toThrow('Magic-key profile missing has no matching Cmini layout file');
	});

	test('can report and skip orphan profiles during production sync', async () => {
		const layoutsDir = await createLayouts({});

		await expect(
			validateInputMappingsForLayouts({
				layoutsDir,
				layoutFiles: [],
				blacklist: new Set(),
				magicKeyMappings: new Map([['missing-magic', { '*': { a: 'o' } }]]),
				adaptiveSwapSources: new Map([['missing-adaptive', { mappings: { l: { y: 'j' } } }]]),
				allowOrphanedProfiles: true
			})
		).resolves.toEqual({
			magicKeyProfileCount: 1,
			adaptiveSwapProfileCount: 1,
			orphanedProfiles: [
				'Magic-key profile missing-magic',
				'Adaptive-swap profile missing-adaptive'
			]
		});
	});

	test('rejects mappings that reference keys absent from their layout', async () => {
		const layoutsDir = await createLayouts({
			adaptive: { name: 'adaptive', keys: { l: {}, y: {} } }
		});

		await expect(
			validateInputMappingsForLayouts({
				layoutsDir,
				layoutFiles: ['adaptive.json'],
				blacklist: new Set(),
				magicKeyMappings: new Map(),
				adaptiveSwapSources: new Map([['adaptive', { mappings: { l: { y: 'j' } } }]])
			})
		).rejects.toThrow('uses "j", which is not on the layout');
	});
});
