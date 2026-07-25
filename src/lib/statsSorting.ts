import {
	CYANOPHAGE_ANALYZER,
	CMINI_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	MANA2_ANALYZER,
	concreteAnalyzerForSort,
	type StatsAnalyzer,
	type StatsAnalyzerMode
} from '$lib/statsAnalyzers';
import type { CyanophageStatSortKey, Mana2StatSortKey, StatSortKey } from '$lib/statsDerivation';

export type SortOrder = 'asc' | 'desc';

export interface StatSortField {
	value: string;
	label: string;
	key: StatSortKey | CyanophageStatSortKey | Mana2StatSortKey;
	analyzer: StatsAnalyzer;
	/** Default order when this Sort-by field is selected. */
	defaultOrder: SortOrder;
	/**
	 * Whether higher values are better for compare highlighting.
	 * `null` = balance metric (not ranked higher/lower).
	 */
	higherIsBetter: boolean | null;
}

/** Sortable Cyanophage stats — values are `cyano-*` so they never collide with cmini. */
export const CYANOPHAGE_STAT_SORT_FIELDS = [
	{
		value: 'cyano-total-word-effort',
		label: 'Total Word Effort',
		key: 'totalWordEffort',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-effort',
		label: 'Effort',
		key: 'effort',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-sfb',
		label: 'Same Finger Bigrams',
		key: 'sfb',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-sfs',
		label: 'Skip Bigrams',
		key: 'sfs',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-scissors',
		label: 'Scissors',
		key: 'scissors',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-lsb',
		label: 'Lat Stretch Bigrams',
		key: 'lsb',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'cyano-lh',
		label: 'Left hand',
		key: 'lh',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	},
	{
		value: 'cyano-rh',
		label: 'Right hand',
		key: 'rh',
		analyzer: CYANOPHAGE_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	}
] as const satisfies readonly StatSortField[];

/** Sortable Mana2 stats — values are `mana-*` when they would collide with cmini/Cyanophage. */
export const MANA2_STAT_SORT_FIELDS = [
	{
		value: 'mana-sfb',
		label: 'Same Finger (bigram)',
		key: 'sfb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-sfs',
		label: 'Same Finger (skip)',
		key: 'sfs',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-skb',
		label: 'Same Key (bigram)',
		key: 'skb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-sks',
		label: 'Same Key (skip)',
		key: 'sks',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-lsb',
		label: 'Stretch (bigram)',
		key: 'lsb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-vsb',
		label: 'Scissor (bigram)',
		key: 'vsb',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-alt',
		label: 'Alternation',
		key: 'alt',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'mana-redirect',
		label: 'Redirect',
		key: 'redirect',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'mana-roll',
		label: 'Roll',
		key: 'roll',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'mana-lh',
		label: 'Left hand',
		key: 'lh',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	},
	{
		value: 'mana-rh',
		label: 'Right hand',
		key: 'rh',
		analyzer: MANA2_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: null
	}
] as const satisfies readonly StatSortField[];

/** Sortable cmini stats. */
export const STAT_SORT_FIELDS = [
	{
		value: 'alternate',
		label: 'Alternate',
		key: 'alternate',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll',
		label: 'Roll',
		key: 'roll',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-in',
		label: 'Roll in',
		key: 'rollIn',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-out',
		label: 'Roll out',
		key: 'rollOut',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'one',
		label: 'One-hand',
		key: 'one',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'one-in',
		label: 'One-hand in',
		key: 'oneIn',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'one-out',
		label: 'One-hand out',
		key: 'oneOut',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-total',
		label: 'Roll total',
		key: 'rtl',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-total-in',
		label: 'Roll total in',
		key: 'rtlIn',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'roll-total-out',
		label: 'Roll total out',
		key: 'rtlOut',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'desc',
		higherIsBetter: true
	},
	{
		value: 'redirect',
		label: 'Redirect',
		key: 'red',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'bad-redirect',
		label: 'Bad redirect',
		key: 'badRedirect',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'sfb',
		label: 'Same-finger bigrams',
		key: 'sfb',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'same-finger-skip',
		label: 'Same-finger skip',
		key: 'sfs',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'same-finger-skip-redirect',
		label: 'Same-finger skip redirect',
		key: 'dsfbRed',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	},
	{
		value: 'same-finger-skip-alternate',
		label: 'Same-finger skip alternate',
		key: 'dsfbAlt',
		analyzer: CMINI_ANALYZER,
		defaultOrder: 'asc',
		higherIsBetter: false
	}
] as const satisfies readonly StatSortField[];

