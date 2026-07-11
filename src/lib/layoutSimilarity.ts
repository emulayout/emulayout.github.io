import { isHomeKeySlot } from '$lib/cmini/keyboard';
import type { LayoutData } from '$lib/layout';

export interface PositionMatch {
	matches: number;
	total: number;
	percent: number;
}

export interface SimilarLayoutResult {
	layout: LayoutData;
	match: PositionMatch;
}

export interface CompareLayoutOptions {
	sameBoardOnly?: boolean;
	weightHomeKeys?: boolean;
}

/** Home keys count double when weightHomeKeys is enabled. */
const HOME_KEY_WEIGHT = 2;

function parseSlot(position: string): { row: number; col: number } {
	const [rowStr, colStr] = position.split(',');
	return { row: Number(rowStr), col: Number(colStr) };
}

function slotWeight(row: number, col: number, weightHomeKeys: boolean): number {
	if (!weightHomeKeys) return 1;
	return isHomeKeySlot(row, col) ? HOME_KEY_WEIGHT : 1;
}

/** Compare key positions; only slots present in both layouts are scored. */
export function compareLayoutPositions(
	reference: LayoutData,
	candidate: LayoutData,
	{ sameBoardOnly = false, weightHomeKeys = false }: CompareLayoutOptions = {}
): PositionMatch | null {
	if (sameBoardOnly && reference.board !== candidate.board) return null;

	const referencePositions = reference.positionBySlot;
	const candidatePositions = candidate.positionBySlot;

	let matches = 0;
	let total = 0;
	let weightedMatches = 0;
	let weightedTotal = 0;

	for (const [position, referenceChar] of referencePositions) {
		const candidateChar = candidatePositions.get(position);
		if (candidateChar === undefined) continue;

		const { row, col } = parseSlot(position);
		const weight = slotWeight(row, col, weightHomeKeys);

		total++;
		weightedTotal += weight;
		if (candidateChar === referenceChar) {
			matches++;
			weightedMatches += weight;
		}
	}

	if (total === 0) return null;

	const percent = weightHomeKeys
		? Math.round((weightedMatches / weightedTotal) * 100)
		: Math.round((matches / total) * 100);

	return {
		matches,
		total,
		percent
	};
}

export function findSimilarLayouts(
	reference: LayoutData,
	candidates: LayoutData[],
	{
		limit = 30,
		minComparableSlots = 10,
		minPercent = 1,
		sameBoardOnly = false,
		weightHomeKeys = false
	}: {
		limit?: number;
		minComparableSlots?: number;
		minPercent?: number;
	} & CompareLayoutOptions = {}
): SimilarLayoutResult[] {
	const results: SimilarLayoutResult[] = [];

	for (const candidate of candidates) {
		if (candidate.name === reference.name) continue;

		const match = compareLayoutPositions(reference, candidate, { sameBoardOnly, weightHomeKeys });
		if (!match) continue;
		if (match.total < minComparableSlots) continue;
		if (match.percent < minPercent) continue;

		results.push({ layout: candidate, match });
	}

	results.sort((a, b) => {
		if (b.match.percent !== a.match.percent) return b.match.percent - a.match.percent;
		if (b.match.matches !== a.match.matches) return b.match.matches - a.match.matches;
		return a.layout.name.localeCompare(b.layout.name);
	});

	return results.slice(0, limit);
}

const DEFAULT_MIN_COMPARABLE_SLOTS = 10;
const DEFAULT_MIN_PERCENT = 1;

/** Percent match keyed by layout name (excludes reference). Recomputed when reference changes. */
export function buildSimilarityPercentMap(
	reference: LayoutData,
	candidates: LayoutData[],
	{
		minComparableSlots = DEFAULT_MIN_COMPARABLE_SLOTS,
		minPercent = DEFAULT_MIN_PERCENT,
		sameBoardOnly = false,
		weightHomeKeys = false
	}: {
		minComparableSlots?: number;
		minPercent?: number;
	} & CompareLayoutOptions = {}
): Map<string, number> {
	const map = new Map<string, number>();

	for (const candidate of candidates) {
		if (candidate.name === reference.name) continue;

		const match = compareLayoutPositions(reference, candidate, { sameBoardOnly, weightHomeKeys });
		if (!match) continue;
		if (match.total < minComparableSlots) continue;
		if (match.percent < minPercent) continue;

		map.set(candidate.name, match.percent);
	}

	return map;
}

export function isSimilarLayoutMatch(
	referenceName: string | null,
	layoutName: string,
	similarityPercents: Map<string, number>
): boolean {
	if (!referenceName) return true;
	if (layoutName === referenceName) return false;
	return similarityPercents.has(layoutName);
}

/** `gt` means at least threshold; `lt` means strictly below. Empty value = no filter. */
export function matchesSimilarityPercentFilter(
	percent: number,
	operator: 'lt' | 'gt',
	value: string
): boolean {
	const trimmed = value.trim();
	if (!trimmed) return true;
	const threshold = Number.parseFloat(trimmed);
	if (!Number.isFinite(threshold)) return true;
	if (operator === 'lt') return percent < threshold;
	return percent >= threshold;
}

export function sortLayoutsBySimilarity(
	layouts: LayoutData[],
	similarityPercents: Map<string, number>,
	sortOrder: 'asc' | 'desc' = 'desc'
): LayoutData[] {
	const descending = sortOrder === 'desc';
	return [...layouts].sort((a, b) => {
		const aPercent = similarityPercents.get(a.name) ?? 0;
		const bPercent = similarityPercents.get(b.name) ?? 0;
		if (aPercent !== bPercent) {
			return descending ? bPercent - aPercent : aPercent - bPercent;
		}
		return a.name.localeCompare(b.name);
	});
}
