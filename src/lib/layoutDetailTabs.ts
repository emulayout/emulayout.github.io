import {
	writeTypingPracticeLessonParams,
	type TypingPracticeLessonSettings
} from '$lib/typingPracticeText';

export const LAYOUT_DETAIL_TAB_PARAM = 'tab';
export const DEFAULT_LAYOUT_DETAIL_SECTION = 'practice';

export type LayoutDetailSection = 'practice' | 'test' | 'feel' | 'stats';

export function parseLayoutDetailSection(value: string | null | undefined): LayoutDetailSection {
	return value === 'test' || value === 'feel' || value === 'stats'
		? value
		: DEFAULT_LAYOUT_DETAIL_SECTION;
}

/** Build the canonical page URL from the layout-detail state that is safe to share. */
export function layoutDetailPageHref(
	pathname: string,
	section: LayoutDetailSection = DEFAULT_LAYOUT_DETAIL_SECTION,
	practiceLesson?: Partial<TypingPracticeLessonSettings> | null
): string {
	const params = new URLSearchParams([[LAYOUT_DETAIL_TAB_PARAM, section]]);
	writeTypingPracticeLessonParams(params, practiceLesson);
	return `${pathname}?${params}`;
}
