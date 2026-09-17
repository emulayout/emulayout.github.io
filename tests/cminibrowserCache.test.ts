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
	test('reuses a good cache when a downloaded dump fails validation', async () => {
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

		const result = await ensureCminibrowserDump(dataPath, {
			force: true,
			validateJson: (value) => {
				if (!(value as { layouts?: { existing?: boolean } }).layouts?.existing) {
					throw new Error('coverage check failed');
				}
			}
		});

		expect(result.updated).toBe(false);
		expect(result.json).toEqual({ layouts: { existing: true } });
		expect(await readFile(cachePath, 'utf-8')).toBe('{"layouts":{"existing":true}}\n');
	});

	test('reuses a good cache when the downloaded response is not JSON', async () => {
		const dataPath = `tests/${crypto.randomUUID()}.json`;
		const cachePath = cminibrowserCachePath(dataPath);
		const metaPath = `${cachePath}.meta.json`;
		testPaths.push(cachePath, metaPath);
		await mkdir(dirname(cachePath), { recursive: true });
		await writeFile(cachePath, '{"layouts":{"existing":true}}\n');

		globalThis.fetch = mockFetch(new Response('{"layouts":', { status: 200 }));

		const result = await ensureCminibrowserDump(dataPath, { force: true });

		expect(result.updated).toBe(false);
		expect(result.json).toEqual({ layouts: { existing: true } });
		expect(await readFile(cachePath, 'utf-8')).toBe('{"layouts":{"existing":true}}\n');
	});

	test('still fails when the endpoint is unavailable and there is no cache', async () => {
		const dataPath = `tests/${crypto.randomUUID()}.json`;
		const cachePath = cminibrowserCachePath(dataPath);
		const metaPath = `${cachePath}.meta.json`;
		testPaths.push(cachePath, metaPath);

		globalThis.fetch = mockFetch(new Response('<!doctype html>', { status: 200 }));

		await expect(ensureCminibrowserDump(dataPath, { force: true })).rejects.toThrow(
			'Invalid JSON in AKL dump'
		);
	});
});
