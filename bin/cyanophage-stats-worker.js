import { parentPort } from 'node:worker_threads';
import { buildCyanophageStats, loadCyanophageData } from './cyanophage-stats.js';

const data = loadCyanophageData();
parentPort?.on('message', async (input) => {
	try {
		const stats = buildCyanophageStats(input, await data, { magicMappings: input.magicMappings });
		parentPort?.postMessage({ stats });
	} catch (error) {
		parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
	}
});
