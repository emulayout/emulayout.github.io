import { loadLayoutIndexData } from '$lib/layoutIndexLoader';
import type { PageLoad } from './$types';

// Keep a real home entry point alongside the GitHub Pages SPA fallback.
export const prerender = true;

export const load: PageLoad = ({ fetch, url }) => loadLayoutIndexData(fetch, url);
