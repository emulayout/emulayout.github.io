import type { LayoutSource } from '$lib/savedViews';
import type {
	AuthorId,
	CyanophageStats,
	LayoutData,
	LayoutLikesMap,
	Mana2Stats,
	CminiStats,
	StatsMaps
} from './layout';
import { positionSlotKey } from './layoutCodec';
import { deriveBotStats, deriveCyanophageStats, deriveMana2Stats } from './statsDerivation';
import { getStatSortField, isStatSortBy, type SortBy, type SortOrder } from './statsSorting';
import {
	getStatFilterFieldsForAnalyzer,
	getStatFilterStatKey,
	parseStatFilterThreshold,
	type StatLimitKey
} from './statsFiltering';
import {
	CYANOPHAGE_ANALYZER,
	MANA2_ANALYZER,
	STAT_ANALYZERS,
	type StatsAnalyzer
} from './statsAnalyzers';
import {
	getLayoutAnalyzerStats,
	getStatSortValue,
	isAnalyzerStatsReady
} from './layoutStatsAccess';
import {
	FILTER_GRID_COLUMNS,
	FILTER_GRID_ROWS,
	FILTER_THUMB_KEYS_PER_HAND,
	type AdaptiveSwapFilter,
	type ChiralKeyFilter,
	type CharacterSetFilter,
	type MagicKeyFilter,
	type RepeatKeyFilter,
	type StatLimit,
	type StatLimitOperator,
	type ThumbKeyFilter
} from './filterSnapshot';
import {
	hasActiveFingerWorkloadPreference,
	matchesFingerWorkloadPreference,
	type FingerWorkloadConfig,
	type FingerWorkloadPreference
} from './fingerWorkload';

export interface LayoutFilterCriteria {
	layoutSource: LayoutSource;
	likedLayoutNames?: ReadonlySet<string>;
	selectedLayoutNames: ReadonlySet<string>;
	sourceLayoutNames: ReadonlySet<string> | null;
	showUnfinished: boolean;
	thumbKeyFilter: ThumbKeyFilter;
	repeatKeyFilter: RepeatKeyFilter;
	magicKeyFilter: MagicKeyFilter;
	adaptiveSwapFilter: AdaptiveSwapFilter;
	chiralKeyFilter: ChiralKeyFilter;
	characterSetFilter: CharacterSetFilter;
	nameFilter: string;
	selectedAuthors: ReadonlySet<AuthorId>;
	includeGrid: string[][];
	excludeGrid: string[][];
	includeOrGrid: string[][];
	includeOrLeftThumbKeys: string[];
	includeOrRightThumbKeys: string[];
	includeLeftThumbKeys: string[];
	includeRightThumbKeys: string[];
	excludeLeftThumbKeys: string[];
	excludeRightThumbKeys: string[];
	statLimits: Record<StatLimitKey, StatLimit>;
	fingerWorkload: FingerWorkloadConfig;
	canUseLikes: boolean;
}

export interface LayoutSortCriteria {
	sortBy: SortBy;
	sortOrder: SortOrder;
	nameFilter: string;
}

type ActiveAnalyzerStatFilters = {
	analyzer: StatsAnalyzer;
	checks: Array<{
		operator: StatLimitOperator;
		threshold: number;
		statKey: ReturnType<typeof getStatFilterStatKey>;
	}>;
	fingerWorkload: FingerWorkloadPreference | null;
};

type LikesLimitCheck = { operator: StatLimitOperator; threshold: number };

type GridCellFilter = { slotKey: string; chars: string };
type ThumbOrFilter = { slotIndex: number; chars: string };

function extractGridFilters(grid: string[][]): GridCellFilter[] {
	const cells: GridCellFilter[] = [];
	for (let row = 0; row < FILTER_GRID_ROWS; row++) {
		for (let column = 0; column < FILTER_GRID_COLUMNS; column++) {
			const chars = grid[row][column].toLowerCase();
			if (chars) cells.push({ slotKey: positionSlotKey(row, column), chars });
		}
	}
	return cells;
}

function extractThumbFilters(filter: string[]): string[] {
	return filter.map((entry) => entry.toLowerCase()).filter((chars) => chars !== '');
}

function extractThumbOrFilters(filter: string[]): ThumbOrFilter[] {
	const entries: ThumbOrFilter[] = [];
	for (let index = 0; index < FILTER_THUMB_KEYS_PER_HAND; index++) {
		const chars = filter[index].toLowerCase();
		if (chars) entries.push({ slotIndex: index, chars });
	}
	return entries;
}