const ALL_STAT_SORT_FIELDS = [
	...STAT_SORT_FIELDS,
	...CYANOPHAGE_STAT_SORT_FIELDS,
	...MANA2_STAT_SORT_FIELDS
] as const;

export type StatSortBy = (typeof ALL_STAT_SORT_FIELDS)[number]['value'];
export type LayoutSortBy = 'name' | 'date' | 'likes' | 'similarity';
export type SortBy = LayoutSortBy | StatSortBy;

const STAT_SORT_FIELD_BY_VALUE = new Map<string, StatSortField>(
	ALL_STAT_SORT_FIELDS.map((field) => [field.value, field])
);

const SORT_BY_VALUES = new Set<string>([
	'name',
	'date',
	'likes',
	'similarity',
	...ALL_STAT_SORT_FIELDS.map((field) => field.value)
]);

/** Layout-level Sort-by defaults (not tied to a StatSortField). */
const LAYOUT_DEFAULT_SORT_ORDER: Record<LayoutSortBy, SortOrder> = {
	name: 'asc',
	date: 'desc',
	likes: 'desc',
	similarity: 'desc'
};

/**
 * Pre-`cyano-*` URL values and other renames → current SortBy.
 * Ambiguous `sfb` is handled in {@link normalizeSortBy}.
 */
const SORT_BY_ALIASES: Record<string, SortBy> = {
	'total-word-effort': 'cyano-total-word-effort',
	effort: 'cyano-effort',
	sfs: 'cyano-sfs',
	scissors: 'cyano-scissors',
	lsb: 'cyano-lsb',
	lh: 'cyano-lh',
	rh: 'cyano-rh'
};

const LEGACY_SORT_BY_ORDER: Record<string, { sortBy: SortBy; sortOrder: SortOrder }> = {
	name: { sortBy: 'name', sortOrder: 'asc' },
	'date-asc': { sortBy: 'date', sortOrder: 'asc' },
	'date-desc': { sortBy: 'date', sortOrder: 'desc' },
	'likes-desc': { sortBy: 'likes', sortOrder: 'desc' },
	'alternate-desc': { sortBy: 'alternate', sortOrder: 'desc' },
	'roll-desc': { sortBy: 'roll', sortOrder: 'desc' },
	'roll-in-desc': { sortBy: 'roll-in', sortOrder: 'desc' },
	'roll-out-desc': { sortBy: 'roll-out', sortOrder: 'desc' },
	'one-desc': { sortBy: 'one', sortOrder: 'desc' },
	'one-in-desc': { sortBy: 'one-in', sortOrder: 'desc' },
	'one-out-desc': { sortBy: 'one-out', sortOrder: 'desc' },
	'rtl-desc': { sortBy: 'roll-total', sortOrder: 'desc' },
	'rtl-in-desc': { sortBy: 'roll-total-in', sortOrder: 'desc' },
	'rtl-out-desc': { sortBy: 'roll-total-out', sortOrder: 'desc' },
	'red-asc': { sortBy: 'redirect', sortOrder: 'asc' },
	'bad-redirect-asc': { sortBy: 'bad-redirect', sortOrder: 'asc' },
	'sfb-asc': { sortBy: 'sfb', sortOrder: 'asc' },
	'sfs-asc': { sortBy: 'same-finger-skip', sortOrder: 'asc' },
	'dsfb-red-asc': { sortBy: 'same-finger-skip-redirect', sortOrder: 'asc' },
	'dsfb-alt-asc': { sortBy: 'same-finger-skip-alternate', sortOrder: 'asc' }
};

export function isSortBy(value: string): value is SortBy {
	return SORT_BY_VALUES.has(value);
}

export function isSortOrder(value: string): value is SortOrder {
	return value === 'asc' || value === 'desc';
}

/**
 * Default order for a Sort-by field.
 * Prefer {@link StatSortField.defaultOrder} for stats; layout fields use fixed defaults.
 */
