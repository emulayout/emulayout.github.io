import { STAT_ANALYZERS, type StatsAnalyzer } from '$lib/statsAnalyzers';

export const FINGER_WORKLOAD_FINGERS = ['pinky', 'ring', 'middle', 'index'] as const;
export const FINGER_WORKLOAD_LEVELS = ['none', 'lightest', 'light', 'medium', 'heavy'] as const;
export const FINGER_WORKLOAD_HANDS = ['left', 'right'] as const;

export type FingerWorkloadFinger = (typeof FINGER_WORKLOAD_FINGERS)[number];
export type FingerWorkloadLevel = (typeof FINGER_WORKLOAD_LEVELS)[number];
export type FingerWorkloadHand = (typeof FINGER_WORKLOAD_HANDS)[number];
export type FingerWorkloadHandPreference = Record<FingerWorkloadFinger, FingerWorkloadLevel>;
export type FingerWorkloadPreference = Record<FingerWorkloadHand, FingerWorkloadHandPreference>;
export type FingerWorkloadPreferences = Record<StatsAnalyzer, FingerWorkloadPreference>;

const LEVEL_RANK: Record<FingerWorkloadLevel, number> = {
	none: 0,
	lightest: 1,
	light: 2,
	medium: 3,
	heavy: 4
};

const FINGER_LABEL: Record<FingerWorkloadFinger, string> = {
	pinky: 'P',
	ring: 'R',
	middle: 'M',
	index: 'I'
};

const HAND_STAT_KEYS = {
	left: { pinky: 'LP', ring: 'LR', middle: 'LM', index: 'LI' },
	right: { pinky: 'RP', ring: 'RR', middle: 'RM', index: 'RI' }
} as const;

export function createDefaultFingerWorkloadPreference(): FingerWorkloadPreference {
	return {
		left: createDefaultFingerWorkloadHandPreference(),
		right: createDefaultFingerWorkloadHandPreference()
	};
}

export function createDefaultFingerWorkloadHandPreference(): FingerWorkloadHandPreference {
	return {
		pinky: 'none',
		ring: 'none',
		middle: 'none',
		index: 'none'
	};
}

export function createEmptyFingerWorkloadPreferences(): FingerWorkloadPreferences {
	return Object.fromEntries(
		STAT_ANALYZERS.map(({ value }) => [value, createDefaultFingerWorkloadPreference()])
	) as FingerWorkloadPreferences;
}

export function cloneFingerWorkloadPreferences(
	preferences: FingerWorkloadPreferences
): FingerWorkloadPreferences {
	const clone = createEmptyFingerWorkloadPreferences();
	for (const { value: analyzer } of STAT_ANALYZERS) {
		for (const hand of FINGER_WORKLOAD_HANDS) {
			clone[analyzer][hand] = { ...preferences[analyzer][hand] };
		}
	}
	return clone;
}

export function isFingerWorkloadLevel(value: unknown): value is FingerWorkloadLevel {
	return typeof value === 'string' && FINGER_WORKLOAD_LEVELS.includes(value as FingerWorkloadLevel);
}

export function normalizeFingerWorkloadPreferences(
	value: unknown,
	fallback: FingerWorkloadPreferences = createEmptyFingerWorkloadPreferences()
): FingerWorkloadPreferences {
	const normalized = cloneFingerWorkloadPreferences(fallback);
	if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized;

	for (const { value: analyzer } of STAT_ANALYZERS) {
		const candidate = (value as Record<string, unknown>)[analyzer];
		if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;

		const candidateRecord = candidate as Record<string, unknown>;
		const hasHandShape = FINGER_WORKLOAD_HANDS.some((hand) => {
			const handCandidate = candidateRecord[hand];
			return (
				Boolean(handCandidate) && typeof handCandidate === 'object' && !Array.isArray(handCandidate)
			);
		});

		for (const hand of FINGER_WORKLOAD_HANDS) {
			const handCandidate = hasHandShape ? candidateRecord[hand] : candidateRecord;
			if (!handCandidate || typeof handCandidate !== 'object' || Array.isArray(handCandidate))
				continue;
			for (const finger of FINGER_WORKLOAD_FINGERS) {
				const level = (handCandidate as Record<string, unknown>)[finger];
				if (isFingerWorkloadLevel(level)) normalized[analyzer][hand][finger] = level;
			}
		}
	}
	return normalized;
}

export function hasConfiguredFingerWorkloadHandPreference(
	preference: FingerWorkloadHandPreference
): boolean {
	return FINGER_WORKLOAD_FINGERS.some((finger) => preference[finger] !== 'none');
}

