import { normalizeTypingPracticeText, TYPING_PRACTICE_TEXT_PARAM } from '$lib/typingPracticeText';

export const LAYOUT_DETAIL_TAB_PARAM = 'tab';
export const DEFAULT_LAYOUT_DETAIL_SECTION = 'practice';

export type LayoutDetailSection = 'practice' | 'test' | 'stats';

export function parseLayoutDetailSection(value: string | null | undefined): LayoutDetailSection {
	return value === 'test' || value === 'stats' ? value : DEFAULT_LAYOUT_DETAIL_SECTION;
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
