export const CMINIBROWSER_BASE_URL = 'https://cminibrowser.com/';

/** Opens the canonical cmini layout by name in cminibrowser. */
export function createCminibrowserLayoutURL(
	layoutName: string,
	baseURL = CMINIBROWSER_BASE_URL
): string {
	const url = new URL(baseURL);
	url.hash = encodeURIComponent(JSON.stringify({ open: layoutName }));
	return url.toString();
}
