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

/** Creator has no Stats tab; invalid or `stats` values fall back to Typing practice. */
export function parseCreatorDetailSection(
	value: string | null | undefined
): Exclude<LayoutDetailSection, 'stats'> {
	const section = parseLayoutDetailSection(value);
	return section === 'stats' ? DEFAULT_LAYOUT_DETAIL_SECTION : section;
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
