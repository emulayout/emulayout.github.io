export const CMINIBROWSER_BASE_URL = 'https://akl.gg/';

/** Opens the canonical cmini layout by name on akl.gg. */
export function createCminibrowserLayoutURL(
	layoutName: string,
	baseURL = CMINIBROWSER_BASE_URL
): string {
	const url = new URL(baseURL);
	url.hash = encodeURIComponent(JSON.stringify({ open: layoutName }));
	return url.toString();
}
