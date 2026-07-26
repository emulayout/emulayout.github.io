import { ALL_STAT_FILTER_FIELDS, type StatLimitKey } from './statsFiltering';
import { getDefaultSortOrder, isSortOrder, normalizeSortBy } from './statsSorting';
import { isSimilarityMirrorMode } from './layoutSimilarity';
import { sortLayoutSourceNames } from './savedFiltersStorage';
import {
	FILTER_GRID_COLUMNS,
	FILTER_GRID_ROWS,
	FILTER_THUMB_KEYS_PER_HAND,
	createDefaultViewSnapshot,
	createEmptyFilterGrid,
	createEmptyStatLimits,
	createEmptyThumbKeyFilters,
	normalizeViewSortBy,
	type StatLimit,
	type ViewFilterSnapshot
} from './filterSnapshot';

/** Canonical view-owned filter parameters. */
export const VIEW_FILTER_URL_PARAMS = [
	'include',
	'exclude',
	'includeOr',
	'showUnfinished',
	'thumbKeys',
	'magicKey',
	'characterSet',
	'boardType',
	'name',
	'authors',
	'includeLeftThumbs',
	'includeRightThumbs',
	'excludeLeftThumbs',
	'excludeRightThumbs',
	'includeOrLeftThumbs',
	'includeOrRightThumbs',
	'sort',
	'order',
	'similar',
	'similarFilter',
	'similarHome',
	'similarAnglemod',
	'similarMirror',
	'statLimits'
] as const;

export function serializeStatLimits(limits: Record<StatLimitKey, StatLimit>): string {
	const parts: string[] = [];
	for (const field of ALL_STAT_FILTER_FIELDS) {
		const limit = limits[field.key];
		const value = limit.value.trim();
		if (!value) continue;
		parts.push(`${field.key}:${limit.operator}:${value}`);
	}
	return parts.join(',');
}

export function deserializeStatLimits(str: string): Record<StatLimitKey, StatLimit> {
	const limits = createEmptyStatLimits();
	if (!str) return limits;

	for (const part of str.split(',')) {
		const [key, operator, ...valueParts] = part.split(':');
		if (!key || !operator || valueParts.length === 0) continue;
		if (!(key in limits)) continue;
		if (operator !== 'lt' && operator !== 'gt') continue;
		limits[key as StatLimitKey] = {
			operator,
			value: valueParts.join(':')
		};
	}
	return limits;
}

/** Parse a `statLimits` URL param into a limits record (empty values when absent). */
export function parseStatLimitsParam(
	str: string | null | undefined
): Record<StatLimitKey, StatLimit> {
	return deserializeStatLimits(str?.trim() ?? '');
}

export function serializeThumbFilters(filters: string[]): string {
	return filters.filter((key) => key !== '').join('|');
}

export function deserializeThumbFilters(value: string | null | undefined): string[] {
	return value
		? [...value.split('|'), ...createEmptyThumbKeyFilters()].slice(0, FILTER_THUMB_KEYS_PER_HAND)
		: createEmptyThumbKeyFilters();
}