/** Match non-empty lowercased thumb filters in left-to-right order. */
function matchesNormalizedThumbKeyPosition(
	thumbKeys: Array<{ key: string; col: number }>,
	nonEmptyFilters: readonly string[]
): boolean {
	if (nonEmptyFilters.length === 0) return true;
	if (thumbKeys.length < nonEmptyFilters.length) return false;

	const orderedThumbs = [...thumbKeys].sort((a, b) => a.col - b.col);
	let previousCol = -Infinity;
	for (const filterChars of nonEmptyFilters) {
		const match = orderedThumbs.find(
			(thumbKey) => thumbKey.col > previousCol && filterChars.includes(thumbKey.key.toLowerCase())
		);
		if (!match) return false;
		previousCol = match.col;
	}

	return true;
}

function matchesInclude(
	layout: LayoutData,
	includeCells: readonly GridCellFilter[],
	includeLeftThumbs: readonly string[],
	includeRightThumbs: readonly string[]
): boolean {
	for (const { slotKey, chars } of includeCells) {
		const keyAtPosition = layout.positionBySlot.get(slotKey)?.toLowerCase();
		if (!keyAtPosition || !chars.includes(keyAtPosition)) return false;
	}

	if (
		includeLeftThumbs.length > 0 &&
		!matchesNormalizedThumbKeyPosition(layout.thumbKeysByHand.l, includeLeftThumbs)
	) {
		return false;
	}
	if (
		includeRightThumbs.length > 0 &&
		!matchesNormalizedThumbKeyPosition(layout.thumbKeysByHand.r, includeRightThumbs)
	) {
		return false;
	}
	return true;
}

function matchesIncludeOr(
	layout: LayoutData,
	includeOrCells: readonly GridCellFilter[],
	includeOrLeftThumbs: readonly ThumbOrFilter[],
	includeOrRightThumbs: readonly ThumbOrFilter[]
): boolean {
	if (
		includeOrCells.length === 0 &&
		includeOrLeftThumbs.length === 0 &&
		includeOrRightThumbs.length === 0
	) {
		return true;
	}

	for (const { slotKey, chars } of includeOrCells) {
		const keyAtPosition = layout.positionBySlot.get(slotKey)?.toLowerCase();
		if (keyAtPosition && chars.includes(keyAtPosition)) return true;
	}

	for (const { chars } of includeOrLeftThumbs) {
		if (matchesNormalizedThumbKeyPosition(layout.thumbKeysByHand.l, [chars])) return true;
	}

	for (const { chars } of includeOrRightThumbs) {
		if (matchesNormalizedThumbKeyPosition(layout.thumbKeysByHand.r, [chars])) return true;
	}

	return false;
}

function matchesExclude(
	layout: LayoutData,
	excludeCells: readonly GridCellFilter[],
	excludeLeftThumbs: readonly string[],
	excludeRightThumbs: readonly string[]
): boolean {
	for (const { slotKey, chars } of excludeCells) {
		const keyAtPosition = layout.positionBySlot.get(slotKey)?.toLowerCase();
		if (keyAtPosition && chars.includes(keyAtPosition)) return false;
	}

	if (
		excludeLeftThumbs.length > 0 &&
		matchesNormalizedThumbKeyPosition(layout.thumbKeysByHand.l, excludeLeftThumbs)
	) {
		return false;
	}
	if (
		excludeRightThumbs.length > 0 &&
		matchesNormalizedThumbKeyPosition(layout.thumbKeysByHand.r, excludeRightThumbs)
	) {
		return false;
	}
	return true;
}

function parseNameTerms(nameFilter: string): string[] {
	return nameFilter
		.split(',')
		.map((term) => term.trim().toLowerCase())
		.filter(Boolean);
}

function matchesName(layout: LayoutData, nameTerms: string[]): boolean {
	if (nameTerms.length === 0) return true;
	const name = layout.name.toLowerCase();
	return nameTerms.some((term) => name.includes(term));
}

function getNameSearchRank(layout: LayoutData, nameTerms: string[]): number {
	if (nameTerms.length === 0) return 0;

	const name = layout.name.toLowerCase();
	let best = 2;
	for (const term of nameTerms) {
		if (!name.includes(term)) continue;
		if (name === term) return 0;
		if (name.startsWith(term)) best = Math.min(best, 1);
	}
	return best;
}

function matchesMagicKeyFilter(layout: LayoutData, filter: MagicKeyFilter): boolean {
	if (filter === 'optional') return true;
	if (filter === 'required') return layout.hasMagicKey;
	return !layout.hasMagicKey;
}

function matchesRepeatKeyFilter(layout: LayoutData, filter: RepeatKeyFilter): boolean {
	if (filter === 'optional') return true;
	return filter === 'required' ? layout.hasRepeatKey : !layout.hasRepeatKey;
}

function matchesAdaptiveSwapFilter(layout: LayoutData, filter: AdaptiveSwapFilter): boolean {
	if (filter === 'optional') return true;
	if (filter === 'required') return layout.hasAdaptiveSwap;
	return !layout.hasAdaptiveSwap;
}
function matchesChiralKeyFilter(layout: LayoutData, filter: ChiralKeyFilter): boolean {
	if (filter === 'optional') return true;
	if (filter === 'required') return Boolean(layout.hasChiralKey);
	return !layout.hasChiralKey;
}

