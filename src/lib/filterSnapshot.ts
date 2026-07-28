import { ALL_STAT_FILTER_FIELDS, type StatLimitKey } from '$lib/statsFiltering';
import { isSortOrder, normalizeSortBy, type SortBy, type SortOrder } from '$lib/statsSorting';
import { isSimilarityMirrorMode, type SimilarityMirrorMode } from '$lib/layoutSimilarity';

export type ThumbKeyFilter = 'optional' | 'excluded' | 'required';
export type MagicKeyFilter = 'optional' | 'excluded' | 'required' | 'required-mapped';
export type AdaptiveSwapFilter = 'optional' | 'excluded' | 'required' | 'required-mapped';
export type CharacterSetFilter = 'all' | 'english' | 'international';
export type BoardTypeFilter = 'all' | 'angle' | 'stagger' | 'angle-stagger' | 'ortho' | 'mini';
export type StatLimitOperator = 'lt' | 'gt';

export interface StatLimit {
	operator: StatLimitOperator;
	value: string;
}

export type SortSnapshot = {
	sortBy: SortBy;
	sortOrder: SortOrder;
	sortOrderManual: boolean;
};

/** Per-view filter fields — All and Selected keep isolated snapshots (never synced). */
export type ViewFilterSnapshot = {
	includeGrid: string[][];
	excludeGrid: string[][];
	includeOrGrid: string[][];
	includeOrLeftThumbKeys: string[];
	includeOrRightThumbKeys: string[];
	includeLeftThumbKeys: string[];
	includeRightThumbKeys: string[];
	excludeLeftThumbKeys: string[];
	excludeRightThumbKeys: string[];
	showUnfinished: boolean;
	thumbKeyFilter: ThumbKeyFilter;
	magicKeyFilter: MagicKeyFilter;
	adaptiveSwapFilter: AdaptiveSwapFilter;
	characterSetFilter: CharacterSetFilter;
	boardTypeFilter: BoardTypeFilter;
	nameFilterInput: string;
	nameFilter: string;
	selectedAuthors: number[];
	includeSelectedInResults: boolean;
	similarReferenceName: string | null;
	similarReferenceAnglemod: boolean;
	similarityFilterOperator: StatLimitOperator;
	similarityFilterValue: string;
	appliedSimilarityFilterValue: string;
	similarityWeightHomeKeys: boolean;
	similarityMirrorMode: SimilarityMirrorMode;
	sortBy: SortBy;
	sortOrder: SortOrder;
	sortOrderManual: boolean;
	sortBeforeSimilar: SortSnapshot | null;
	exitSortRestore: SortSnapshot | null;
	statLimits: Record<StatLimitKey, StatLimit>;
	appliedIncludeGrid: string[][];
	appliedExcludeGrid: string[][];
	appliedIncludeOrGrid: string[][];
	appliedIncludeOrLeftThumbKeys: string[];
	appliedIncludeOrRightThumbKeys: string[];
	appliedIncludeLeftThumbKeys: string[];
	appliedIncludeRightThumbKeys: string[];
	appliedExcludeLeftThumbKeys: string[];
	appliedExcludeRightThumbKeys: string[];
	appliedStatLimits: Record<StatLimitKey, StatLimit>;
};

export const FILTER_GRID_ROWS = 3;
export const FILTER_GRID_COLUMNS = 10;
export const FILTER_THUMB_KEYS_PER_HAND = 4;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createEmptyFilterGrid(): string[][] {
	return Array.from({ length: FILTER_GRID_ROWS }, () =>
		Array.from({ length: FILTER_GRID_COLUMNS }, () => '')
	);
}

export function createEmptyThumbKeyFilters(): string[] {
	return Array.from({ length: FILTER_THUMB_KEYS_PER_HAND }, () => '');
}