/** Replace view-owned filter parameters while preserving unrelated URL state. */
export function writeViewFilterUrlState(
	params: URLSearchParams,
	snapshot: ViewFilterSnapshot
): void {
	for (const key of VIEW_FILTER_URL_PARAMS) {
		params.delete(key);
	}

	const includeSerialized = serializeGrid(snapshot.appliedIncludeGrid);
	if (includeSerialized) params.set('include', includeSerialized);

	const excludeSerialized = serializeGrid(snapshot.appliedExcludeGrid);
	if (excludeSerialized) params.set('exclude', excludeSerialized);

	if (snapshot.showUnfinished) params.set('showUnfinished', '1');
	if (snapshot.thumbKeyFilter !== 'optional') params.set('thumbKeys', snapshot.thumbKeyFilter);
	if (snapshot.magicKeyFilter !== 'optional') params.set('magicKey', snapshot.magicKeyFilter);
	if (snapshot.characterSetFilter !== 'english') {
		params.set('characterSet', snapshot.characterSetFilter);
	}
	if (snapshot.boardTypeFilter !== 'all') params.set('boardType', snapshot.boardTypeFilter);
	if (snapshot.nameFilter) params.set('name', snapshot.nameFilter);
	if (snapshot.selectedAuthors.length > 0) {
		params.set('authors', snapshot.selectedAuthors.join(','));
	}

	const includeLeftThumbsSerialized = serializeThumbFilters(snapshot.appliedIncludeLeftThumbKeys);
	if (includeLeftThumbsSerialized) params.set('includeLeftThumbs', includeLeftThumbsSerialized);

	const includeRightThumbsSerialized = serializeThumbFilters(snapshot.appliedIncludeRightThumbKeys);
	if (includeRightThumbsSerialized) params.set('includeRightThumbs', includeRightThumbsSerialized);

	const excludeLeftThumbsSerialized = serializeThumbFilters(snapshot.appliedExcludeLeftThumbKeys);
	if (excludeLeftThumbsSerialized) params.set('excludeLeftThumbs', excludeLeftThumbsSerialized);

	const excludeRightThumbsSerialized = serializeThumbFilters(snapshot.appliedExcludeRightThumbKeys);
	if (excludeRightThumbsSerialized) params.set('excludeRightThumbs', excludeRightThumbsSerialized);

	const includeOrSerialized = serializeGrid(snapshot.appliedIncludeOrGrid);
	if (includeOrSerialized) params.set('includeOr', includeOrSerialized);

	const includeOrLeftThumbsSerialized = serializeThumbFilters(
		snapshot.appliedIncludeOrLeftThumbKeys
	);
	if (includeOrLeftThumbsSerialized) {
		params.set('includeOrLeftThumbs', includeOrLeftThumbsSerialized);
	}

	const includeOrRightThumbsSerialized = serializeThumbFilters(
		snapshot.appliedIncludeOrRightThumbKeys
	);
	if (includeOrRightThumbsSerialized) {
		params.set('includeOrRightThumbs', includeOrRightThumbsSerialized);
	}

	const sortBy = normalizeViewSortBy(snapshot.sortBy, snapshot.similarReferenceName);
	if (sortBy !== 'date' || snapshot.sortOrder !== 'desc' || snapshot.similarReferenceName) {
		params.set('sort', sortBy);
		params.set('order', snapshot.sortOrder);
	}

	if (snapshot.similarReferenceName) {
		params.set('similar', snapshot.similarReferenceName);
		params.set(
			'similarFilter',
			`${snapshot.similarityFilterOperator}:${snapshot.appliedSimilarityFilterValue.trim()}`
		);
		if (snapshot.similarityWeightHomeKeys) params.set('similarHome', '1');
		if (snapshot.similarReferenceAnglemod) params.set('similarAnglemod', '1');
		if (snapshot.similarityMirrorMode !== 'excluded') {
			params.set('similarMirror', snapshot.similarityMirrorMode);
		}
	}

	const statLimitsSerialized = serializeStatLimits(snapshot.appliedStatLimits);
	if (statLimitsSerialized) params.set('statLimits', statLimitsSerialized);
}

/** Compact query-string encoding of a view snapshot (shareable; not global URL state). */
export function encodeViewFilterSnapshot(
	snapshot: ViewFilterSnapshot,
	options?: { sourceLayoutNames?: string[] }
): string {
	const params = new URLSearchParams();
	writeViewFilterUrlState(params, snapshot);

	if (options?.sourceLayoutNames && options.sourceLayoutNames.length > 0) {
		params.set('layouts', sortLayoutSourceNames(options.sourceLayoutNames).join(','));
	}

	return params.toString();
}

export type DecodedViewFilters = {
	snapshot: ViewFilterSnapshot;
	/** `undefined` = absent, `null` = explicitly empty, array = explicit source. */
	sourceLayoutNames?: string[] | null;
};

