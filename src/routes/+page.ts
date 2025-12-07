import type { LayoutData } from '$lib/layout';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [layoutsResponse, authorsResponse] = await Promise.all([
		fetch('/all-layouts.json'),
		fetch('/authors.json')
	]);

	const layouts: LayoutData[] = await layoutsResponse.json();
	const authorsData: Record<string, number> = await authorsResponse.json();

	return {
		layouts,
		authorsData
	};
};