export function createEmptyStatLimits(): Record<StatLimitKey, StatLimit> {
	const limits = {} as Record<StatLimitKey, StatLimit>;
	for (const field of ALL_STAT_FILTER_FIELDS) {
		limits[field.key] = { operator: 'lt', value: '' };
	}
	limits.likes = { operator: 'gt', value: '' };
	return limits;
}

export function cloneFilterGrid(grid: string[][]): string[][] {
	return grid.map((row) => [...row]);
}

export function cloneThumbKeyFilters(keys: string[]): string[] {
	return [...keys];
}

export function cloneStatLimits(
	limits: Record<StatLimitKey, StatLimit>
): Record<StatLimitKey, StatLimit> {
	const clone = createEmptyStatLimits();
	for (const key of Object.keys(clone) as StatLimitKey[]) {
		clone[key] = { ...limits[key] };
	}
	return clone;
}

export function cloneSortSnapshot(snapshot: SortSnapshot | null): SortSnapshot | null {
	return snapshot ? { ...snapshot } : null;
}

/** Similarity is only a valid sort while a reference layout exists. */
export function normalizeViewSortBy(sortBy: SortBy, similarReferenceName: string | null): SortBy {
	return sortBy === 'similarity' && !similarReferenceName ? 'date' : sortBy;
}

export function cloneViewFilterSnapshot(snapshot: ViewFilterSnapshot): ViewFilterSnapshot {
	return {
		...snapshot,
		includeGrid: cloneFilterGrid(snapshot.includeGrid),
		excludeGrid: cloneFilterGrid(snapshot.excludeGrid),
		includeOrGrid: cloneFilterGrid(snapshot.includeOrGrid),
		includeOrLeftThumbKeys: cloneThumbKeyFilters(snapshot.includeOrLeftThumbKeys),
		includeOrRightThumbKeys: cloneThumbKeyFilters(snapshot.includeOrRightThumbKeys),
		includeLeftThumbKeys: cloneThumbKeyFilters(snapshot.includeLeftThumbKeys),
		includeRightThumbKeys: cloneThumbKeyFilters(snapshot.includeRightThumbKeys),
		excludeLeftThumbKeys: cloneThumbKeyFilters(snapshot.excludeLeftThumbKeys),
		excludeRightThumbKeys: cloneThumbKeyFilters(snapshot.excludeRightThumbKeys),
		selectedAuthors: [...snapshot.selectedAuthors],
		sortBeforeSimilar: cloneSortSnapshot(snapshot.sortBeforeSimilar),
		exitSortRestore: cloneSortSnapshot(snapshot.exitSortRestore),
		statLimits: cloneStatLimits(snapshot.statLimits),
		appliedIncludeGrid: cloneFilterGrid(snapshot.appliedIncludeGrid),
		appliedExcludeGrid: cloneFilterGrid(snapshot.appliedExcludeGrid),
		appliedIncludeOrGrid: cloneFilterGrid(snapshot.appliedIncludeOrGrid),
		appliedIncludeOrLeftThumbKeys: cloneThumbKeyFilters(snapshot.appliedIncludeOrLeftThumbKeys),
		appliedIncludeOrRightThumbKeys: cloneThumbKeyFilters(snapshot.appliedIncludeOrRightThumbKeys),
		appliedIncludeLeftThumbKeys: cloneThumbKeyFilters(snapshot.appliedIncludeLeftThumbKeys),
		appliedIncludeRightThumbKeys: cloneThumbKeyFilters(snapshot.appliedIncludeRightThumbKeys),
		appliedExcludeLeftThumbKeys: cloneThumbKeyFilters(snapshot.appliedExcludeLeftThumbKeys),
		appliedExcludeRightThumbKeys: cloneThumbKeyFilters(snapshot.appliedExcludeRightThumbKeys),
		appliedStatLimits: cloneStatLimits(snapshot.appliedStatLimits)
	};
}