function matchesThumbKeyFilter(layout: LayoutData, filter: ThumbKeyFilter): boolean {
	if (filter === 'optional') return true;
	return filter === 'required' ? layout.hasThumbKeys : !layout.hasThumbKeys;
}

function matchesCharacterSet(layout: LayoutData, filter: CharacterSetFilter): boolean {
	return filter === 'all' || layout.characterSet === filter;
}

function buildActiveAnalyzerStatFilters(
	limits: Record<StatLimitKey, StatLimit>,
	fingerWorkloadConfig: FingerWorkloadConfig
): ActiveAnalyzerStatFilters[] {
	const active: ActiveAnalyzerStatFilters[] = [];

	for (const analyzer of STAT_ANALYZERS.map((entry) => entry.value)) {
		const checks: ActiveAnalyzerStatFilters['checks'] = [];
		for (const field of getStatFilterFieldsForAnalyzer(analyzer)) {
			const limit = limits[field.key];
			const threshold = parseStatFilterThreshold(field, limit.value);
			if (threshold === null) continue;
			checks.push({
				operator: limit.operator,
				threshold,
				statKey: getStatFilterStatKey(field)
			});
		}
		const fingerWorkload =
			fingerWorkloadConfig.analyzer === analyzer &&
			hasActiveFingerWorkloadPreference(fingerWorkloadConfig.preference)
				? fingerWorkloadConfig.preference
				: null;
		if (checks.length > 0 || fingerWorkload) active.push({ analyzer, checks, fingerWorkload });
	}

	return active;
}

function matchesStatLimits(
	layout: LayoutData,
	statsMaps: StatsMaps,
	likesData: LayoutLikesMap,
	activeFilters: ActiveAnalyzerStatFilters[],
	likesCheck: LikesLimitCheck | null
): boolean {
	if (activeFilters.length === 0 && !likesCheck) return true;

	for (const { analyzer, checks, fingerWorkload } of activeFilters) {
		const analyzerStats = getLayoutAnalyzerStats(statsMaps, layout.name, analyzer);
		if (!analyzerStats) return false;

		const stats =
			analyzer === CYANOPHAGE_ANALYZER
				? deriveCyanophageStats(analyzerStats as CyanophageStats)
				: analyzer === MANA2_ANALYZER
					? deriveMana2Stats(analyzerStats as Mana2Stats)
					: deriveBotStats(analyzerStats as CminiStats);

		for (const { operator, threshold, statKey } of checks) {
			const value = stats[statKey as keyof typeof stats];
			if (!Number.isFinite(value)) return false;
			if (operator === 'lt' && value > threshold) return false;
			if (operator === 'gt' && value < threshold) return false;
		}
		if (
			fingerWorkload &&
			!matchesFingerWorkloadPreference(stats as Record<string, number>, fingerWorkload)
		) {
			return false;
		}
	}

	if (likesCheck) {
		const value = likesData[layout.name] ?? 0;
		if (likesCheck.operator === 'lt' && value > likesCheck.threshold) return false;
		if (likesCheck.operator === 'gt' && value < likesCheck.threshold) return false;
	}

	return true;
}