export function getDefaultSortOrder(sortBy: SortBy): SortOrder {
	const statField = STAT_SORT_FIELD_BY_VALUE.get(sortBy);
	if (statField) return statField.defaultOrder;
	if (sortBy in LAYOUT_DEFAULT_SORT_ORDER) {
		return LAYOUT_DEFAULT_SORT_ORDER[sortBy as LayoutSortBy];
	}
	return 'asc';
}

export function isStatSortBy(sortBy: SortBy): sortBy is StatSortBy {
	return STAT_SORT_FIELD_BY_VALUE.has(sortBy);
}

/**
 * Resolve a sort field. Values are unique per analyzer (Cyanophage uses `cyano-*`).
 * Pass `analyzer` to require a match for that analyzer.
 */
export function getStatSortField(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatSortField | undefined {
	const field = STAT_SORT_FIELD_BY_VALUE.get(sortBy);
	if (!field) return undefined;
	if (analyzer && field.analyzer !== analyzer) return undefined;
	return field;
}

export function getStatSortAnalyzer(
	sortBy: SortBy,
	analyzer?: StatsAnalyzer
): StatsAnalyzer | undefined {
	return getStatSortField(sortBy, analyzer)?.analyzer ?? getStatSortField(sortBy)?.analyzer;
}

export function getStatSortFieldsForAnalyzer(analyzer: StatsAnalyzer): readonly StatSortField[] {
	return ALL_STAT_SORT_FIELDS.filter((field) => field.analyzer === analyzer);
}

/** All analyzer sort fields (display mode does not restrict sort options). */
export function getStatSortFieldsForMode(mode?: StatsAnalyzerMode): readonly StatSortField[] {
	void mode;
	return ALL_STAT_SORT_FIELDS;
}

export function isStatSortByForAnalyzer(sortBy: SortBy, analyzer: StatsAnalyzer): boolean {
	return getStatSortField(sortBy, analyzer) !== undefined;
}

/**
 * Map a Sort-by to the equivalent field on another analyzer (same underlying `key`),
 * or `null` if there is no counterpart.
 */
export function coerceSortByForAnalyzer(sortBy: SortBy, analyzer: StatsAnalyzer): SortBy | null {
	if (!isStatSortBy(sortBy)) return sortBy;
	if (isStatSortByForAnalyzer(sortBy, analyzer)) return sortBy;
	const current = STAT_SORT_FIELD_BY_VALUE.get(sortBy);
	if (!current) return null;
	const match = ALL_STAT_SORT_FIELDS.find(
		(field) => field.analyzer === analyzer && field.key === current.key
	);
	return match ? (match.value as SortBy) : null;
}

/**
 * Normalize a URL/query sort token to a current {@link SortBy}.
 * Handles legacy combo params, pre-`cyano-*` values, and analyzer-disambiguated `sfb`.
 */
export function normalizeSortBy(
	sort: string,
	analyzer: StatsAnalyzerMode = DEFAULT_STATS_ANALYZER
): SortBy | undefined {
	const legacy = parseLegacySortParam(sort);
	if (legacy) return legacy.sortBy;

	if (sort === 'sfb') {
		const concrete = concreteAnalyzerForSort(analyzer);
		if (concrete === CYANOPHAGE_ANALYZER) return 'cyano-sfb';
		if (concrete === MANA2_ANALYZER) return 'mana-sfb';
		return 'sfb';
	}

	const aliased = SORT_BY_ALIASES[sort];
	if (aliased) return aliased;

	if (isSortBy(sort)) return sort;
	return undefined;
}

export function parseLegacySortParam(
	sort: string
): { sortBy: SortBy; sortOrder: SortOrder } | undefined {
	if (sort in LEGACY_SORT_BY_ORDER) {
		return LEGACY_SORT_BY_ORDER[sort];
	}
	return undefined;
}

/**
 * Whether higher values are better for a sortable stat key, or `null` when the
 * metric is not ranked (hand/finger balance, etc.).
 */
export function isHigherBetterStatKey(
	key: StatSortKey | CyanophageStatSortKey | Mana2StatSortKey,
	analyzer: StatsAnalyzer
): boolean | null {
	const field = ALL_STAT_SORT_FIELDS.find(
		(entry) => entry.key === key && entry.analyzer === analyzer
	);
	return field?.higherIsBetter ?? null;
}
