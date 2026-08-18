import {
	creatorContentFromSnapshot,
	creatorContentSnapshotSignature,
	creatorSnapshotFromContent,
	readCreatorUrlSnapshot,
	type CreatorUrlSnapshot
} from '$lib/layoutCreatorUrl';
import { DEFAULT_LAYOUT_DETAIL_SECTION } from '$lib/layoutDetailTabs';

export const CREATOR_SHARE_PARAM = 'share';
const CREATOR_SHARE_VERSION = '1';

/** Build a portable creator link without a browser-local saved-layout id or transient view state. */
export function buildCreatorShareUrl(
	snapshot: CreatorUrlSnapshot,
	href = window.location.href
): string {
	const url = new URL(href);
	url.search = creatorContentSnapshotSignature(creatorContentFromSnapshot(snapshot));
	url.searchParams.set(CREATOR_SHARE_PARAM, CREATOR_SHARE_VERSION);
	url.hash = '';
	return url.toString();
}

/** Read a shared-layout offer while keeping it separate from the active creator canvas. */
export function readCreatorShareFromSearch(
	searchParams: URLSearchParams
): CreatorUrlSnapshot | null {
	if (searchParams.get(CREATOR_SHARE_PARAM) !== CREATOR_SHARE_VERSION) return null;
	return creatorSnapshotFromContent(
		creatorContentFromSnapshot(readCreatorUrlSnapshot(searchParams)),
		{
			preview: true,
			section: DEFAULT_LAYOUT_DETAIL_SECTION
		}
	);
}
