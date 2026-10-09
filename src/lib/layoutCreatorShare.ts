import { buildCreatorDocument } from '$lib/creatorDocument';
import {
	creatorContentFromSnapshot,
	creatorSnapshotFromContent,
	type CreatorSnapshot
} from '$lib/creatorContent';
import {
	writeCreatorUrlParams,
	CREATOR_DOCUMENT_PARAM,
	readCreatorUrlSnapshot,
	readCreatorDocumentFromSearch
} from '$lib/layoutCreatorUrl';
import { encodeBase64Url } from '$lib/creatorUrlEncoding';
import { DEFAULT_LAYOUT_DETAIL_SECTION } from '$lib/layoutDetailTabs';

export const CREATOR_SHARE_PARAM = 'share';
const CREATOR_SHARE_VERSION = '2';

/** Build a portable creator link without a browser-local saved-layout id or transient view state. */
export function buildCreatorShareUrl(
	snapshot: CreatorSnapshot,
	href = window.location.href
): string {
	const url = new URL(href);
	url.search = writeCreatorUrlParams({
		...snapshot,
		preview: true,
		section: DEFAULT_LAYOUT_DETAIL_SECTION
	}).toString();
	url.searchParams.set(
		CREATOR_DOCUMENT_PARAM,
		encodeBase64Url(JSON.stringify(buildCreatorDocument(creatorContentFromSnapshot(snapshot))))
	);
	url.searchParams.set(CREATOR_SHARE_PARAM, CREATOR_SHARE_VERSION);
	url.hash = '';
	return url.toString();
}

/** Read a shared-layout offer while keeping it separate from the active creator canvas. */
export function readCreatorShareFromSearch(searchParams: URLSearchParams): CreatorSnapshot | null {
	const version = searchParams.get(CREATOR_SHARE_PARAM);
	if (version !== '1' && version !== CREATOR_SHARE_VERSION) return null;
	if (version === CREATOR_SHARE_VERSION && !searchParams.has(CREATOR_DOCUMENT_PARAM)) return null;
	// COMPATIBILITY: share=1 uses query fields; keep until old shared links are explicitly retired.
	const content =
		version === CREATOR_SHARE_VERSION
			? readCreatorDocumentFromSearch(searchParams)
			: creatorContentFromSnapshot(readCreatorUrlSnapshot(searchParams));
	if (!content) return null;
	return creatorSnapshotFromContent(content, {
		preview: true,
		section: DEFAULT_LAYOUT_DETAIL_SECTION
	});
}
