import type { StatsMaps } from '$lib/layout';
import {
	analyzerUsesSelectableCorpus,
	CMINI_ANALYZER,
	DEFAULT_STATS_CORPUS,
	STAT_ANALYZERS,
	resolveStatsAnalyzers,
	type StatsAnalyzer,
	type StatsAnalyzerMode,
	type StatsCorpus
} from '$lib/statsAnalyzers';
import {
	loadAnalyzerStats,
	type AnalyzerStatsLoadError,
	type AnalyzerStatsMap
} from '$lib/layoutStatsLoader';
import { DEFAULT_KEYBOARD_GEOMETRY, type KeyboardGeometry } from '$lib/keyboardGeometry';

class LayoutStatsStore {
	maps: StatsMaps = $state({});
	loadingAnalyzers: Partial<Record<StatsAnalyzer, boolean>> = $state({});
	loadErrors: Partial<Record<StatsAnalyzer, AnalyzerStatsLoadError>> = $state({});
	/** Corpus used for API-derived analyzer fetches (cmini / Mana2). */
	activeCorpus: StatsCorpus = $state(DEFAULT_STATS_CORPUS);
	activeGeometry: KeyboardGeometry = $state(DEFAULT_KEYBOARD_GEOMETRY);

	#abortControllers = new Map<StatsAnalyzer, AbortController>();
	#mapCache = new Map<string, AnalyzerStatsMap>();

	isLoaded(analyzer: StatsAnalyzer): boolean {
		return this.maps[analyzer] !== undefined;
	}

	isLoading(analyzer: StatsAnalyzer): boolean {
		return this.loadingAnalyzers[analyzer] === true;
	}

	getLoadError(analyzer: StatsAnalyzer): AnalyzerStatsLoadError | undefined {
		return this.loadErrors[analyzer];
	}

	/** True when any of the concrete analyzers in a display mode are loading. */
	isLoadingMode(mode: StatsAnalyzerMode): boolean {
		return resolveStatsAnalyzers(mode).some((analyzer) => this.isLoading(analyzer));
	}

	get loading(): boolean {
		return Object.values(this.loadingAnalyzers).some(Boolean);
	}

	get loaded(): boolean {
		return this.isLoaded(CMINI_ANALYZER);
	}

	get map(): StatsMaps[typeof CMINI_ANALYZER] {
		return this.maps[CMINI_ANALYZER] ?? {};
	}

	/** Switch API-backed corpus, restoring a previously loaded dataset when available. */
	applyCorpus(corpus: StatsCorpus): void {
		if (this.activeCorpus === corpus) return;
		this.activeCorpus = corpus;
		this.#activateDatasets(
			STAT_ANALYZERS.map(({ value }) => value).filter(analyzerUsesSelectableCorpus)
		);
	}

	/** Switch keyboard geometry, restoring previously loaded analyzer maps when available. */
	applyGeometry(geometry: KeyboardGeometry): void {
		if (this.activeGeometry === geometry) return;
		this.activeGeometry = geometry;
		this.#activateDatasets(STAT_ANALYZERS.map(({ value }) => value));
	}

	hydrate(analyzer: StatsAnalyzer, map: NonNullable<StatsMaps[StatsAnalyzer]>): void {
		this.#abortControllers.get(analyzer)?.abort();
		this.#abortControllers.delete(analyzer);
		this.#mapCache.set(this.#cacheKey(analyzer), map);
		this.maps = { ...this.maps, [analyzer]: map };
		this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: false };
		this.#clearLoadError(analyzer);
	}

	setLoadError(analyzer: StatsAnalyzer, error: AnalyzerStatsLoadError): void {
		this.#abortControllers.get(analyzer)?.abort();
		this.#abortControllers.delete(analyzer);
		const maps = { ...this.maps };
		delete maps[analyzer];
		this.#mapCache.delete(this.#cacheKey(analyzer));
		this.maps = maps;
		this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: false };
		this.loadErrors = { ...this.loadErrors, [analyzer]: error };
	}

	reset(
		corpus: StatsCorpus = this.activeCorpus,
		geometry: KeyboardGeometry = this.activeGeometry
	): void {
		for (const controller of this.#abortControllers.values()) {
			controller.abort();
		}
		this.#abortControllers.clear();
		this.#mapCache.clear();
		this.maps = {};
		this.loadingAnalyzers = {};
		this.loadErrors = {};
		this.activeCorpus = corpus;
		this.activeGeometry = geometry;
	}

	async ensureLoaded(analyzer: StatsAnalyzer): Promise<void> {
		if (this.isLoaded(analyzer) || this.isLoading(analyzer) || this.getLoadError(analyzer)) return;

		const abortController = new AbortController();
		this.#abortControllers.set(analyzer, abortController);
		this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: true };
		const corpus = this.activeCorpus;
		const geometry = this.activeGeometry;

		try {
			const result = await loadAnalyzerStats(analyzer, {
				signal: abortController.signal,
				corpus,
				geometry
			});
			if (this.#abortControllers.get(analyzer) !== abortController) return;
			if (this.activeCorpus !== corpus && analyzerUsesSelectableCorpus(analyzer)) return;
			if (this.activeGeometry !== geometry) return;
			if (result.status === 'loaded') {
				this.#mapCache.set(this.#cacheKey(analyzer, corpus, geometry), result.map);
				this.maps = { ...this.maps, [analyzer]: result.map };
				this.#clearLoadError(analyzer);
			} else if (result.status === 'error') {
				this.loadErrors = { ...this.loadErrors, [analyzer]: result.error };
			}
		} finally {
			if (this.#abortControllers.get(analyzer) === abortController) {
				this.#abortControllers.delete(analyzer);
				this.loadingAnalyzers = { ...this.loadingAnalyzers, [analyzer]: false };
			}
		}
	}

	async retry(analyzer: StatsAnalyzer): Promise<void> {
		if (this.isLoading(analyzer)) return;
		this.#clearLoadError(analyzer);
		await this.ensureLoaded(analyzer);
	}

	async retryAnalyzers(analyzers: Iterable<StatsAnalyzer>): Promise<void> {
		await Promise.all([...new Set(analyzers)].map((analyzer) => this.retry(analyzer)));
	}

	#clearLoadError(analyzer: StatsAnalyzer): void {
		if (!this.loadErrors[analyzer]) return;
		const loadErrors = { ...this.loadErrors };
		delete loadErrors[analyzer];
		this.loadErrors = loadErrors;
	}

	#cacheKey(
		analyzer: StatsAnalyzer,
		corpus: StatsCorpus = this.activeCorpus,
		geometry: KeyboardGeometry = this.activeGeometry
	): string {
		return `${analyzer}:${analyzerUsesSelectableCorpus(analyzer) ? corpus : '-'}:${geometry}`;
	}

	#activateDatasets(analyzers: readonly StatsAnalyzer[]): void {
		const maps = { ...this.maps };
		const loadingAnalyzers = { ...this.loadingAnalyzers };
		const loadErrors = { ...this.loadErrors };

		for (const analyzer of analyzers) {
			this.#abortControllers.get(analyzer)?.abort();
			this.#abortControllers.delete(analyzer);

			const cached = this.#mapCache.get(this.#cacheKey(analyzer));
			if (cached) maps[analyzer] = cached;
			else delete maps[analyzer];
			loadingAnalyzers[analyzer] = false;
			delete loadErrors[analyzer];
		}

		this.maps = maps;
		this.loadingAnalyzers = loadingAnalyzers;
		this.loadErrors = loadErrors;
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
