/**
 * Shell UI preferences shared across the app (app bar, tooltips, etc.).
 */
import {
	DEFAULT_STATS_CORPUS,
	parseStatsCorpus,
	STATS_CORPUS_STORAGE_KEY,
	type StatsCorpus
} from '$lib/statsAnalyzers';

export type LayoutCardStatsMode = 'focused' | 'detailed';

class UiPrefs {
	/** When true, help `Tooltip`s are shown. Off by default. */
	hintsEnabled = $state(false);
	/** Cyanophage finger-distance bars are shown by default in the visual stats view. */
	fingerDistanceBars = $state(true);
	/** Highlights are the compact default; detailed restores the former text block. */
	layoutCardStatsMode = $state<LayoutCardStatsMode>('focused');
	/** Dump-backed corpus for cmini / Mana2 stats. Cyanophage ignores this. */
	statsCorpus = $state<StatsCorpus>(DEFAULT_STATS_CORPUS);
	/** True after `hydrate()` reads localStorage (avoids applying defaults over persisted values). */
	hydrated = $state(false);

	hydrate() {
		this.hintsEnabled = localStorage.getItem('hintsEnabled') === 'true';
		this.fingerDistanceBars = localStorage.getItem('fingerDistanceDisplay') !== 'hidden';
		this.layoutCardStatsMode =
			localStorage.getItem('layoutCardStatsDisplay') === 'detailed' ? 'detailed' : 'focused';
		this.statsCorpus = parseStatsCorpus(localStorage.getItem(STATS_CORPUS_STORAGE_KEY));
		this.hydrated = true;
	}

	toggleHints() {
		this.hintsEnabled = !this.hintsEnabled;
		localStorage.setItem('hintsEnabled', String(this.hintsEnabled));
	}

	setFingerDistanceBars(value: boolean) {
		this.fingerDistanceBars = value;
		localStorage.setItem('fingerDistanceDisplay', value ? 'visible' : 'hidden');
	}

	setLayoutCardStatsMode(value: LayoutCardStatsMode) {
		this.layoutCardStatsMode = value;
		localStorage.setItem('layoutCardStatsDisplay', value);
	}

	setStatsCorpus(value: StatsCorpus) {
		this.statsCorpus = value;
		localStorage.setItem(STATS_CORPUS_STORAGE_KEY, value);
	}
}

export const uiPrefs = new UiPrefs();