export function createDefaultViewSnapshot(): ViewFilterSnapshot {
	return {
		includeGrid: createEmptyFilterGrid(),
		excludeGrid: createEmptyFilterGrid(),
		includeOrGrid: createEmptyFilterGrid(),
		includeOrLeftThumbKeys: createEmptyThumbKeyFilters(),
		includeOrRightThumbKeys: createEmptyThumbKeyFilters(),
		includeLeftThumbKeys: createEmptyThumbKeyFilters(),
		includeRightThumbKeys: createEmptyThumbKeyFilters(),
		excludeLeftThumbKeys: createEmptyThumbKeyFilters(),
		excludeRightThumbKeys: createEmptyThumbKeyFilters(),
		showUnfinished: false,
		thumbKeyFilter: 'optional',
		magicKeyFilter: 'optional',
		adaptiveSwapFilter: 'optional',
		characterSetFilter: 'english',
		boardTypeFilter: 'all',
		nameFilterInput: '',
		nameFilter: '',
		selectedAuthors: [],
		includeSelectedInResults: false,
		similarReferenceName: null,
		similarReferenceAnglemod: false,
		similarityFilterOperator: 'gt',
		similarityFilterValue: '50',
		appliedSimilarityFilterValue: '50',
		similarityWeightHomeKeys: false,
		similarityMirrorMode: 'excluded',
		sortBy: 'date',
		sortOrder: 'desc',
		sortOrderManual: false,
		sortBeforeSimilar: null,
		exitSortRestore: null,
		statLimits: createEmptyStatLimits(),
		appliedIncludeGrid: createEmptyFilterGrid(),
		appliedExcludeGrid: createEmptyFilterGrid(),
		appliedIncludeOrGrid: createEmptyFilterGrid(),
		appliedIncludeOrLeftThumbKeys: createEmptyThumbKeyFilters(),
		appliedIncludeOrRightThumbKeys: createEmptyThumbKeyFilters(),
		appliedIncludeLeftThumbKeys: createEmptyThumbKeyFilters(),
		appliedIncludeRightThumbKeys: createEmptyThumbKeyFilters(),
		appliedExcludeLeftThumbKeys: createEmptyThumbKeyFilters(),
		appliedExcludeRightThumbKeys: createEmptyThumbKeyFilters(),
		appliedStatLimits: createEmptyStatLimits()
	};
}

function normalizeGrid(value: unknown, fallback: string[][]): string[][] {
	if (!Array.isArray(value)) return cloneFilterGrid(fallback);
	return Array.from({ length: FILTER_GRID_ROWS }, (_, rowIndex) => {
		const row = value[rowIndex];
		return Array.from({ length: FILTER_GRID_COLUMNS }, (_, columnIndex) => {
			const cell = Array.isArray(row) ? row[columnIndex] : undefined;
			return typeof cell === 'string' ? cell : '';
		});
	});
}

function normalizeThumbKeys(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) return [...fallback];
	return Array.from({ length: FILTER_THUMB_KEYS_PER_HAND }, (_, index) =>
		typeof value[index] === 'string' ? value[index] : ''
	);
}

function normalizeStatLimits(
	value: unknown,
	fallback: Record<StatLimitKey, StatLimit>
): Record<StatLimitKey, StatLimit> {
	const normalized = cloneStatLimits(fallback);
	if (!isPlainObject(value)) return normalized;

	for (const key of Object.keys(normalized) as StatLimitKey[]) {
		const candidate = value[key];
		if (!isPlainObject(candidate)) continue;
		const operator: StatLimitOperator =
			candidate.operator === 'lt' || candidate.operator === 'gt'
				? candidate.operator
				: normalized[key].operator;
		normalized[key] = {
			operator,
			value: typeof candidate.value === 'string' ? candidate.value : normalized[key].value
		};
	}
	return normalized;
}

