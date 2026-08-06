import type {
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

export const LAYOUT_DETAIL_VERSION = 2;

export interface CompactLayoutDetail {
	version: typeof LAYOUT_DETAIL_VERSION;
	layout: CompactLayout;
	authorName: string;
	likeCount: number;
	supplemental?: LayoutSupplemental;
	stats: {
		cmini?: CompactLayoutStats;
		/** Full cminibrowser dump fields; show pages only (not catalog). */
		cminiExtended?: Record<string, unknown>;
		cyanophage?: CompactCyanophageStats;
		mana2?: CompactMana2Stats;
	};
}

export interface LayoutDetail {
	layout: LayoutData;
	authorName: string;
	likeCount: number;
	inputProfile?: LayoutInputProfile;
	stats: CompactLayoutDetail['stats'];
}

export interface CatalogLayoutDetailSource {
	layouts: readonly LayoutData[];
	authorsData: Record<string, number>;
	likesData: LayoutLikesMap;
	inputProfiles?: ReadonlyMap<string, LayoutInputProfile>;
}

/** Resolve an author display name from the published name→id authors map. */
export function resolveAuthorName(authorsData: Record<string, number>, userId: number): string {
	for (const [name, id] of Object.entries(authorsData)) {
		if (id === userId) return name;
	}
	return 'Unknown';
}

/**
 * Build a Quick Find / card preview from the already-loaded aggregate catalog.
 * Prefer this over fetching `/layout-details/*.json` when the index (or Compare)
 * has already hydrated the shared catalog.
 */
export function buildCatalogLayoutDetail(
	name: string,
	catalog: CatalogLayoutDetailSource,
	statsMaps: StatsMaps = {}
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
			cmini: statsMaps.cmini?.[name],
			cyanophage: statsMaps.cyanophage?.[name],
			mana2: statsMaps.mana2?.[name]
		}
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
