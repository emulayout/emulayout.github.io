import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

export const CYANOPHAGE_WORKER_COUNT = Math.min(4, availableParallelism());
export class CyanophageStatsWorkerError extends Error {}

/** One sequential scoring lane. Create its thread only when a cache miss needs computation. */
export function createCyanophageStatsWorker() {
	/** @type {Worker | undefined} */
	let worker;
	/** @type {Error | undefined} */
	let failure;
	let closed = false;
	return {
		/**
		 * The caller must await each request before sending the next one on this lane.
		 * @param {{ geometry: 'column-stagger' | 'row-stagger', keys: Record<string, { row: number, col: number, finger?: string }>, magicMappings?: unknown }} input
		 * @returns {Promise<number[] | null>}
		 */
		async compute(input) {
			if (closed) throw new Error('Cyanophage worker is closed');
			if (failure) throw new CyanophageStatsWorkerError(failure.message);
			if (!worker) {
				worker = new Worker(new URL('./cyanophage-stats-worker.js', import.meta.url));
				worker.once('error', (error) => {
					failure = error instanceof Error ? error : new Error(String(error));
				});
				worker.once('exit', (code) => {
					failure = new Error(`Cyanophage worker exited (${code})`);
				});
			}
			const active = worker;
			return new Promise((resolve, reject) => {
				function cleanup() {
					active.off('message', onMessage);
					active.off('error', onError);
					active.off('exit', onExit);
				}
				/** @param {{ stats: number[] | null, error?: string }} result */
				function onMessage(result) {
					cleanup();
					if (result.error) reject(new CyanophageStatsWorkerError(result.error));
					else resolve(result.stats);
				}
				/** @param {Error} error */
				function onError(error) {
					cleanup();
					reject(new CyanophageStatsWorkerError(String(error)));
				}
				/** @param {number} code */
				function onExit(code) {
					onError(new Error(`Cyanophage worker exited (${code})`));
				}
				active.once('message', onMessage);
				active.once('error', onError);
				active.once('exit', onExit);
				try {
					active.postMessage(input);
				} catch (error) {
					cleanup();
					reject(new CyanophageStatsWorkerError(String(error)));
				}
			});
		},
		async close() {
			closed = true;
			await worker?.terminate();
		}
	};
}
