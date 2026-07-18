import type { StatsMaps } from '$lib/layout';
import {
	DEFAULT_STATS_ANALYZER,
	STAT_ANALYZERS,
	resolveStatsAnalyzers,
	type StatsAnalyzer,
	type StatsAnalyzerMode
} from '$lib/layoutStats';

const ANALYZER_STATS_URL: Record<StatsAnalyzer, string> = {
	monkeyracer: '/layout-stats.json',
	cyanophage: '/layout-stats-cyanophage.json'
};

class LayoutStatsStore {
	maps: StatsMaps = $state({});
	loadingAnalyzers: Partial<Record<StatsAnalyzer, boolean>> = $state({});

	#abortControllers = new Map<StatsAnalyzer, AbortController>();

	isLoaded(analyzer: StatsAnalyzer): boolean {
		return this.maps[analyzer] !== undefined;
	}

	isLoading(analyzer: StatsAnalyzer): boolean {
		return this.loadingAnalyzers[analyzer] === true;
	}

	/** True when any of the concrete analyzers in a display mode are loading. */
	isLoadingMode(mode: StatsAnalyzerMode): boolean {
		return resolveStatsAnalyzers(mode).some((analyzer) => this.isLoading(analyzer));
	}

	get loading(): boolean {
		return Object.values(this.loadingAnalyzers).some(Boolean);
	}

	get loaded(): boolean {
		return this.isLoaded(DEFAULT_STATS_ANALYZER);
	}

	get map(): StatsMaps[typeof DEFAULT_STATS_ANALYZER] {
		return this.maps[DEFAULT_STATS_ANALYZER] ?? {};
	}

	hydrate(analyzer: StatsAnalyzer, map: NonNullable<StatsMaps[StatsAnalyzer]>): void {
		this.#abortControllers.get(analyzer)?.abort();
		this.#abortControllers.delete(analyzer);
		this.maps = { ...this.maps, [analyzer]: map };
		this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: false };
	}

	reset(): void {
		for (const controller of this.#abortControllers.values()) {
			controller.abort();
		}
		this.#abortControllers.clear();
		this.maps = {};
		this.loadingAnalyzers = {};
	}

	async ensureLoaded(analyzer: StatsAnalyzer): Promise<void> {
		if (this.isLoaded(analyzer) || this.isLoading(analyzer)) return;

		const abortController = new AbortController();
		this.#abortControllers.set(analyzer, abortController);
		this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: true };

		try {
			const response = await fetch(ANALYZER_STATS_URL[analyzer], { signal: abortController.signal });
			const map = response.ok ? await response.json() : {};
			if (this.#abortControllers.get(analyzer) === abortController) {
				this.maps = { ...this.maps, [analyzer]: map };
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			throw err;
		} finally {
			if (this.#abortControllers.get(analyzer) === abortController) {
				this.#abortControllers.delete(analyzer);
				this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: false };
			}
		}
	}

	#abortAllPending(): void {
		for (const { value: analyzer } of STAT_ANALYZERS) {
			this.#abortControllers.get(analyzer)?.abort();
			this.#abortControllers.delete(analyzer);
		}
		this.loadingAnalyzers = {};
	}

	/** Load exactly the analyzers in `needed` (from `analyzersNeededForLoad`). */
	async loadAnalyzers(needed: Iterable<StatsAnalyzer>): Promise<void> {
		const analyzers = [...new Set(needed)];

		if (analyzers.length === 0) {
			this.#abortAllPending();
			return;
		}

		await Promise.all(analyzers.map((analyzer) => this.ensureLoaded(analyzer)));
	}
}

export const layoutStatsStore = new LayoutStatsStore();
