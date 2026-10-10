import { expect, test } from 'bun:test';
import { buildCyanophageStats, loadCyanophageData } from '../bin/cyanophage-stats.js';
import {
	createCyanophageStatsWorker,
	CyanophageStatsWorkerError
} from '../bin/cyanophage-stats-workers.js';

test('worker scoring matches local ordinary, Magic, Repeat, and unsupported results', async () => {
	const worker = createCyanophageStatsWorker();
	const data = await loadCyanophageData();
	const keys = Object.fromEntries(
		['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'].flatMap((row, r) =>
			Array.from(row, (char, col) => [char, { row: r, col }])
		)
	);
	try {
		for (const geometry of ['column-stagger', 'row-stagger'] as const) {
			for (const profile of [
				{ keys },
				{ keys: { ...keys, '@': { row: 1, col: 10 } } },
				{
					keys: { ...keys, '*': { row: 1, col: 10 } },
					magicMappings: { '*': { rules: { s: 'c', r: 'l' } } }
				},
				{ keys: {} }
			]) {
				const input = { ...profile, geometry };
				expect(await worker.compute(input)).toEqual(
					buildCyanophageStats(input, data, { magicMappings: profile.magicMappings })
				);
			}
		}
		await expect(
			worker.compute({ keys, geometry: 'row-stagger', magicMappings: () => {} })
		).rejects.toBeInstanceOf(CyanophageStatsWorkerError);
		expect(await worker.compute({ keys: {}, geometry: 'row-stagger' })).toBeNull();
	} finally {
		await worker.close();
	}
	await expect(worker.compute({ keys, geometry: 'row-stagger' })).rejects.toThrow('closed');
});