/** Read canonical view-owned filter parameters into a full snapshot. */
export function readViewFilterUrlState(params: URLSearchParams): DecodedViewFilters {
	const snapshot = createDefaultViewSnapshot();

	const include = params.get('include');
	if (include) {
		snapshot.includeGrid = deserializeGrid(include);
		snapshot.appliedIncludeGrid = deserializeGrid(include);
	}

	const exclude = params.get('exclude');
	if (exclude) {
		snapshot.excludeGrid = deserializeGrid(exclude);
		snapshot.appliedExcludeGrid = deserializeGrid(exclude);
	}

	if (params.get('showUnfinished') === '1') snapshot.showUnfinished = true;

	const thumbKeys = params.get('thumbKeys');
	if (thumbKeys === 'excluded' || thumbKeys === 'required' || thumbKeys === 'optional') {
		snapshot.thumbKeyFilter = thumbKeys;
	}

	const magicKey = params.get('magicKey');
	if (magicKey === 'excluded' || magicKey === 'required' || magicKey === 'optional') {
		snapshot.magicKeyFilter = magicKey;
	}

	const characterSet = params.get('characterSet');
	if (characterSet === 'all' || characterSet === 'english' || characterSet === 'international') {
		snapshot.characterSetFilter = characterSet;
	}

	const boardType = params.get('boardType');
	if (
		boardType === 'all' ||
		boardType === 'angle' ||
		boardType === 'stagger' ||
		boardType === 'angle-stagger' ||
		boardType === 'ortho' ||
		boardType === 'mini'
	) {
		snapshot.boardTypeFilter = boardType;
	}

	const name = params.get('name');
	if (name) {
		snapshot.nameFilterInput = name;
		snapshot.nameFilter = name;
	}

	const authors = params.get('authors');
	if (authors) {
		snapshot.selectedAuthors = authors
			.split(',')
			.map(Number)
			.filter((id) => Number.isFinite(id));
	}

	const includeLeftThumbs = params.get('includeLeftThumbs');
	if (includeLeftThumbs) {
		snapshot.includeLeftThumbKeys = deserializeThumbFilters(includeLeftThumbs);
		snapshot.appliedIncludeLeftThumbKeys = deserializeThumbFilters(includeLeftThumbs);
	}

	const includeRightThumbs = params.get('includeRightThumbs');
	if (includeRightThumbs) {
		snapshot.includeRightThumbKeys = deserializeThumbFilters(includeRightThumbs);
		snapshot.appliedIncludeRightThumbKeys = deserializeThumbFilters(includeRightThumbs);
	}

	const excludeLeftThumbs = params.get('excludeLeftThumbs');
	if (excludeLeftThumbs) {
		snapshot.excludeLeftThumbKeys = deserializeThumbFilters(excludeLeftThumbs);
		snapshot.appliedExcludeLeftThumbKeys = deserializeThumbFilters(excludeLeftThumbs);
	}

	const excludeRightThumbs = params.get('excludeRightThumbs');
	if (excludeRightThumbs) {
		snapshot.excludeRightThumbKeys = deserializeThumbFilters(excludeRightThumbs);
		snapshot.appliedExcludeRightThumbKeys = deserializeThumbFilters(excludeRightThumbs);
	}

	const includeOr = params.get('includeOr');
	if (includeOr) {
		snapshot.includeOrGrid = deserializeGrid(includeOr);
		snapshot.appliedIncludeOrGrid = deserializeGrid(includeOr);
	}

	const includeOrLeftThumbs = params.get('includeOrLeftThumbs');
	if (includeOrLeftThumbs) {
		snapshot.includeOrLeftThumbKeys = deserializeThumbFilters(includeOrLeftThumbs);
		snapshot.appliedIncludeOrLeftThumbKeys = deserializeThumbFilters(includeOrLeftThumbs);
	}

	const includeOrRightThumbs = params.get('includeOrRightThumbs');
	if (includeOrRightThumbs) {
		snapshot.includeOrRightThumbKeys = deserializeThumbFilters(includeOrRightThumbs);
		snapshot.appliedIncludeOrRightThumbKeys = deserializeThumbFilters(includeOrRightThumbs);
	}

	const sort = params.get('sort');
	const order = params.get('order');
	const normalizedSort = sort ? normalizeSortBy(sort) : undefined;
	const normalizedOrder = order && isSortOrder(order) ? order : undefined;
	if (normalizedSort) {
		snapshot.sortBy = normalizedSort;
		snapshot.sortOrder = getDefaultSortOrder(normalizedSort);
	}
	if (normalizedOrder) {
		snapshot.sortOrder = normalizedOrder;
		snapshot.sortOrderManual = normalizedOrder !== getDefaultSortOrder(snapshot.sortBy);
	}

	const similar = params.get('similar');
	if (similar) {
		snapshot.similarReferenceName = similar;
		if (!normalizedSort) {
			snapshot.sortBy = 'similarity';
			if (!normalizedOrder) snapshot.sortOrder = getDefaultSortOrder('similarity');
		}
		const similarFilter = params.get('similarFilter');
		if (similarFilter) {
			const [operator, ...valueParts] = similarFilter.split(':');
			if (operator === 'lt' || operator === 'gt') {
				snapshot.similarityFilterOperator = operator;
				const value = valueParts.join(':');
				snapshot.similarityFilterValue = value;
				snapshot.appliedSimilarityFilterValue = value;
			}
		}
		if (params.get('similarHome') === '1') snapshot.similarityWeightHomeKeys = true;
		if (params.get('similarAnglemod') === '1') snapshot.similarReferenceAnglemod = true;
		const similarMirror = params.get('similarMirror');
		if (similarMirror && isSimilarityMirrorMode(similarMirror)) {
			snapshot.similarityMirrorMode = similarMirror;
		}
	}
	snapshot.sortBy = normalizeViewSortBy(snapshot.sortBy, snapshot.similarReferenceName);

	const statLimits = params.get('statLimits');
	if (statLimits) {
		snapshot.statLimits = deserializeStatLimits(statLimits);
		snapshot.appliedStatLimits = deserializeStatLimits(statLimits);
	}

	const layoutsParam = params.get('layouts');
	const sourceLayoutNames =
		layoutsParam === null
			? undefined
			: layoutsParam.trim() === ''
				? null
				: sortLayoutSourceNames(
						layoutsParam
							.split(',')
							.map((name) => name.trim())
							.filter((name) => name.length > 0)
					);

	return {
		snapshot,
		...(sourceLayoutNames !== undefined ? { sourceLayoutNames } : {})
	};
}

/** Decode a share `viewFilters` payload into a full view snapshot (+ optional layout source). */
export function decodeViewFilterSnapshot(encoded: string): DecodedViewFilters {
	return readViewFilterUrlState(new URLSearchParams(encoded));
}

// Serialize grid to compact string: "r0c0,r0c1,r1c2" for non-empty cells.
export function serializeGrid(grid: string[][]): string {
	const parts: string[] = [];
	for (let row = 0; row < FILTER_GRID_ROWS; row++) {
		for (let column = 0; column < FILTER_GRID_COLUMNS; column++) {
			const character = grid[row][column];
			if (character) {
				parts.push(`${row}${column}${character}`);
			}
		}
	}
	return parts.join(',');
}

export function deserializeGrid(str: string): string[][] {
	const grid = createEmptyFilterGrid();
	if (!str) return grid;

	for (const part of str.split(',')) {
		if (part.length < 3) continue;
		const row = Number.parseInt(part[0], 10);
		const column = Number.parseInt(part[1], 10);
		const character = part.slice(2);
		if (row >= 0 && row < FILTER_GRID_ROWS && column >= 0 && column < FILTER_GRID_COLUMNS) {
			grid[row][column] = character;
		}
	}
	return grid;
}
