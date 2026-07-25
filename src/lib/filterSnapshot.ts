import type {
	BoardTypeFilter,
	CharacterSetFilter,
	MagicKeyFilter,
	StatLimit,
	StatLimitOperator,
	ThumbKeyFilter,
	ViewFilterSnapshot
} from '$lib/filterStore.svelte';
import {
	ALL_STAT_FILTER_FIELDS,
	isSortOrder,
	normalizeSortBy,
	type SortBy,
	type SortOrder,
	type StatLimitKey
} from '$lib/layoutStats';
import { isSimilarityMirrorMode, type SimilarityMirrorMode } from '$lib/layoutSimilarity';

export type { ViewFilterSnapshot } from '$lib/filterStore.svelte';

const ROWS = 3;
const COLS = 10;
const THUMB_KEYS_PER_HAND = 4;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyGrid(): string[][] {
	return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
}

function createEmptyThumbKeyFilters(): string[] {
	return Array.from({ length: THUMB_KEYS_PER_HAND }, () => '');
}

function createEmptyStatLimits(): Record<StatLimitKey, StatLimit> {
	const limits = {} as Record<StatLimitKey, StatLimit>;
	for (const field of ALL_STAT_FILTER_FIELDS) {
		limits[field.key] = { operator: 'lt', value: '' };
	}
	limits.likes = { operator: 'gt', value: '' };
	return limits;
}

function cloneGrid(grid: string[][]): string[][] {
	return grid.map((row) => [...row]);
}

function cloneStatLimits(limits: Record<StatLimitKey, StatLimit>): Record<StatLimitKey, StatLimit> {
	const clone = createEmptyStatLimits();
	for (const key of Object.keys(clone) as StatLimitKey[]) {
		clone[key] = { ...limits[key] };
	}
	return clone;
}

export function createDefaultViewSnapshot(): ViewFilterSnapshot {
	return {
		includeGrid: createEmptyGrid(),
		excludeGrid: createEmptyGrid(),
		includeOrGrid: createEmptyGrid(),
		includeOrLeftThumbKeys: createEmptyThumbKeyFilters(),
		includeOrRightThumbKeys: createEmptyThumbKeyFilters(),
		includeLeftThumbKeys: createEmptyThumbKeyFilters(),
		includeRightThumbKeys: createEmptyThumbKeyFilters(),
		excludeLeftThumbKeys: createEmptyThumbKeyFilters(),
		excludeRightThumbKeys: createEmptyThumbKeyFilters(),
		showUnfinished: false,
		thumbKeyFilter: 'optional',
		magicKeyFilter: 'optional',
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
		appliedIncludeGrid: createEmptyGrid(),
		appliedExcludeGrid: createEmptyGrid(),
		appliedIncludeOrGrid: createEmptyGrid(),
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
	if (!Array.isArray(value)) return cloneGrid(fallback);
	return Array.from({ length: ROWS }, (_, rowIndex) => {
		const row = value[rowIndex];
		return Array.from({ length: COLS }, (_, columnIndex) => {
			const cell = Array.isArray(row) ? row[columnIndex] : undefined;
			return typeof cell === 'string' ? cell : '';
		});
	});
}

function normalizeThumbKeys(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) return [...fallback];
	return Array.from({ length: THUMB_KEYS_PER_HAND }, (_, index) =>
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

function normalizeSortSnapshot(value: unknown): {
	sortBy: SortBy;
	sortOrder: SortOrder;
	sortOrderManual: boolean;
} | null {
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
			['optional', 'excluded', 'required'],
			defaults.magicKeyFilter
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
		similarReferenceName:
			typeof value.similarReferenceName === 'string'
				? value.similarReferenceName
				: defaults.similarReferenceName,
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
		sortBy:
			typeof value.sortBy === 'string'
				? (normalizeSortBy(value.sortBy) ?? defaults.sortBy)
				: defaults.sortBy,
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
