import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cminibrowserCachePath, ensureCminibrowserDump } from '../bin/cminibrowser-cache.js';

const originalFetch = globalThis.fetch;
const testPaths: string[] = [];

function mockFetch(response: Response): typeof fetch {
	return Object.assign(async () => response, { preconnect: () => undefined });
}

afterEach(async () => {
	globalThis.fetch = originalFetch;
	await Promise.all(testPaths.splice(0).map((path) => rm(path, { force: true })));
});

describe('ensureCminibrowserDump', () => {
	test('does not replace a good cache when a downloaded dump fails validation', async () => {
		const dataPath = `tests/${crypto.randomUUID()}.json`;
		const cachePath = cminibrowserCachePath(dataPath);
		const metaPath = `${cachePath}.meta.json`;
		testPaths.push(cachePath, metaPath);
		await mkdir(dirname(cachePath), { recursive: true });
		await writeFile(cachePath, '{"layouts":{"existing":true}}\n');

		globalThis.fetch = mockFetch(
			new Response('{"layouts":{}}\n', {
				status: 200,
				headers: { etag: 'partial-dump' }
			})
		);

		await expect(
			ensureCminibrowserDump(dataPath, {
				force: true,
				validateJson: () => {
					throw new Error('coverage check failed');
				}
			})
		).rejects.toThrow('coverage check failed');

		expect(await readFile(cachePath, 'utf-8')).toBe('{"layouts":{"existing":true}}\n');
	});

	test('does not replace a good cache with malformed JSON', async () => {
		const dataPath = `tests/${crypto.randomUUID()}.json`;
		const cachePath = cminibrowserCachePath(dataPath);
		const metaPath = `${cachePath}.meta.json`;
		testPaths.push(cachePath, metaPath);
		await mkdir(dirname(cachePath), { recursive: true });
		await writeFile(cachePath, '{"layouts":{"existing":true}}\n');

		globalThis.fetch = mockFetch(new Response('{"layouts":', { status: 200 }));

		await expect(ensureCminibrowserDump(dataPath, { force: true })).rejects.toThrow(
			'Invalid JSON in cminibrowser dump'
		);
		expect(await readFile(cachePath, 'utf-8')).toBe('{"layouts":{"existing":true}}\n');
	});
});
