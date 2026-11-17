import { SvelteSet } from 'svelte/reactivity';

const storageKey = 'emulayout-liked-layouts';

function readLikes(): string[] {
	try {
		if (typeof window === 'undefined') return [];
		const values: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
		return Array.isArray(values)
			? values.filter((value): value is string => typeof value === 'string' && value !== '')
			: [];
	} catch {
		return [];
	}
}

const likedNames = new SvelteSet(readLikes());

export const layoutLikes = {
	names: likedNames as ReadonlySet<string>,
	toggle(name: string) {
		if (!likedNames.delete(name)) likedNames.add(name);
		try {
			window.localStorage.setItem(storageKey, JSON.stringify([...likedNames]));
		} catch {
			// The current session still works when browser storage is unavailable.
		}
	}
};
