export const LAYOUT_DETAIL_TAB_PARAM = 'tab';
export const DEFAULT_LAYOUT_DETAIL_SECTION = 'test';

export type LayoutDetailSection = 'test' | 'stats';

export function parseLayoutDetailSection(value: string | null | undefined): LayoutDetailSection {
	return value === 'stats' ? 'stats' : DEFAULT_LAYOUT_DETAIL_SECTION;
}

/** Build the canonical page URL. Detail routes keep no query state besides the active tab. */
export function layoutDetailPageHref(
	pathname: string,
	section: LayoutDetailSection = DEFAULT_LAYOUT_DETAIL_SECTION
): string {
	return `${pathname}?${LAYOUT_DETAIL_TAB_PARAM}=${section}`;
}
