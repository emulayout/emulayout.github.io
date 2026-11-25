import { layoutDetailUrl, type CompactLayoutDetail } from '$lib/layoutDetails';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	let detail: CompactLayoutDetail | null = null;
	try {
		const response = await fetch(layoutDetailUrl(params.name));
		if (response.ok) {
			detail = (await response.json()) as CompactLayoutDetail;
		}
	} catch {
		detail = null;
	}
	return {
		layoutName: params.name,
		detail
	};
};