export function hasConfiguredFingerWorkloadPreference(
	preference: FingerWorkloadPreference
): boolean {
	return FINGER_WORKLOAD_HANDS.some((hand) =>
		hasConfiguredFingerWorkloadHandPreference(preference[hand])
	);
}

export function hasConfiguredFingerWorkloadPreferences(
	preferences: FingerWorkloadPreferences
): boolean {
	return STAT_ANALYZERS.some(({ value }) =>
		hasConfiguredFingerWorkloadPreference(preferences[value])
	);
}

export function fingerWorkloadHandPreferencesEqual(
	first: FingerWorkloadHandPreference,
	second: FingerWorkloadHandPreference
): boolean {
	return FINGER_WORKLOAD_FINGERS.every((finger) => first[finger] === second[finger]);
}

/** A relative hand filter needs at least two distinct configured levels to compare. */
export function hasActiveFingerWorkloadHandPreference(
	preference: FingerWorkloadHandPreference
): boolean {
	const ranks = new Set(
		FINGER_WORKLOAD_FINGERS.map((finger) => preference[finger])
			.filter((level) => level !== 'none')
			.map((level) => LEVEL_RANK[level])
	);
	return ranks.size >= 2;
}

export function hasActiveFingerWorkloadPreference(preference: FingerWorkloadPreference): boolean {
	return FINGER_WORKLOAD_HANDS.some((hand) =>
		hasActiveFingerWorkloadHandPreference(preference[hand])
	);
}

export function analyzersNeededForFingerWorkloadPreferences(
	preferences: FingerWorkloadPreferences
): StatsAnalyzer[] {
	return STAT_ANALYZERS.map(({ value }) => value).filter((analyzer) =>
		hasActiveFingerWorkloadPreference(preferences[analyzer])
	);
}

export function formatFingerWorkloadHandPreference(
	preference: FingerWorkloadHandPreference
): string {
	const groups = [4, 3, 2, 1]
		.map((rank) =>
			FINGER_WORKLOAD_FINGERS.filter((finger) => LEVEL_RANK[preference[finger]] === rank).map(
				(finger) => FINGER_LABEL[finger]
			)
		)
		.filter((group) => group.length > 0);
	return groups.map((group) => group.join('/')).join(' > ');
}

export function formatFingerWorkloadPreference(preference: FingerWorkloadPreference): string {
	if (
		hasConfiguredFingerWorkloadHandPreference(preference.left) &&
		fingerWorkloadHandPreferencesEqual(preference.left, preference.right)
	) {
		return `Both ${formatFingerWorkloadHandPreference(preference.left)}`;
	}

	const hands = FINGER_WORKLOAD_HANDS.flatMap((hand) => {
		if (!hasConfiguredFingerWorkloadHandPreference(preference[hand])) return [];
		const label = hand === 'left' ? 'LH' : 'RH';
		return [`${label} ${formatFingerWorkloadHandPreference(preference[hand])}`];
	});
	return hands.join(' · ');
}

function matchesFingerWorkloadHandPreference(
	stats: Record<string, number>,
	hand: FingerWorkloadHand,
	preference: FingerWorkloadHandPreference
): boolean {
	if (!hasActiveFingerWorkloadHandPreference(preference)) return true;

	const configured = FINGER_WORKLOAD_FINGERS.filter((finger) => preference[finger] !== 'none');
	for (let firstIndex = 0; firstIndex < configured.length; firstIndex++) {
		for (let secondIndex = firstIndex + 1; secondIndex < configured.length; secondIndex++) {
			const first = configured[firstIndex];
			const second = configured[secondIndex];
			const firstRank = LEVEL_RANK[preference[first]];
			const secondRank = LEVEL_RANK[preference[second]];
			if (firstRank === secondRank) continue;

			const higher = firstRank > secondRank ? first : second;
			const lower = firstRank > secondRank ? second : first;
			const higherUsage = stats[HAND_STAT_KEYS[hand][higher]];
			const lowerUsage = stats[HAND_STAT_KEYS[hand][lower]];
			if (!Number.isFinite(higherUsage) || !Number.isFinite(lowerUsage)) return false;
			if (higherUsage <= lowerUsage) return false;
		}
	}

	return true;
}

export function matchesFingerWorkloadPreference(
	stats: Record<string, number>,
	preference: FingerWorkloadPreference
): boolean {
	return FINGER_WORKLOAD_HANDS.every((hand) =>
		matchesFingerWorkloadHandPreference(stats, hand, preference[hand])
	);
}
