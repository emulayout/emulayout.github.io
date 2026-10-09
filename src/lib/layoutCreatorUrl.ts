import {
	buildCreatorDocument,
	readCreatorDocument,
	creatorDocumentSignature
} from '$lib/creatorDocument';
import {
	createDefaultCreatorSnapshot,
	createCreatorEditSnapshotFromLayout,
	creatorContentEqual,
	type CreatorContentSnapshot,
	type CreatorSnapshot
} from '$lib/creatorContent';
import { readLegacyCreatorContent } from '$lib/creatorLegacyUrl';
import { encodeBase64Url, decodeBase64Url } from '$lib/creatorUrlEncoding';
import type { InputKeyboardType, KeyboardInputConfig } from '$lib/keyboardInputConfig';
import type { LayoutData } from '$lib/layout';
import {
	DEFAULT_LAYOUT_DETAIL_SECTION,
	LAYOUT_DETAIL_TAB_PARAM,
	parseCreatorDetailSection
} from '$lib/layoutDetailTabs';
import {
	resolveTypingPracticeLessonSettings,
	typingPracticeLessonOverridesFromSearchParams
} from '$lib/typingPracticeText';

export const CREATOR_ID_PARAM = 'id';
export const CREATOR_EDIT_PARAM = 'edit';
export const CREATOR_PREVIEW_PARAM = 'preview';
const CREATOR_PREVIEW_PARAM_LEGACY = 'locked';
const ENABLED_FLAG = '1';

export function creatorEditSearchFromLayout(
	layout: LayoutData,
	keyboardType: InputKeyboardType = 'staggered'
): string {
	return `?${writeCreatorUrlParams(createCreatorEditSnapshotFromLayout(layout, keyboardType)).toString()}`;
}

function writeCreatorSectionParam(params: URLSearchParams, section: CreatorSnapshot['section']) {
	const resolved = parseCreatorDetailSection(section);
	if (resolved === DEFAULT_LAYOUT_DETAIL_SECTION) return;
	params.set(LAYOUT_DETAIL_TAB_PARAM, resolved);
}

export const CREATOR_DOCUMENT_PARAM = 'document';
const MAX_CREATOR_DOCUMENT_LENGTH = 1024 * 1024;

export function writeCreatorUrlParams(snapshot: CreatorSnapshot): URLSearchParams {
	const params = new URLSearchParams();
	if (
		creatorDocumentSignature(snapshot) !== creatorDocumentSignature(createDefaultCreatorSnapshot())
	)
		params.set(
			CREATOR_DOCUMENT_PARAM,
			encodeBase64Url(JSON.stringify(buildCreatorDocument(snapshot)))
		);
	writeCreatorSectionParam(params, snapshot.section);
	if (!snapshot.preview) params.set(CREATOR_EDIT_PARAM, ENABLED_FLAG);
	return params;
}

export function readCreatorDocumentFromSearch(
	searchParams: URLSearchParams
): CreatorContentSnapshot | null {
	const encoded = searchParams.get(CREATOR_DOCUMENT_PARAM) ?? '';
	let content: CreatorContentSnapshot | null = null;
	try {
		if (encoded.length <= MAX_CREATOR_DOCUMENT_LENGTH) {
			const text = decodeBase64Url(encoded);
			if (text !== null) content = readCreatorDocument(JSON.parse(text));
		}
	} catch {
		/* Invalid document content never falls back to legacy draft fields. */
	}
	return content;
}

export function readCreatorUrlSnapshot(
	searchParams: URLSearchParams,
	options: { defaultKeyConfig?: KeyboardInputConfig } = {}
): CreatorSnapshot {
	const hasDocument = searchParams.has(CREATOR_DOCUMENT_PARAM);
	const content =
		(hasDocument
			? readCreatorDocumentFromSearch(searchParams)
			: readLegacyCreatorContent(searchParams, options)) ?? createDefaultCreatorSnapshot();
	return {
		...content,
		practiceLesson: hasDocument
			? resolveTypingPracticeLessonSettings(
					content.practiceLesson,
					typingPracticeLessonOverridesFromSearchParams(searchParams)
				)
			: content.practiceLesson,
		preview: readCreatorPreviewFlag(searchParams),
		section: parseCreatorDetailSection(searchParams.get(LAYOUT_DETAIL_TAB_PARAM))
	};
}

export function readCreatorEditFlag(searchParams: URLSearchParams): boolean {
	return searchParams.get(CREATOR_EDIT_PARAM) === ENABLED_FLAG;
}

/** Preview is the default view. `edit=1` is Edit. Legacy `preview=1` / `locked=1` stay Preview. */
export function readCreatorPreviewFlag(searchParams: URLSearchParams): boolean {
	return !readCreatorEditFlag(searchParams);
}

function isCreatorViewParam(key: string): boolean {
	return (
		key === CREATOR_ID_PARAM ||
		key === CREATOR_EDIT_PARAM ||
		key === CREATOR_PREVIEW_PARAM ||
		key === CREATOR_PREVIEW_PARAM_LEGACY ||
		key === LAYOUT_DETAIL_TAB_PARAM
	);
}

export function readCreatorSavedId(searchParams: URLSearchParams): string | null {
	const id = searchParams.get(CREATOR_ID_PARAM)?.trim();
	return id || null;
}

export function creatorUrlHasDraftParams(searchParams: URLSearchParams): boolean {
	for (const key of searchParams.keys()) {
		if (!isCreatorViewParam(key)) return true;
	}
	return false;
}

export type CreatorSearchOptions = {
	savedId?: string | null;
	savedSnapshot?: CreatorContentSnapshot | null;
};

export function creatorSearchFromSnapshot(
	snapshot: CreatorSnapshot,
	options: CreatorSearchOptions = {}
): string {
	const savedId = options.savedId?.trim() || '';
	const omitDraft =
		Boolean(savedId) &&
		Boolean(options.savedSnapshot) &&
		creatorContentEqual(snapshot, options.savedSnapshot as CreatorContentSnapshot);
	const params = omitDraft ? new URLSearchParams() : writeCreatorUrlParams(snapshot);
	if (savedId) params.set(CREATOR_ID_PARAM, savedId);
	if (omitDraft && !snapshot.preview) params.set(CREATOR_EDIT_PARAM, ENABLED_FLAG);
	if (omitDraft) writeCreatorSectionParam(params, snapshot.section);
	const query = params.toString();
	return query ? `?${query}` : '';
}
