import type { LayoutData } from '$lib/layout';

/** One cell in the virtualized results grid (live layout or deleted source member). */
export type LayoutListItem =
	| { kind: 'layout'; layout: LayoutData }
	| { kind: 'missing'; name: string };

export function layoutListItemKey(item: LayoutListItem): string {
	return item.kind === 'layout' ? item.layout.name : `missing:${item.name}`;
}

export function layoutListItemName(item: LayoutListItem): string {
	return item.kind === 'layout' ? item.layout.name : item.name;
}
