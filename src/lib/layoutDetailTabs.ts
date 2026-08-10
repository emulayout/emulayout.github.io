import { normalizeTypingPracticeText, TYPING_PRACTICE_TEXT_PARAM } from '$lib/typingPracticeText';

export const LAYOUT_DETAIL_TAB_PARAM = 'tab';
export const DEFAULT_LAYOUT_DETAIL_SECTION = 'practice';

export type LayoutDetailSection = 'practice' | 'test' | 'stats';

export function parseLayoutDetailSection(value: string | null | undefined): LayoutDetailSection {
	return value === 'test' || value === 'stats' ? value : DEFAULT_LAYOUT_DETAIL_SECTION;
}

/**
 * Page state for a navigation that pushes a layout detail history entry.
 *
 * Navigating from the index captures its untouched URL as `layoutIndexUrl`, and
 * detail-to-detail navigations such as Quick Find carry it forward. The detail
 * page's `All layouts` link navigates to that URL as a new history entry, so
 * browser Back still steps through every visited detail page. When the chain
 * did not start on the index, the URL stays unset and `All layouts` falls back
 * to its plain `/` link.
 */
export function layoutDetailNavigationState(
	currentState: App.PageState,
	currentRouteId: string | null,
	currentUrl: { pathname: string; search: string }
): App.PageState {
	if (currentRouteId === '/') {
		return { ...currentState, layoutIndexUrl: `${currentUrl.pathname}${currentUrl.search}` };
	}
	return { ...currentState };
}

/** Build the canonical page URL from the layout-detail state that is safe to share. */
export function layoutDetailPageHref(
	pathname: string,
	section: LayoutDetailSection = DEFAULT_LAYOUT_DETAIL_SECTION,
	practiceText?: string | null
): string {
	const params = new URLSearchParams([[LAYOUT_DETAIL_TAB_PARAM, section]]);
	const normalizedPracticeText = normalizeTypingPracticeText(practiceText);
	if (normalizedPracticeText) {
		params.set(TYPING_PRACTICE_TEXT_PARAM, normalizedPracticeText);
	}
	return `${pathname}?${params}`;
}
