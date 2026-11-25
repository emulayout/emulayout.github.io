import type { LayoutData } from '$lib/layout';

const localDayFormatter = new Intl.DateTimeFormat('en-CA');

export function localDayKey(date: Date): string {
	if (Number.isNaN(date.getTime())) return '';
	return localDayFormatter.format(date);
}

/** Newest local calendar day among layout `updatedAt` values (proxy for last sync batch). */
export function getLatestLayoutDayKey(layouts: LayoutData[]): string | null {
	let latest: string | null = null;
	for (const layout of layouts) {
		const day = localDayKey(new Date(layout.updatedAt));
		if (!day) continue;
		if (!latest || day > latest) latest = day;
	}
	return latest;
}

export function isNewSinceLastSync(layout: LayoutData, latestDayKey: string | null): boolean {
	if (!latestDayKey) return false;
	const day = localDayKey(new Date(layout.updatedAt));
	return day !== '' && day === latestDayKey;
}
