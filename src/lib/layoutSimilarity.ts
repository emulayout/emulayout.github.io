import { isHomeKeySlot, SPLIT_COL } from '$lib/cmini/keyboard';
import type { LayoutData } from '$lib/layout';

export interface PositionMatch {
	matches: number;
	total: number;
	percent: number;
}

export interface SimilarLayoutResult {
	layout: LayoutData;
	match: PositionMatch;
	mirrored: boolean;
}

export interface SimilarityMatchInfo {
	percent: number;
	mirrored: boolean;
}

export type SimilarityMirrorMode = 'excluded' | 'optional' | 'required';

export function isSimilarityMirrorMode(value: string): value is SimilarityMirrorMode {
	return value === 'excluded' || value === 'optional' || value === 'required';
}

export interface CompareLayoutOptions {
	weightHomeKeys?: boolean;
	/**
	 * excluded — direct compare only (default)
	 * optional — best of direct vs mirrored
	 * required — mirrored compare only
	 */
	mirrorMode?: SimilarityMirrorMode;
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

/** Columns 0..9 pair across the hand split: 0↔9, 1↔8, …, 4↔5 (finger-symmetric). */
const MIRROR_MAX_COL = 2 * SPLIT_COL - 1;

/**
 * Opposite-hand column for mirror matching. Uses the fixed 10-key span around
 * SPLIT_COL so uneven row widths (extra punctuation cols) don't shift finger pairs.
 * Returns null for columns outside that span.
 */
export function mirrorCol(col: number): number | null {
	const mirrored = MIRROR_MAX_COL - col;
	if (col < 0 || col > MIRROR_MAX_COL || mirrored < 0 || mirrored > MIRROR_MAX_COL) {
		return null;
	}
	return mirrored;
}

/** Mirror a `"row,col"` slot across the hand split. Null if the column has no pair. */
export function mirrorSlotKey(slot: string): string | null {
	const { row, col } = parseSlot(slot);
	const mirrored = mirrorCol(col);
	if (mirrored === null) return null;
	return `${row},${mirrored}`;
}

/** Reference positions with columns flipped (same chars, opposite hands). */
export function buildMirroredPositionMap(positions: Map<string, string>): Map<string, string> {
	const mirrored = new Map<string, string>();
	for (const [slot, char] of positions) {
		const mirroredSlot = mirrorSlotKey(slot);
		if (mirroredSlot === null) continue;
		mirrored.set(mirroredSlot, char);
	}
	return mirrored;
}

/** Compare key positions; only slots present in both maps are scored. */
export function comparePositionMaps(
	referencePositions: Map<string, string>,
	candidatePositions: Map<string, string>,
	{ weightHomeKeys = false }: Pick<CompareLayoutOptions, 'weightHomeKeys'> = {}
): PositionMatch | null {
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

/** Compare key positions; only slots present in both layouts are scored. */
export function compareLayoutPositions(
	reference: LayoutData,
	candidate: LayoutData,
	options: CompareLayoutOptions = {}
): PositionMatch | null {
	return comparePositionMaps(reference.positionBySlot, candidate.positionBySlot, options);
}

function isBetterMatch(a: PositionMatch, b: PositionMatch): boolean {
	if (a.percent !== b.percent) return a.percent > b.percent;
	if (a.matches !== b.matches) return a.matches > b.matches;
	return a.total > b.total;
}

/** Best of direct and optional mirror compare. Prefer direct on ties. */
export function compareLayoutPositionsWithMirror(
	reference: LayoutData,
	candidate: LayoutData,
	{
		weightHomeKeys = false,
		mirrorMode = 'excluded',
		mirroredReferencePositions
	}: CompareLayoutOptions & {
		mirroredReferencePositions?: Map<string, string>;
	} = {}
): { match: PositionMatch; mirrored: boolean } | null {
	const mirroredPositions =
		mirrorMode === 'excluded'
			? null
			: (mirroredReferencePositions ?? buildMirroredPositionMap(reference.positionBySlot));

	if (mirrorMode === 'required') {
		if (!mirroredPositions) return null;
		const mirrored = comparePositionMaps(mirroredPositions, candidate.positionBySlot, {
			weightHomeKeys
		});
		return mirrored ? { match: mirrored, mirrored: true } : null;
	}

	const direct = comparePositionMaps(
		reference.positionBySlot,
		candidate.positionBySlot,
		{ weightHomeKeys }
	);

	if (mirrorMode === 'excluded') {
		return direct ? { match: direct, mirrored: false } : null;
	}

	// optional: best of direct vs mirror
	const mirrored = mirroredPositions
		? comparePositionMaps(mirroredPositions, candidate.positionBySlot, { weightHomeKeys })
		: null;

	if (!direct && !mirrored) return null;
	if (!direct) return mirrored ? { match: mirrored, mirrored: true } : null;
	if (!mirrored) return { match: direct, mirrored: false };
	if (isBetterMatch(mirrored, direct)) return { match: mirrored, mirrored: true };
	return { match: direct, mirrored: false };
}

export function findSimilarLayouts(
	reference: LayoutData,
	candidates: LayoutData[],
	{
		limit = 30,
		minComparableSlots = 10,
		minPercent = 1,
		weightHomeKeys = false,
		mirrorMode = 'excluded'
	}: {
		limit?: number;
		minComparableSlots?: number;
		minPercent?: number;
	} & CompareLayoutOptions = {}
): SimilarLayoutResult[] {
	const results: SimilarLayoutResult[] = [];
	const mirroredReferencePositions =
		mirrorMode === 'excluded' ? undefined : buildMirroredPositionMap(reference.positionBySlot);

	for (const candidate of candidates) {
		if (candidate.name === reference.name) continue;

		const result = compareLayoutPositionsWithMirror(reference, candidate, {
			weightHomeKeys,
			mirrorMode,
			mirroredReferencePositions
		});
		if (!result) continue;
		if (result.match.total < minComparableSlots) continue;
		if (result.match.percent < minPercent) continue;

		results.push({ layout: candidate, match: result.match, mirrored: result.mirrored });
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

/** Match info keyed by layout name (excludes reference). Recomputed when reference changes. */
export function buildSimilarityMatchMap(
	reference: LayoutData,
	candidates: LayoutData[],
	{
		minComparableSlots = DEFAULT_MIN_COMPARABLE_SLOTS,
		minPercent = DEFAULT_MIN_PERCENT,
		weightHomeKeys = false,
		mirrorMode = 'excluded'
	}: {
		minComparableSlots?: number;
		minPercent?: number;
	} & CompareLayoutOptions = {}
): Map<string, SimilarityMatchInfo> {
	const map = new Map<string, SimilarityMatchInfo>();
	const mirroredReferencePositions =
		mirrorMode === 'excluded' ? undefined : buildMirroredPositionMap(reference.positionBySlot);

	for (const candidate of candidates) {
		if (candidate.name === reference.name) continue;

		const result = compareLayoutPositionsWithMirror(reference, candidate, {
			weightHomeKeys,
			mirrorMode,
			mirroredReferencePositions
		});
		if (!result) continue;
		if (result.match.total < minComparableSlots) continue;
		if (result.match.percent < minPercent) continue;

		map.set(candidate.name, {
			percent: result.match.percent,
			mirrored: result.mirrored
		});
	}

	return map;
}

/** @deprecated Prefer buildSimilarityMatchMap for mirror support. */
export function buildSimilarityPercentMap(
	reference: LayoutData,
	candidates: LayoutData[],
	options: {
		minComparableSlots?: number;
		minPercent?: number;
	} & CompareLayoutOptions = {}
): Map<string, number> {
	const map = new Map<string, number>();
	for (const [name, info] of buildSimilarityMatchMap(reference, candidates, options)) {
		map.set(name, info.percent);
	}
	return map;
}

export function isSimilarLayoutMatch(
	referenceName: string | null,
	layoutName: string,
	similarityMatches: Map<string, SimilarityMatchInfo> | Map<string, number>
): boolean {
	if (!referenceName) return true;
	if (layoutName === referenceName) return false;
	return similarityMatches.has(layoutName);
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
	similarityMatches: Map<string, SimilarityMatchInfo> | Map<string, number>,
	sortOrder: 'asc' | 'desc' = 'desc'
): LayoutData[] {
	const descending = sortOrder === 'desc';
	const percentOf = (name: string): number => {
		const entry = similarityMatches.get(name);
		if (entry === undefined) return 0;
		return typeof entry === 'number' ? entry : entry.percent;
	};
	return [...layouts].sort((a, b) => {
		const aPercent = percentOf(a.name);
		const bPercent = percentOf(b.name);
		if (aPercent !== bPercent) {
			return descending ? bPercent - aPercent : aPercent - bPercent;
		}
		return a.name.localeCompare(b.name);
	});
}
