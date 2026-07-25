import type { CyanophageStatSortKey, Mana2StatSortKey, StatSortKey } from '$lib/statsDerivation';

/**
 * Prefixed Cyanophage filter keys (storage/URL) so limits never collide with cmini.
 * Map to derived stats via {@link StatFilterField.statKey}.
 */
export type CyanoStatLimitKey =
	| 'cyano-sfb'
	| 'cyano-sfs'
	| 'cyano-lh'
	| 'cyano-rh'
	| 'cyano-LI'
	| 'cyano-LM'
	| 'cyano-LR'
	| 'cyano-LP'
	| 'cyano-LT'
	| 'cyano-RI'
	| 'cyano-RM'
	| 'cyano-RR'
	| 'cyano-RP'
	| 'cyano-RT';

/**
 * Prefixed Mana2 filter keys (storage/URL) so limits never collide with cmini/Cyanophage.
 * Map to derived stats via {@link StatFilterField.statKey}.
 */
export type Mana2StatLimitKey =
	| 'mana-sfb'
	| 'mana-sfs'
	| 'mana-lsb'
	| 'mana-lss'
	| 'mana-vsb'
	| 'mana-vss'
	| 'mana-lh'
	| 'mana-rh'
	| 'mana-LI'
	| 'mana-LM'
	| 'mana-LR'
	| 'mana-LP'
	| 'mana-LT'
	| 'mana-RI'
	| 'mana-RM'
	| 'mana-RR'
	| 'mana-RP'
	| 'mana-RT'
	| 'mana-alt'
	| 'mana-roll'
	| 'mana-redirect';

/** Keys usable in stat limit filters (union of all analyzers plus likes). */
export type StatLimitKey =
	| StatSortKey
	| CyanophageStatSortKey
	| CyanoStatLimitKey
	| Mana2StatSortKey
	| Mana2StatLimitKey
	| 'likes';

export interface StatFilterField {
	key: StatLimitKey;
	label: string;
	/** Longer name for display labels when `label` is abbreviated. */
	title?: string;
	/** Short explanation shown next to the field in the general-stats modal. */
	hint?: string;
	/** How filter input values are interpreted. Defaults to percent (0–100). */
	unit?: 'percent' | 'raw';
	/**
	 * Property on derived analyzer stats used for comparison.
	 * Defaults to `key` when the storage key matches the stats property.
	 */
	statKey?: StatSortKey | CyanophageStatSortKey | Mana2StatSortKey;
}

/** Titled block of related general-stat filter rows. */
export interface GeneralStatFilterGroup {
	title: string;
	rows: readonly (readonly StatFilterField[])[];
}

export interface AnalyzerStatFilterCatalog {
	generalGroups: readonly GeneralStatFilterGroup[];
	generalFields: readonly StatFilterField[];
	leftHandFields: readonly StatFilterField[];
	rightHandFields: readonly StatFilterField[];
	handFields: readonly StatFilterField[];
	fields: readonly StatFilterField[];
}

export function flattenGeneralStatFilterGroups(
	groups: readonly GeneralStatFilterGroup[]
): StatFilterField[] {
	return groups.flatMap((group) => group.rows.flat());
}

export const LIKES_STAT_FILTER_FIELD = {
	key: 'likes',
	label: 'Likes',
	title: 'Likes',
	hint: 'Community like count for this layout on cmini.',
	unit: 'raw'
} as const satisfies StatFilterField;

/** Max related stats per general-stat row (matches layout card group width). */
export const GENERAL_STAT_FILTER_COLUMN_COUNT = 3;

/** Resolve the derived-stats property for a filter field. */
export function getStatFilterStatKey(
	field: StatFilterField
): StatSortKey | CyanophageStatSortKey | Mana2StatSortKey | 'likes' {
	if (field.key === 'likes') return 'likes';
	return field.statKey ?? (field.key as StatSortKey | CyanophageStatSortKey | Mana2StatSortKey);
}

/** Parse a stat filter input value for comparison against stored stats. */
export function parseStatFilterThreshold(field: StatFilterField, value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed)) return null;
	return field.unit === 'raw' ? parsed : parsed / 100;
}
