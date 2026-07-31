import type {
	CyanophageStats,
	LayoutData,
	LayoutLikesMap,
	Mana2Stats,
	CminiStats,
	StatsMaps,
	ThumbKeyEntry
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
	createEmptyThumbKeyFilters,
	type AdaptiveSwapFilter,
	type BoardTypeFilter,
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
	layoutSource: 'all' | 'selected';
	selectedLayoutNames: ReadonlySet<string>;
	sourceLayoutNames: ReadonlySet<string> | null;
	showUnfinished: boolean;
	thumbKeyFilter: ThumbKeyFilter;
	repeatKeyFilter: RepeatKeyFilter;
	magicKeyFilter: MagicKeyFilter;
	adaptiveSwapFilter: AdaptiveSwapFilter;
	characterSetFilter: CharacterSetFilter;
	boardTypeFilter: BoardTypeFilter;
	nameFilter: string;
	selectedAuthors: ReadonlySet<number>;
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

function getKeyAt(layout: LayoutData, row: number, column: number): string | undefined {
	return layout.positionBySlot.get(positionSlotKey(row, column));
}

/** Match non-empty thumb filters in left-to-right order. */
function matchesThumbKeyPosition(
	thumbKeys: Array<{ key: string; col: number }>,
	filter: string[]
): boolean {
	const nonEmptyFilters = filter
		.map((entry, index) => ({ chars: entry.toLowerCase(), position: index }))
		.filter((entry) => entry.chars !== '');

	if (nonEmptyFilters.length === 0) return true;

	const matches: Array<{ key: string; col: number; filterPosition: number }> = [];
	for (const filterEntry of nonEmptyFilters) {
		for (const thumbKey of thumbKeys) {
			if (filterEntry.chars.includes(thumbKey.key)) {
				matches.push({ ...thumbKey, filterPosition: filterEntry.position });
			}
		}
	}

	if (matches.length < nonEmptyFilters.length) return false;

	const columnsByFilterPosition: Record<number, number[]> = {};
	for (const match of matches) {
		columnsByFilterPosition[match.filterPosition] ??= [];
		columnsByFilterPosition[match.filterPosition].push(match.col);
	}

	for (const filterEntry of nonEmptyFilters) {
		if (!columnsByFilterPosition[filterEntry.position]?.length) return false;
	}

	for (let index = 0; index < nonEmptyFilters.length - 1; index++) {
		const currentColumns = columnsByFilterPosition[nonEmptyFilters[index].position];
		const nextColumns = columnsByFilterPosition[nonEmptyFilters[index + 1].position];
		if (Math.min(...currentColumns) >= Math.max(...nextColumns)) return false;
	}

	return true;
}

function matchesInclude(layout: LayoutData, criteria: LayoutFilterCriteria): boolean {
	for (let row = 0; row < FILTER_GRID_ROWS; row++) {
		for (let column = 0; column < FILTER_GRID_COLUMNS; column++) {
			const filterCharacters = criteria.includeGrid[row][column].toLowerCase();
			if (!filterCharacters) continue;
			const keyAtPosition = getKeyAt(layout, row, column)?.toLowerCase();
			if (!keyAtPosition || !filterCharacters.includes(keyAtPosition)) return false;
		}
	}

	if (
		criteria.includeLeftThumbKeys.some(Boolean) &&
		!matchesThumbKeyPosition(layout.thumbKeysByHand.l, criteria.includeLeftThumbKeys)
	) {
		return false;
	}
	if (
		criteria.includeRightThumbKeys.some(Boolean) &&
		!matchesThumbKeyPosition(layout.thumbKeysByHand.r, criteria.includeRightThumbKeys)
	) {
		return false;
	}
	return true;
}

function matchesThumbKeyAtSlot(
	thumbKeys: ThumbKeyEntry[],
	slotIndex: number,
	characters: string
): boolean {
	const filter = createEmptyThumbKeyFilters();
	filter[slotIndex] = characters;
	return matchesThumbKeyPosition(thumbKeys, filter);
}

function matchesIncludeOr(layout: LayoutData, criteria: LayoutFilterCriteria): boolean {
	const matches: boolean[] = [];

	for (let row = 0; row < FILTER_GRID_ROWS; row++) {
		for (let column = 0; column < FILTER_GRID_COLUMNS; column++) {
			const filterCharacters = criteria.includeOrGrid[row][column].toLowerCase();
			if (!filterCharacters) continue;
			const keyAtPosition = getKeyAt(layout, row, column)?.toLowerCase();
			matches.push(Boolean(keyAtPosition && filterCharacters.includes(keyAtPosition)));
		}
	}

	for (let index = 0; index < FILTER_THUMB_KEYS_PER_HAND; index++) {
		const filterCharacters = criteria.includeOrLeftThumbKeys[index].toLowerCase();
		if (!filterCharacters) continue;
		matches.push(matchesThumbKeyAtSlot(layout.thumbKeysByHand.l, index, filterCharacters));
	}

	for (let index = 0; index < FILTER_THUMB_KEYS_PER_HAND; index++) {
		const filterCharacters = criteria.includeOrRightThumbKeys[index].toLowerCase();
		if (!filterCharacters) continue;
		matches.push(matchesThumbKeyAtSlot(layout.thumbKeysByHand.r, index, filterCharacters));
	}

	return matches.length === 0 || matches.some(Boolean);
}

function matchesExclude(layout: LayoutData, criteria: LayoutFilterCriteria): boolean {
	for (let row = 0; row < FILTER_GRID_ROWS; row++) {
		for (let column = 0; column < FILTER_GRID_COLUMNS; column++) {
			const filterCharacters = criteria.excludeGrid[row][column].toLowerCase();
			if (!filterCharacters) continue;
			const keyAtPosition = getKeyAt(layout, row, column)?.toLowerCase();
			if (keyAtPosition && filterCharacters.includes(keyAtPosition)) return false;
		}
	}

	if (
		criteria.excludeLeftThumbKeys.some(Boolean) &&
		matchesThumbKeyPosition(layout.thumbKeysByHand.l, criteria.excludeLeftThumbKeys)
	) {
		return false;
	}
	if (
		criteria.excludeRightThumbKeys.some(Boolean) &&
		matchesThumbKeyPosition(layout.thumbKeysByHand.r, criteria.excludeRightThumbKeys)
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
	if (filter === 'required-mapped') return layout.hasMagicKey && layout.hasMagicKeyMappings;
	return !layout.hasMagicKey;
}

function matchesRepeatKeyFilter(layout: LayoutData, filter: RepeatKeyFilter): boolean {
	if (filter === 'optional') return true;
	return filter === 'required' ? layout.hasRepeatKey : !layout.hasRepeatKey;
}

function matchesAdaptiveSwapFilter(layout: LayoutData, filter: AdaptiveSwapFilter): boolean {
	if (filter === 'optional') return true;
	if (filter === 'required') return layout.hasAdaptiveSwap;
	if (filter === 'required-mapped') {
		return layout.hasAdaptiveSwap && layout.hasAdaptiveSwapMappings;
	}
	return !layout.hasAdaptiveSwap;
}

function matchesThumbKeyFilter(layout: LayoutData, filter: ThumbKeyFilter): boolean {
	if (filter === 'optional') return true;
	return filter === 'required' ? layout.hasThumbKeys : !layout.hasThumbKeys;
}

function matchesCharacterSet(layout: LayoutData, filter: CharacterSetFilter): boolean {
	return filter === 'all' || layout.characterSet === filter;
}

function matchesBoardType(layout: LayoutData, filter: BoardTypeFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'angle-stagger') {
		return layout.board === 'angle' || layout.board === 'stagger';
	}
	return layout.board === filter;
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
		const analyzerStats = getLayoutAnalyzerStats(
			statsMaps,
			layout.name,
			analyzer,
			layout.cyanophageCompatible
		);
		if (!analyzerStats) return false;

		const stats =
			analyzer === CYANOPHAGE_ANALYZER
				? deriveCyanophageStats(analyzerStats as CyanophageStats)
				: analyzer === MANA2_ANALYZER
					? deriveMana2Stats(analyzerStats as Mana2Stats)
					: deriveBotStats(analyzerStats as CminiStats);

		for (const { operator, threshold, statKey } of checks) {
			const value = stats[statKey as keyof typeof stats];
			if (operator === 'lt' && value >= threshold) return false;
			if (operator === 'gt' && value <= threshold) return false;
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
		if (likesCheck.operator === 'lt' && value >= likesCheck.threshold) return false;
		if (likesCheck.operator === 'gt' && value <= likesCheck.threshold) return false;
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
	return layouts.filter((layout) => {
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
		if (!matchesCharacterSet(layout, criteria.characterSetFilter)) return false;
		if (!matchesBoardType(layout, criteria.boardTypeFilter)) return false;
		if (!matchesName(layout, nameTerms)) return false;
		if (criteria.selectedAuthors.size > 0 && !criteria.selectedAuthors.has(layout.user)) {
			return false;
		}
		if (!matchesInclude(layout, criteria)) return false;
		if (!matchesExclude(layout, criteria)) return false;
		if (!matchesIncludeOr(layout, criteria)) return false;
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
	const compareNameSearchRank = (a: LayoutData, b: LayoutData): number =>
		getNameSearchRank(a, nameTerms) - getNameSearchRank(b, nameTerms);

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
