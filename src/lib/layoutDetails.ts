import type {
	CompactCyanophageStats,
	CompactLayoutStats,
	CompactMana2Stats,
	LayoutData
} from '$lib/layout';
import { decodeLayout, type CompactLayout } from '$lib/layoutCodec';
import {
	compileLayoutInputRegistry,
	type LayoutInputBehaviorSource,
	type LayoutInputProfile
} from '$lib/layoutInputBehaviors';

export const LAYOUT_DETAIL_VERSION = 1;

export interface CompactLayoutDetail {
	version: typeof LAYOUT_DETAIL_VERSION;
	layout: CompactLayout;
	authorName: string;
	likeCount: number;
	inputBehavior?: LayoutInputBehaviorSource;
	stats: {
		cmini?: CompactLayoutStats;
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

	const sources = compact.inputBehavior ? { [layout.name]: compact.inputBehavior } : {};
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
