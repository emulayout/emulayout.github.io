import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	layoutName: params.name
});
