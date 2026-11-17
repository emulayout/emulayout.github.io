import type { LayoutData } from '$lib/layout';
import type { LayoutListItem } from '$lib/layoutList';
import {
	isSimilarLayoutMatch,
	matchesSimilarityPercentFilter,
	sortLayoutsBySimilarity,
	type SimilarityMatchInfo
} from '$lib/layoutSimilarity';
import type { SortBy, SortOrder } from '$lib/statsSorting';

export interface LayoutResults {
	items: LayoutListItem[];
	hasFilteredSelection: boolean;
	forceIncludedNames: Set<string>;
}

export interface BuildLayoutResultsOptions {
	/** Complete catalog, including layouts removed by the active filters. */
	catalogLayouts: LayoutData[];
	/** Catalog layouts after the ordinary source, metadata, key, and stat filters. */
	filteredLayouts: LayoutData[];
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
		hasFilteredSelection: false,
		forceIncludedNames: new Set()
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
	let hasFilteredSelection = false;

	// Inject selected layouts that fail current filters when the override is enabled.
	if (selectedLayoutNames.size > 0) {
		const present = new Set(result.map((layout) => layout.name));
		for (const layout of catalogLayouts) {
			if (
				!selectedLayoutNames.has(layout.name) ||
				layout.name === similarReferenceName ||
				present.has(layout.name)
			) {
				continue;
			}
			hasFilteredSelection = true;
			if (!includeSelectedInResults) break;
			result.push(layout);
			present.add(layout.name);
			forceIncludedNames.add(layout.name);
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
		// Keep the saved source's order, then append forced layouts outside that source.
		const sourceNames = new Set(sourceLayoutNames);
		for (const layout of layoutsForList) {
			if (forceIncludedNames.has(layout.name) && !sourceNames.has(layout.name)) {
				items.push({ kind: 'layout', layout });
			}
		}
	} else {
		items = layoutsForList.map((layout) => ({ kind: 'layout' as const, layout }));
	}

	return {
		items,
		hasFilteredSelection,
		forceIncludedNames
	};
}
