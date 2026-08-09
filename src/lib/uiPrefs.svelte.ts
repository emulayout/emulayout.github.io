/**
 * Shell UI preferences shared across the app (app bar, tooltips, etc.).
 */
import {
	DEFAULT_STATS_CORPUS,
	parseStatsCorpus,
	STATS_CORPUS_STORAGE_KEY,
	type StatsAnalyzer,
	type StatsCorpus
} from '$lib/statsAnalyzers';
import {
	LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY,
	normalizeLayoutDetailStatsAnalyzers,
	parseLayoutDetailStatsAnalyzers
} from '$lib/layoutDetailStatsPrefs';
import {
	createDefaultTypingPracticeDisplayOptions,
	parseTypingPracticeDisplayOptions,
	serializeTypingPracticeDisplayOptions,
	TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY,
	type TypingPracticeDisplayOptions
} from '$lib/typingPracticePrefs';
import {
	createDefaultLayoutTestAreaDisplayOptions,
	LAYOUT_TEST_AREA_DISPLAY_OPTIONS_STORAGE_KEY,
	parseLayoutTestAreaDisplayOptions,
	serializeLayoutTestAreaDisplayOptions,
	type LayoutTestAreaDisplayOptions
} from '$lib/layoutTestAreaPrefs';

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
	/** Persisted analyzer columns for layout-detail stats; null means use the data-driven default. */
	layoutDetailStatsAnalyzers = $state<StatsAnalyzer[] | null>(null);
	/** Persisted visual guidance and contextual-preview options for Typing practice. */
	typingPracticeDisplayOptions = $state<TypingPracticeDisplayOptions>(
		createDefaultTypingPracticeDisplayOptions()
	);
	/** Persisted visual guidance and contextual-preview options for Layout test area. */
	layoutTestAreaDisplayOptions = $state<LayoutTestAreaDisplayOptions>(
		createDefaultLayoutTestAreaDisplayOptions()
	);
	/** True after `hydrate()` reads localStorage (avoids applying defaults over persisted values). */
	hydrated = $state(false);

	hydrate() {
		this.hintsEnabled = localStorage.getItem('hintsEnabled') === 'true';
		this.fingerDistanceBars = localStorage.getItem('fingerDistanceDisplay') !== 'hidden';
		this.layoutCardStatsMode =
			localStorage.getItem('layoutCardStatsDisplay') === 'detailed' ? 'detailed' : 'focused';
		this.statsCorpus = parseStatsCorpus(localStorage.getItem(STATS_CORPUS_STORAGE_KEY));
		this.layoutDetailStatsAnalyzers = parseLayoutDetailStatsAnalyzers(
			localStorage.getItem(LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY)
		);
		this.typingPracticeDisplayOptions = parseTypingPracticeDisplayOptions(
			localStorage.getItem(TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY)
		);
		this.layoutTestAreaDisplayOptions = parseLayoutTestAreaDisplayOptions(
			localStorage.getItem(LAYOUT_TEST_AREA_DISPLAY_OPTIONS_STORAGE_KEY)
		);
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

	setLayoutDetailStatsAnalyzers(values: Iterable<StatsAnalyzer>) {
		this.layoutDetailStatsAnalyzers = normalizeLayoutDetailStatsAnalyzers(values);
		localStorage.setItem(
			LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY,
			JSON.stringify(this.layoutDetailStatsAnalyzers)
		);
	}

	setTypingPracticeDisplayOption(option: keyof TypingPracticeDisplayOptions, value: boolean) {
		const next = { ...this.typingPracticeDisplayOptions, [option]: value };
		this.typingPracticeDisplayOptions = next;
		localStorage.setItem(
			TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY,
			serializeTypingPracticeDisplayOptions(next)
		);
	}

	setLayoutTestAreaDisplayOption(option: keyof LayoutTestAreaDisplayOptions, value: boolean) {
		const next = { ...this.layoutTestAreaDisplayOptions, [option]: value };
		this.layoutTestAreaDisplayOptions = next;
		localStorage.setItem(
			LAYOUT_TEST_AREA_DISPLAY_OPTIONS_STORAGE_KEY,
			serializeLayoutTestAreaDisplayOptions(next)
		);
	}
}

export const uiPrefs = new UiPrefs();
