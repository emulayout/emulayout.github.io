import type { LayoutData } from '$lib/layout';
import type { LayoutListItem } from '$lib/layoutList';
import {
	isSimilarLayoutMatch,
	matchesSimilarityPercentFilter,
	sortLayoutsBySimilarity,
	type SimilarityMatchInfo
} from '$lib/layoutSimilarity';
import type { LayoutSource } from '$lib/savedViews';
import type { SortBy, SortOrder } from '$lib/statsSorting';

export interface LayoutResults {
	items: LayoutListItem[];
	forceIncludedNames: Set<string>;
	hiddenSelectedCount: number;
}

export interface BuildLayoutResultsOptions {
	/** Complete catalog, including layouts removed by the active filters. */
	catalogLayouts: LayoutData[];
	/** Catalog layouts after the ordinary source, metadata, key, and stat filters. */
	filteredLayouts: LayoutData[];
	layoutSource: LayoutSource;
	selectedLayoutNames: ReadonlySet<string>;
	includeSelectedInResults: boolean;
	/** Ordered saved/custom source membership, or null for the full catalog. */
	sourceLayoutNames: readonly string[] | null;
	similarReferenceName: string | null;
	similarityMatches: Map<string, SimilarityMatchInfo>;
	similarityFilterOperator: 'lt' | 'gt';
	similarityFilterValue: string;
	sortBy: SortBy;
	sortOrder: SortOrder;
	sortFilteredLayouts: (layouts: LayoutData[]) => LayoutData[];
}

export function createEmptyLayoutResults(): LayoutResults {
	return {
		items: [],
		forceIncludedNames: new Set(),
		hiddenSelectedCount: 0
	};
}

/**
 * Compose the final result list after ordinary catalog filtering.
 *
 * This owns the interactions between similarity mode, selected-layout overrides,
 * sorting, and ordered saved-view membership without depending on reactive state.
 */
export function buildLayoutResults({
	catalogLayouts,
	filteredLayouts,
	layoutSource,
	selectedLayoutNames,
	includeSelectedInResults,
	sourceLayoutNames,
	similarReferenceName,
	similarityMatches,
	similarityFilterOperator,
	similarityFilterValue,
	sortBy,
	sortOrder,
	sortFilteredLayouts
}: BuildLayoutResultsOptions): LayoutResults {
	const result = filteredLayouts.filter((layout) => {
		if (!similarReferenceName) return true;
		if (!isSimilarLayoutMatch(similarReferenceName, layout.name, similarityMatches)) {
			return false;
		}
		const match = similarityMatches.get(layout.name);
		if (match === undefined) return false;
		return matchesSimilarityPercentFilter(
			match.percent,
			similarityFilterOperator,
			similarityFilterValue
		);
	});

	const forceIncludedNames = new Set<string>();
	let hiddenSelectedCount = 0;

	// Count (and optionally inject) selected layouts that fail current filters.
	if (layoutSource === 'all' && selectedLayoutNames.size > 0) {
		const present = new Set(result.map((layout) => layout.name));
		for (const layout of catalogLayouts) {
			if (
				!selectedLayoutNames.has(layout.name) ||
				layout.name === similarReferenceName ||
				present.has(layout.name)
			) {
				continue;
			}
			hiddenSelectedCount += 1;
			if (includeSelectedInResults) {
				result.push(layout);
				present.add(layout.name);
				forceIncludedNames.add(layout.name);
			}
		}
	}

	const sorted =
		sortBy === 'similarity'
			? sortLayoutsBySimilarity(result, similarityMatches, sortOrder)
			: sortFilteredLayouts(result);

	// The similarity reference is rendered separately as a pinned card.
	const layoutsForList = similarReferenceName
		? sorted.filter((layout) => layout.name !== similarReferenceName)
		: sorted;

	let items: LayoutListItem[];
	if (sourceLayoutNames !== null) {
		const byName = new Map(layoutsForList.map((layout) => [layout.name, layout]));
		const catalogNames = new Set(catalogLayouts.map((layout) => layout.name));
		items = [];
		for (const name of sourceLayoutNames) {
			if (name === similarReferenceName) continue;
			const hit = byName.get(name);
			if (hit) {
				items.push({ kind: 'layout', layout: hit });
			} else if (!catalogNames.has(name)) {
				items.push({ kind: 'missing', name });
			}
		}
	} else {
		items = layoutsForList.map((layout) => ({ kind: 'layout' as const, layout }));
	}

	return {
		items,
		forceIncludedNames,
		hiddenSelectedCount
	};
}
