import type { LayoutData } from '$lib/layout';

type LayoutNameCandidate = Pick<LayoutData, 'name'>;

/**
 * Find layout names using the shared exact → prefix → substring ranking contract.
 * Matching is case-insensitive; ties are alphabetized by the original display name.
 */
export function findLayoutNameMatches(
	layouts: readonly LayoutNameCandidate[],
	query: string,
	maxResults: number
): string[] {
	const term = query.trim().toLowerCase();
	if (!term || layouts.length === 0 || maxResults <= 0) return [];

	const ranked: Array<{ name: string; rank: number }> = [];
	for (const layout of layouts) {
		const name = layout.name;
		const lower = name.toLowerCase();
		if (!lower.includes(term)) continue;
		const rank = lower === term ? 0 : lower.startsWith(term) ? 1 : 2;
		ranked.push({ name, rank });
	}

	ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
	return ranked.slice(0, maxResults).map((entry) => entry.name);
}