export function filterLayouts(
	layouts: LayoutData[],
	criteria: LayoutFilterCriteria,
	statsMaps: StatsMaps = {},
	statsReady = false,
	likesData: LayoutLikesMap = {}
): LayoutData[] {
	const activeFilters = buildActiveAnalyzerStatFilters(
		criteria.statLimits,
		criteria.fingerWorkload
	);
	let likesCheck: LikesLimitCheck | null = null;
	if (criteria.canUseLikes) {
		const threshold = Number.parseFloat(criteria.statLimits.likes.value.trim());
		if (Number.isFinite(threshold)) {
			likesCheck = {
				operator: criteria.statLimits.likes.operator,
				threshold
			};
		}
	}

	if (
		activeFilters.length > 0 &&
		(!statsReady ||
			!activeFilters.every(({ analyzer }) => isAnalyzerStatsReady(statsMaps, analyzer)))
	) {
		return [];
	}

	const nameTerms = parseNameTerms(criteria.nameFilter);
	const includeCells = extractGridFilters(criteria.includeGrid);
	const includeLeftThumbs = extractThumbFilters(criteria.includeLeftThumbKeys);
	const includeRightThumbs = extractThumbFilters(criteria.includeRightThumbKeys);
	const excludeCells = extractGridFilters(criteria.excludeGrid);
	const excludeLeftThumbs = extractThumbFilters(criteria.excludeLeftThumbKeys);
	const excludeRightThumbs = extractThumbFilters(criteria.excludeRightThumbKeys);
	const includeOrCells = extractGridFilters(criteria.includeOrGrid);
	const includeOrLeftThumbs = extractThumbOrFilters(criteria.includeOrLeftThumbKeys);
	const includeOrRightThumbs = extractThumbOrFilters(criteria.includeOrRightThumbKeys);

	return layouts.filter((layout) => {
		if (criteria.layoutSource === 'liked' && !criteria.likedLayoutNames?.has(layout.name)) {
			return false;
		}
		if (criteria.layoutSource === 'selected' && !criteria.selectedLayoutNames.has(layout.name)) {
			return false;
		}
		if (criteria.sourceLayoutNames && !criteria.sourceLayoutNames.has(layout.name)) return false;
		if (
			!criteria.showUnfinished &&
			criteria.characterSetFilter !== 'international' &&
			!layout.hasAllLetters &&
			!layout.hasMagicKey &&
			!layout.hasRepeatKey
		) {
			return false;
		}
		if (!matchesThumbKeyFilter(layout, criteria.thumbKeyFilter)) return false;
		if (!matchesRepeatKeyFilter(layout, criteria.repeatKeyFilter)) return false;
		if (!matchesMagicKeyFilter(layout, criteria.magicKeyFilter)) return false;
		if (!matchesAdaptiveSwapFilter(layout, criteria.adaptiveSwapFilter)) return false;
		if (!matchesChiralKeyFilter(layout, criteria.chiralKeyFilter)) return false;
		if (!matchesCharacterSet(layout, criteria.characterSetFilter)) return false;
		if (!matchesName(layout, nameTerms)) return false;
		if (criteria.selectedAuthors.size > 0 && !criteria.selectedAuthors.has(layout.user)) {
			return false;
		}
		if (!matchesInclude(layout, includeCells, includeLeftThumbs, includeRightThumbs)) return false;
		if (!matchesExclude(layout, excludeCells, excludeLeftThumbs, excludeRightThumbs)) return false;
		if (!matchesIncludeOr(layout, includeOrCells, includeOrLeftThumbs, includeOrRightThumbs)) {
			return false;
		}
		return matchesStatLimits(layout, statsMaps, likesData, activeFilters, likesCheck);
	});
}

export function sortLayouts(
	layouts: LayoutData[],
	criteria: LayoutSortCriteria,
	statsMaps: StatsMaps = {},
	likesData: LayoutLikesMap = {}
): LayoutData[] {
	const sorted = [...layouts];
	const descending = criteria.sortOrder === 'desc';
	const statSort = isStatSortBy(criteria.sortBy) ? getStatSortField(criteria.sortBy) : undefined;

	if (statSort) {
		const values = new Map<string, number | null>();
		for (const layout of sorted) {
			values.set(layout.name, getStatSortValue(statsMaps, layout, criteria.sortBy));
		}

		return sorted.sort((a, b) => {
			const aValue = values.get(a.name) ?? null;
			const bValue = values.get(b.name) ?? null;

			if (aValue === null && bValue === null) return a.name.localeCompare(b.name);
			if (aValue === null) return 1;
			if (bValue === null) return -1;

			const difference = descending ? bValue - aValue : aValue - bValue;
			return difference !== 0 ? difference : a.name.localeCompare(b.name);
		});
	}

	const nameTerms = parseNameTerms(criteria.nameFilter);
	const nameRanks =
		nameTerms.length > 0
			? new Map(sorted.map((layout) => [layout.name, getNameSearchRank(layout, nameTerms)]))
			: null;
	const compareNameSearchRank = (a: LayoutData, b: LayoutData): number =>
		nameRanks ? (nameRanks.get(a.name) ?? 2) - (nameRanks.get(b.name) ?? 2) : 0;

	if (criteria.sortBy === 'date') {
		return sorted.sort((a, b) => {
			const byRank = compareNameSearchRank(a, b);
			if (byRank !== 0) return byRank;

			const byDate = a.updatedAt.localeCompare(b.updatedAt);
			const difference = descending ? -byDate : byDate;
			return difference !== 0 ? difference : a.name.localeCompare(b.name);
		});
	}

	if (criteria.sortBy === 'likes') {
		return sorted.sort((a, b) => {
			const byRank = compareNameSearchRank(a, b);
			if (byRank !== 0) return byRank;

			const aLikes = likesData[a.name] ?? 0;
			const bLikes = likesData[b.name] ?? 0;
			const difference = descending ? bLikes - aLikes : aLikes - bLikes;
			return difference !== 0 ? difference : a.name.localeCompare(b.name);
		});
	}

	return sorted.sort((a, b) => {
		const byRank = compareNameSearchRank(a, b);
		if (byRank !== 0) return byRank;

		const byName = a.name.localeCompare(b.name);
		return descending ? -byName : byName;
	});
}
