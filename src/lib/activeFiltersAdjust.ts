import type { FilterStore } from '$lib/filterStore.svelte';
import type { KeyFilterKind } from '$lib/filterFocus';
import type { StatFilterSection } from '$lib/statsFiltering';
import { CMINI_ANALYZER, STAT_ANALYZERS, type StatsAnalyzer } from '$lib/statsAnalyzers';
import {
	LIKES_STAT_FILTER_FIELD,
	getFingerUsageStatFilterFieldsForAnalyzer,
	getGeneralStatFilterRowsForAnalyzer,
	getHandUsageStatFilterFieldsForAnalyzer,
	type StatLimitKey
} from '$lib/statsFiltering';
import { hasConfiguredFingerWorkloadPreference } from '$lib/fingerWorkload';

export type ActiveKeyboardSnapshot = {
	thumbs: boolean;
	repeat: boolean;
	magic: boolean;
	adaptive: boolean;
	board: boolean;
	charset: boolean;
	unfinished: boolean;
};

export type ActiveKeysSnapshot = {
	and: boolean;
	or: boolean;
	exclude: boolean;
};

export type ActiveStatSnapshotEntry = {
	analyzer: StatsAnalyzer;
	key: StatLimitKey;
	section: StatFilterSection;
};

/** Frozen set of filters that were active when Adjust mode was entered. */
export type ActiveFiltersSnapshot = {
	name: boolean;
	authors: boolean;
	keyboard: ActiveKeyboardSnapshot;
	keys: ActiveKeysSnapshot;
	stats: ActiveStatSnapshotEntry[];
	fingerWorkloadAnalyzers: StatsAnalyzer[];
	similarity: boolean;
};

function gridOrThumbsActive(
	grid: string[][],
	leftThumbs: string[],
	rightThumbs: string[]
): boolean {
	return (
		grid.some((row) => row.some((cell) => cell !== '')) ||
		leftThumbs.some((k) => k !== '') ||
		rightThumbs.some((k) => k !== '')
	);
}

function limitActive(store: FilterStore, key: StatLimitKey): boolean {
	return store.statLimits[key]?.value.trim() !== '';
}

/** Build a freeze-on-enter snapshot from live/draft filter state. */
export function buildActiveFiltersSnapshot(store: FilterStore): ActiveFiltersSnapshot {
	const stats: ActiveStatSnapshotEntry[] = [];
	const fingerWorkloadAnalyzers: StatsAnalyzer[] = [];

	for (const entry of STAT_ANALYZERS) {
		const analyzer = entry.value;
		for (const row of getGeneralStatFilterRowsForAnalyzer(analyzer)) {
			for (const field of row) {
				if (!limitActive(store, field.key)) continue;
				stats.push({ analyzer, key: field.key, section: 'general' });
			}
		}

		if (analyzer === CMINI_ANALYZER && store.canUseLikes) {
			if (limitActive(store, LIKES_STAT_FILTER_FIELD.key)) {
				stats.push({
					analyzer: CMINI_ANALYZER,
					key: 'likes',
					section: 'general'
				});
			}
		}

		for (const field of getHandUsageStatFilterFieldsForAnalyzer(analyzer)) {
			if (!limitActive(store, field.key)) continue;
			stats.push({ analyzer, key: field.key, section: 'hand-usage' });
		}
		for (const field of getFingerUsageStatFilterFieldsForAnalyzer(analyzer)) {
			if (!limitActive(store, field.key)) continue;
			stats.push({ analyzer, key: field.key, section: 'finger-usage' });
		}
		if (hasConfiguredFingerWorkloadPreference(store.fingerWorkloadPreferences[analyzer])) {
			fingerWorkloadAnalyzers.push(analyzer);
		}
	}

	return {
		name: store.nameFilterInput.trim() !== '',
		authors: store.selectedAuthors.size > 0,
		keyboard: {
			thumbs: store.thumbKeyFilter !== 'optional',
			repeat: store.repeatKeyFilter !== 'optional',
			magic: store.magicKeyFilter !== 'optional',
			adaptive: store.adaptiveSwapFilter !== 'optional',
			board: store.boardTypeFilter !== 'all',
			charset: store.characterSetFilter !== 'english',
			unfinished: store.showUnfinished
		},
		keys: {
			and: gridOrThumbsActive(
				store.includeGrid,
				store.includeLeftThumbKeys,
				store.includeRightThumbKeys
			),
			or: gridOrThumbsActive(
				store.includeOrGrid,
				store.includeOrLeftThumbKeys,
				store.includeOrRightThumbKeys
			),
			exclude: gridOrThumbsActive(
				store.excludeGrid,
				store.excludeLeftThumbKeys,
				store.excludeRightThumbKeys
			)
		},
		stats,
		fingerWorkloadAnalyzers,
		similarity: store.hasSimilarReference
	};
}

export function snapshotHasKeyboard(keyboard: ActiveKeyboardSnapshot): boolean {
	return (
		keyboard.thumbs ||
		keyboard.repeat ||
		keyboard.magic ||
		keyboard.adaptive ||
		keyboard.board ||
		keyboard.charset ||
		keyboard.unfinished
	);
}

export function snapshotHasKeys(keys: ActiveKeysSnapshot): boolean {
	return keys.and || keys.or || keys.exclude;
}

export function activeKeyKinds(keys: ActiveKeysSnapshot): KeyFilterKind[] {
	const kinds: KeyFilterKind[] = [];
	if (keys.and) kinds.push('and');
	if (keys.or) kinds.push('or');
	if (keys.exclude) kinds.push('exclude');
	return kinds;
}
