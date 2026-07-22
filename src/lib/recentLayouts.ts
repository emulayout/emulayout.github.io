import type { LayoutData } from '$lib/layout';

export function localDayKey(date: Date): string {
	return date.toLocaleDateString('en-CA');
}

/** Newest local calendar day among layout `updatedAt` values (proxy for last sync batch). */
export function getLatestLayoutDayKey(layouts: LayoutData[]): string | null {
	let latest: string | null = null;
	for (const layout of layouts) {
		const day = localDayKey(new Date(layout.updatedAt));
		if (!latest || day > latest) latest = day;
	}
	return latest;
}

export function isNewSinceLastSync(
	layout: LayoutData,
	latestDayKey: string | null
): boolean {
	if (!latestDayKey) return false;
	return localDayKey(new Date(layout.updatedAt)) === latestDayKey;
}
