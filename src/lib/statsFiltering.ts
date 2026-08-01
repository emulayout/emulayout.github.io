import {
	CMINI_ANALYZER,
	CYANOPHAGE_ANALYZER,
	MANA2_ANALYZER,
	type StatsAnalyzer
} from '$lib/statsAnalyzers';
import { CMINI_STAT_FILTER_CATALOG, CMINI_STAT_FILTER_FIELDS } from '$lib/statFilters/cmini';
import {
	CYANOPHAGE_STAT_FILTER_CATALOG,
	CYANOPHAGE_STAT_FILTER_FIELDS
} from '$lib/statFilters/cyanophage';
import { MANA2_STAT_FILTER_CATALOG, MANA2_STAT_FILTER_FIELDS } from '$lib/statFilters/mana2';
import {
	LIKES_STAT_FILTER_FIELD,
	getStatFilterStatKey,
	type AnalyzerStatFilterCatalog,
	type GeneralStatFilterGroup,
	type StatFilterField,
	type StatLimitKey
} from '$lib/statFilters/shared';

export * from '$lib/statFilters/cmini';
export * from '$lib/statFilters/cyanophage';
export * from '$lib/statFilters/mana2';
export * from '$lib/statFilters/shared';

export type StatFilterSection = 'general' | 'hand-usage' | 'finger-usage';

const STAT_FILTER_CATALOG_BY_ANALYZER = {
	[CMINI_ANALYZER]: CMINI_STAT_FILTER_CATALOG,
	[CYANOPHAGE_ANALYZER]: CYANOPHAGE_STAT_FILTER_CATALOG,
	[MANA2_ANALYZER]: MANA2_STAT_FILTER_CATALOG
} satisfies Record<StatsAnalyzer, AnalyzerStatFilterCatalog>;

function uniqueStatFilterFields(fields: readonly StatFilterField[]): StatFilterField[] {
	const byKey = new Map<string, StatFilterField>();
	for (const field of fields) {
		if (!byKey.has(field.key)) byKey.set(field.key, field);
	}
	return [...byKey.values()];
}

/** All stat limit keys (all analyzers) — used for URL state and empty limit records. */
export const ALL_STAT_FILTER_FIELDS = uniqueStatFilterFields([
	...CMINI_STAT_FILTER_FIELDS,
	...CYANOPHAGE_STAT_FILTER_FIELDS,
	...MANA2_STAT_FILTER_FIELDS,
	LIKES_STAT_FILTER_FIELD
]);

export function getStatFilterCatalogForAnalyzer(
	analyzer: StatsAnalyzer
): AnalyzerStatFilterCatalog {
	return STAT_FILTER_CATALOG_BY_ANALYZER[analyzer];
}

export function getGeneralStatFilterGroupsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly GeneralStatFilterGroup[] {
	return getStatFilterCatalogForAnalyzer(analyzer).generalGroups;
}

/** Flat row list for iteration (chip summaries, snapshots, etc.). */
export function getGeneralStatFilterRowsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly (readonly StatFilterField[])[] {
	return getGeneralStatFilterGroupsForAnalyzer(analyzer).flatMap((group) => group.rows);
}

export function getLeftHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return getStatFilterCatalogForAnalyzer(analyzer).leftHandFields;
}

export function getRightHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return getStatFilterCatalogForAnalyzer(analyzer).rightHandFields;
}

export function getHandStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return getStatFilterCatalogForAnalyzer(analyzer).handFields;
}

export function getHandUsageStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	const catalog = getStatFilterCatalogForAnalyzer(analyzer);
	return [catalog.leftHandFields[0], catalog.rightHandFields[0]].filter(
		(field): field is StatFilterField => field !== undefined
	);
}

export function getLeftFingerUsageStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return getStatFilterCatalogForAnalyzer(analyzer).leftHandFields.slice(1);
}

export function getRightFingerUsageStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return getStatFilterCatalogForAnalyzer(analyzer).rightHandFields.slice(1);
}

export function getFingerUsageStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return [
		...getLeftFingerUsageStatFilterFieldsForAnalyzer(analyzer),
		...getRightFingerUsageStatFilterFieldsForAnalyzer(analyzer)
	];
}

export function getStatFilterFieldsForAnalyzer(
	analyzer: StatsAnalyzer
): readonly StatFilterField[] {
	return getStatFilterCatalogForAnalyzer(analyzer).fields;
}

export interface StatMetricFilterTarget {
	section: StatFilterSection;
	key: StatLimitKey;
}

/** Resolve a displayed analyzer metric to the filter control for the same derived stat. */
export function getStatMetricFilterTarget(
	analyzer: StatsAnalyzer,
	statKey: string
): StatMetricFilterTarget | null {
	const field = getStatFilterFieldsForAnalyzer(analyzer).find(
		(candidate) => getStatFilterStatKey(candidate) === statKey
	);
	if (!field) return null;

	if (getHandUsageStatFilterFieldsForAnalyzer(analyzer).some(({ key }) => key === field.key)) {
		return { section: 'hand-usage', key: field.key };
	}
	if (getFingerUsageStatFilterFieldsForAnalyzer(analyzer).some(({ key }) => key === field.key)) {
		return { section: 'finger-usage', key: field.key };
	}
	return { section: 'general', key: field.key };
}

type StatLimitValues = Partial<Record<StatLimitKey, { value: string }>>;

function hasActiveStatLimit(limits: StatLimitValues, fields: readonly StatFilterField[]): boolean {
	return fields.some((field) => limits[field.key]?.value.trim() !== '');
}

export function hasActiveStatFilterSection(
	limits: StatLimitValues,
	analyzer: StatsAnalyzer,
	section: StatFilterSection,
	options: { includeLikes?: boolean } = {}
): boolean {
	if (section === 'hand-usage') {
		return hasActiveStatLimit(limits, getHandUsageStatFilterFieldsForAnalyzer(analyzer));
	}

	if (section === 'finger-usage') {
		return hasActiveStatLimit(limits, getFingerUsageStatFilterFieldsForAnalyzer(analyzer));
	}

	if (hasActiveStatLimit(limits, getGeneralStatFilterRowsForAnalyzer(analyzer).flat())) {
		return true;
	}

	return (
		analyzer === CMINI_ANALYZER &&
		options.includeLikes === true &&
		limits.likes?.value.trim() !== ''
	);
}
