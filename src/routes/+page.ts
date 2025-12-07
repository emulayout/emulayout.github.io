import type { LayoutData } from '$lib/layout';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const layoutsResponse = await fetch('/all-layouts.json');
	const layouts: LayoutData[] = await layoutsResponse.json();

	return {
		layouts
	};
};

