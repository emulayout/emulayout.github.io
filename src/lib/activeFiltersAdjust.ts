import type { FilterStore } from '$lib/filterStore.svelte';
import type { KeyFilterKind, StatFilterSection } from '$lib/filterSummaries';
import {
	DEFAULT_STATS_ANALYZER,
	LIKES_STAT_FILTER_FIELD,
	STAT_ANALYZERS,
	getGeneralStatFilterRowsForAnalyzer,
	getLeftHandStatFilterFieldsForAnalyzer,
	getRightHandStatFilterFieldsForAnalyzer,
	type StatLimitKey,
	type StatsAnalyzer
} from '$lib/layoutStats';

export type ActiveKeyboardSnapshot = {
	thumbs: boolean;
	magic: boolean;
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

	for (const entry of STAT_ANALYZERS) {
		const analyzer = entry.value;
		for (const row of getGeneralStatFilterRowsForAnalyzer(analyzer)) {
			for (const field of row) {
				if (!limitActive(store, field.key)) continue;
				stats.push({ analyzer, key: field.key, section: 'general' });
			}
		}

		if (analyzer === DEFAULT_STATS_ANALYZER && store.canUseLikes) {
			if (limitActive(store, LIKES_STAT_FILTER_FIELD.key)) {
				stats.push({
					analyzer: DEFAULT_STATS_ANALYZER,
					key: 'likes',
					section: 'general'
				});
			}
		}

		for (const field of getLeftHandStatFilterFieldsForAnalyzer(analyzer)) {
			if (!limitActive(store, field.key)) continue;
			stats.push({ analyzer, key: field.key, section: 'hands' });
		}
		for (const field of getRightHandStatFilterFieldsForAnalyzer(analyzer)) {
			if (!limitActive(store, field.key)) continue;
			stats.push({ analyzer, key: field.key, section: 'hands' });
		}
	}

	return {
		name: store.nameFilterInput.trim() !== '',
		authors: store.selectedAuthors.size > 0,
		keyboard: {
			thumbs: store.thumbKeyFilter !== 'optional',
			magic: store.magicKeyFilter !== 'optional',
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
		similarity: store.hasSimilarReference
	};
}

export function snapshotHasKeyboard(keyboard: ActiveKeyboardSnapshot): boolean {
	return (
		keyboard.thumbs ||
		keyboard.magic ||
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