function normalizeSortSnapshot(value: unknown): SortSnapshot | null {
	if (!isPlainObject(value) || typeof value.sortBy !== 'string') return null;
	const sortBy = normalizeSortBy(value.sortBy);
	if (!sortBy || typeof value.sortOrder !== 'string' || !isSortOrder(value.sortOrder)) {
		return null;
	}
	return {
		sortBy,
		sortOrder: value.sortOrder,
		sortOrderManual: value.sortOrderManual === true
	};
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Normalize persisted or shared data over current defaults. Draft fields are
 * canonical; missing applied fields inherit their draft counterpart so old
 * snapshots keep filtering the same layouts after migration.
 */
export function normalizeViewFilterSnapshot(value: unknown): ViewFilterSnapshot {
	const defaults = createDefaultViewSnapshot();
	if (!isPlainObject(value)) return defaults;

	const includeGrid = normalizeGrid(value.includeGrid, defaults.includeGrid);
	const excludeGrid = normalizeGrid(value.excludeGrid, defaults.excludeGrid);
	const includeOrGrid = normalizeGrid(value.includeOrGrid, defaults.includeOrGrid);
	const includeOrLeftThumbKeys = normalizeThumbKeys(
		value.includeOrLeftThumbKeys,
		defaults.includeOrLeftThumbKeys
	);
	const includeOrRightThumbKeys = normalizeThumbKeys(
		value.includeOrRightThumbKeys,
		defaults.includeOrRightThumbKeys
	);
	const includeLeftThumbKeys = normalizeThumbKeys(
		value.includeLeftThumbKeys,
		defaults.includeLeftThumbKeys
	);
	const includeRightThumbKeys = normalizeThumbKeys(
		value.includeRightThumbKeys,
		defaults.includeRightThumbKeys
	);
	const excludeLeftThumbKeys = normalizeThumbKeys(
		value.excludeLeftThumbKeys,
		defaults.excludeLeftThumbKeys
	);
	const excludeRightThumbKeys = normalizeThumbKeys(
		value.excludeRightThumbKeys,
		defaults.excludeRightThumbKeys
	);
	const nameFilter =
		typeof value.nameFilter === 'string'
			? value.nameFilter
			: typeof value.nameFilterInput === 'string'
				? value.nameFilterInput
				: defaults.nameFilter;
	const nameFilterInput =
		typeof value.nameFilterInput === 'string' ? value.nameFilterInput : nameFilter;
	const similarityFilterValue =
		typeof value.similarityFilterValue === 'string'
			? value.similarityFilterValue
			: defaults.similarityFilterValue;
	const similarReferenceName =
		typeof value.similarReferenceName === 'string'
			? value.similarReferenceName
			: defaults.similarReferenceName;
	const sortBy = normalizeViewSortBy(
		typeof value.sortBy === 'string'
			? (normalizeSortBy(value.sortBy) ?? defaults.sortBy)
			: defaults.sortBy,
		similarReferenceName
	);
	const statLimits = normalizeStatLimits(value.statLimits, defaults.statLimits);

	return {
		includeGrid,
		excludeGrid,
		includeOrGrid,
		includeOrLeftThumbKeys,
		includeOrRightThumbKeys,
		includeLeftThumbKeys,
		includeRightThumbKeys,
		excludeLeftThumbKeys,
		excludeRightThumbKeys,
		showUnfinished:
			typeof value.showUnfinished === 'boolean' ? value.showUnfinished : defaults.showUnfinished,
		thumbKeyFilter: normalizeEnum<ThumbKeyFilter>(
			value.thumbKeyFilter,
			['optional', 'excluded', 'required'],
			defaults.thumbKeyFilter
		),
		magicKeyFilter: normalizeEnum<MagicKeyFilter>(
			value.magicKeyFilter,
			['optional', 'excluded', 'required', 'required-mapped'],
			defaults.magicKeyFilter
		),
		adaptiveSwapFilter: normalizeEnum<AdaptiveSwapFilter>(
			value.adaptiveSwapFilter,
			['optional', 'excluded', 'required', 'required-mapped'],
			defaults.adaptiveSwapFilter
		),
		characterSetFilter: normalizeEnum<CharacterSetFilter>(
			value.characterSetFilter,
			['all', 'english', 'international'],
			defaults.characterSetFilter
		),
		boardTypeFilter: normalizeEnum<BoardTypeFilter>(
			value.boardTypeFilter,
			['all', 'angle', 'stagger', 'angle-stagger', 'ortho', 'mini'],
			defaults.boardTypeFilter
		),
		nameFilterInput,
		nameFilter,
		selectedAuthors: Array.isArray(value.selectedAuthors)
			? value.selectedAuthors.filter(
					(authorId): authorId is number =>
						typeof authorId === 'number' && Number.isFinite(authorId)
				)
			: defaults.selectedAuthors,
		includeSelectedInResults:
			typeof value.includeSelectedInResults === 'boolean'
				? value.includeSelectedInResults
				: defaults.includeSelectedInResults,
		similarReferenceName,
		similarReferenceAnglemod:
			typeof value.similarReferenceAnglemod === 'boolean'
				? value.similarReferenceAnglemod
				: defaults.similarReferenceAnglemod,
		similarityFilterOperator: normalizeEnum<StatLimitOperator>(
			value.similarityFilterOperator,
			['lt', 'gt'],
			defaults.similarityFilterOperator
		),
		similarityFilterValue,
		appliedSimilarityFilterValue:
			typeof value.appliedSimilarityFilterValue === 'string'
				? value.appliedSimilarityFilterValue
				: similarityFilterValue,
		similarityWeightHomeKeys:
			typeof value.similarityWeightHomeKeys === 'boolean'
				? value.similarityWeightHomeKeys
				: defaults.similarityWeightHomeKeys,
		similarityMirrorMode:
			typeof value.similarityMirrorMode === 'string' &&
			isSimilarityMirrorMode(value.similarityMirrorMode)
				? (value.similarityMirrorMode as SimilarityMirrorMode)
				: defaults.similarityMirrorMode,
		sortBy,
		sortOrder:
			typeof value.sortOrder === 'string' && isSortOrder(value.sortOrder)
				? value.sortOrder
				: defaults.sortOrder,
		sortOrderManual:
			typeof value.sortOrderManual === 'boolean' ? value.sortOrderManual : defaults.sortOrderManual,
		sortBeforeSimilar: normalizeSortSnapshot(value.sortBeforeSimilar),
		exitSortRestore: normalizeSortSnapshot(value.exitSortRestore),
		statLimits,
		appliedIncludeGrid: normalizeGrid(value.appliedIncludeGrid, includeGrid),
		appliedExcludeGrid: normalizeGrid(value.appliedExcludeGrid, excludeGrid),
		appliedIncludeOrGrid: normalizeGrid(value.appliedIncludeOrGrid, includeOrGrid),
		appliedIncludeOrLeftThumbKeys: normalizeThumbKeys(
			value.appliedIncludeOrLeftThumbKeys,
			includeOrLeftThumbKeys
		),
		appliedIncludeOrRightThumbKeys: normalizeThumbKeys(
			value.appliedIncludeOrRightThumbKeys,
			includeOrRightThumbKeys
		),
		appliedIncludeLeftThumbKeys: normalizeThumbKeys(
			value.appliedIncludeLeftThumbKeys,
			includeLeftThumbKeys
		),
		appliedIncludeRightThumbKeys: normalizeThumbKeys(
			value.appliedIncludeRightThumbKeys,
			includeRightThumbKeys
		),
		appliedExcludeLeftThumbKeys: normalizeThumbKeys(
			value.appliedExcludeLeftThumbKeys,
			excludeLeftThumbKeys
		),
		appliedExcludeRightThumbKeys: normalizeThumbKeys(
			value.appliedExcludeRightThumbKeys,
			excludeRightThumbKeys
		),
		appliedStatLimits: normalizeStatLimits(value.appliedStatLimits, statLimits)
	};
}
