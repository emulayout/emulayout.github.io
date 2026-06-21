import type { LayoutStatsMap } from '$lib/layout';

class LayoutStatsStore {
	map: LayoutStatsMap = $state({});
	loaded = $state(false);
	loading = $state(false);

	#abortController: AbortController | null = null;

	hydrate(map: LayoutStatsMap): void {
		this.#abortController?.abort();
		this.#abortController = null;
		this.map = map;
		this.loaded = true;
		this.loading = false;
	}

	reset(): void {
		this.#abortController?.abort();
		this.#abortController = null;
		this.map = {};
		this.loaded = false;
		this.loading = false;
	}

	async loadWhenVisible(showStats: boolean): Promise<void> {
		if (!showStats) {
			this.#abortController?.abort();
			this.#abortController = null;
			this.loading = false;
			return;
		}

		if (this.loaded || this.loading) return;

		const abortController = new AbortController();
		this.#abortController = abortController;
		this.loading = true;

		try {
			const response = await fetch('/layout-stats.json', { signal: abortController.signal });
			this.map = response.ok ? await response.json() : {};
			this.loaded = true;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			throw err;
		} finally {
			if (this.#abortController === abortController) {
				this.#abortController = null;
				this.loading = false;
			}
		}
	}
}

export const layoutStatsStore = new LayoutStatsStore();
