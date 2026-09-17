import type {
	AuthorId,
	AuthorsMap,
	CompactCyanophageStats,
	CompactLayoutStats,
	CompactMana2Stats,
	LayoutData,
	LayoutLikesMap,
	StatsMaps
} from '$lib/layout';
import { decodeLayout, type CompactLayout } from '$lib/layoutCodec';
import { compileLayoutInputRegistry, type LayoutInputProfile } from '$lib/layoutInputBehaviors';
import type { LayoutSupplemental } from '$lib/layoutSupplemental';
import { DEFAULT_STATS_CORPUS, type StatsCorpus } from '$lib/statsAnalyzers';
import { DEFAULT_KEYBOARD_GEOMETRY, type KeyboardGeometry } from '$lib/keyboardGeometry';

export const LAYOUT_DETAIL_VERSION = 4;

export type CorpusCompactStats<T> = Partial<Record<StatsCorpus, T>>;

export interface LayoutDetailStats {
	cmini?: CorpusCompactStats<CompactLayoutStats>;
	cyanophage?: Partial<Record<KeyboardGeometry, CompactCyanophageStats>>;
	mana2?: CorpusCompactStats<CompactMana2Stats>;
}

export interface ResolvedLayoutDetailStats {
	cmini?: CompactLayoutStats;
	cyanophage?: CompactCyanophageStats;
	mana2?: CompactMana2Stats;
}

export interface CompactLayoutDetail {
	version: typeof LAYOUT_DETAIL_VERSION;
	layout: CompactLayout;
	authorName: string;
	likeCount: number;
	supplemental?: LayoutSupplemental;
	stats: LayoutDetailStats;
}

export interface LayoutDetail {
	layout: LayoutData;
	authorName: string;
	likeCount: number;
	inputProfile?: LayoutInputProfile;
	stats: LayoutDetailStats;
}

export interface CatalogLayoutDetailSource {
	layouts: readonly LayoutData[];
	authorsData: AuthorsMap;
	likesData: LayoutLikesMap;
	inputProfiles?: ReadonlyMap<string, LayoutInputProfile>;
}

/** Resolve an author display name from the published name→id authors map. */
export function resolveAuthorName(authorsData: AuthorsMap, userId: AuthorId): string {
	for (const [name, id] of Object.entries(authorsData)) {
		if (id === userId) return name;
	}
	return 'Unknown';
}

/** Case-insensitive exact match against the published authors map. */
export function resolveAuthorByName(
	authorsData: AuthorsMap,
	name: string
): { id: AuthorId; name: string } | null {
	const term = name.trim().toLowerCase();
	if (!term) return null;
	for (const [authorName, id] of Object.entries(authorsData)) {
		if (authorName.toLowerCase() === term) return { id, name: authorName };
	}
	return null;
}

/**
 * Build a Quick Find / card preview from the already-loaded aggregate catalog.
 * Prefer this over fetching `/layout-details/*.json` when the index (or Compare)
 * has already hydrated the shared catalog.
 */
export function buildCatalogLayoutDetail(
	name: string,
	catalog: CatalogLayoutDetailSource,
	statsMaps: StatsMaps = {},
	statsCorpus: StatsCorpus = DEFAULT_STATS_CORPUS,
	geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY
): LayoutDetail | null {
	const layout = catalog.layouts.find((entry) => entry.name === name);
	if (!layout) return null;
	const inputProfile = catalog.inputProfiles?.get(name);
	return {
		layout,
		authorName: resolveAuthorName(catalog.authorsData, layout.user),
		likeCount: catalog.likesData[name] ?? 0,
		...(inputProfile ? { inputProfile } : {}),
		stats: {
			...(statsMaps.cmini?.[name] ? { cmini: { [statsCorpus]: statsMaps.cmini[name] } } : {}),
			...(statsMaps.cyanophage?.[name]
				? { cyanophage: { [geometry]: statsMaps.cyanophage[name] } }
				: {}),
			...(statsMaps.mana2?.[name] ? { mana2: { [statsCorpus]: statsMaps.mana2[name] } } : {})
		}
	};
}

export function resolveLayoutDetailStats(
	stats: LayoutDetailStats,
	corpus: StatsCorpus,
	geometry: KeyboardGeometry = DEFAULT_KEYBOARD_GEOMETRY
): ResolvedLayoutDetailStats {
	return {
		cmini: stats.cmini?.[corpus],
		cyanophage: stats.cyanophage?.[geometry],
		mana2: stats.mana2?.[corpus]
	};
}

/** Hex-encoded UTF-8 keeps every canonical layout name safe as a static filename. */
export function layoutDetailFileId(name: string): string {
	return Array.from(new TextEncoder().encode(name), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
}

export function layoutDetailUrl(name: string): string {
	return `/layout-details/${layoutDetailFileId(name)}.json`;
}

export function decodeLayoutDetail(value: unknown, expectedName?: string): LayoutDetail | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const compact = value as Partial<CompactLayoutDetail>;
	if (compact.version !== LAYOUT_DETAIL_VERSION || !Array.isArray(compact.layout)) return null;

	const layout = decodeLayout(compact.layout);
	if (!layout.name || (expectedName !== undefined && layout.name !== expectedName)) return null;

	const sources = compact.supplemental ? { [layout.name]: compact.supplemental } : {};
	const inputProfile = compileLayoutInputRegistry(sources, [layout]).get(layout.name);
	return {
		layout,
		authorName: typeof compact.authorName === 'string' ? compact.authorName : 'Unknown',
		likeCount:
			typeof compact.likeCount === 'number' && Number.isFinite(compact.likeCount)
				? compact.likeCount
				: 0,
		...(inputProfile ? { inputProfile } : {}),
		stats: compact.stats && typeof compact.stats === 'object' ? compact.stats : {}
	};
}
