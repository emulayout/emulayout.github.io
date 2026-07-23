/** Query params for shareable views — never applied by normal filter URL hydrate. */
export const SHARE_VIEW_NAME_PARAM = 'viewName';
export const SHARE_VIEW_FILTERS_PARAM = 'viewFilters';

export type SharedViewOffer = {
	name: string;
	filtersEncoded: string;
};

export function buildShareViewUrl(name: string, filtersEncoded: string): string {
	const url = new URL(window.location.href);
	url.search = '';
	url.hash = '';
	url.searchParams.set(SHARE_VIEW_NAME_PARAM, name);
	if (filtersEncoded) {
		url.searchParams.set(SHARE_VIEW_FILTERS_PARAM, filtersEncoded);
	}
	return url.toString();
}

export function readShareViewFromUrl(href = window.location.href): SharedViewOffer | null {
	try {
		const url = new URL(href);
		const name = url.searchParams.get(SHARE_VIEW_NAME_PARAM)?.trim() ?? '';
		const filtersEncoded = url.searchParams.get(SHARE_VIEW_FILTERS_PARAM) ?? '';
		if (!name && !filtersEncoded) return null;
		return {
			name: name || 'Shared view',
			filtersEncoded
		};
	} catch {
		return null;
	}
}

/** Remove share params from the current URL without firing popstate. */
export function stripShareViewParamsFromUrl(): void {
	try {
		const url = new URL(window.location.href);
		if (
			!url.searchParams.has(SHARE_VIEW_NAME_PARAM) &&
			!url.searchParams.has(SHARE_VIEW_FILTERS_PARAM)
		) {
			return;
		}
		url.searchParams.delete(SHARE_VIEW_NAME_PARAM);
		url.searchParams.delete(SHARE_VIEW_FILTERS_PARAM);
		const next = `${url.pathname}${url.search}${url.hash}`;
		window.history.replaceState(window.history.state, '', next);
	} catch {
		// ignore
	}
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// fall through
	}

	try {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'fixed';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(textarea);
		return ok;
	} catch {
		return false;
	}
}
