import { layoutDetailUrl, type CompactLayoutDetail } from '$lib/layoutDetails';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch(layoutDetailUrl(params.name));
	return {
		layoutName: params.name,
		detail: response.ok ? ((await response.json()) as CompactLayoutDetail) : null
	};
};
