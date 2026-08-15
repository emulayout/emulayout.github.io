import { resolveAdaptiveSwap, type AdaptiveSwapProfile } from '$lib/adaptiveSwaps';
import { resolveMagicKeyOutput, type MagicKeyProfile } from '$lib/magicKeys';

export type LayoutKeyboardFeedbackKind = 'magic' | 'adaptive';

export interface LayoutKeyboardKeyFeedback {
	kind: LayoutKeyboardFeedbackKind;
	/** The value this key would emit from the current uninterrupted input history. */
	value?: string;
	/** Whether the key currently has contextual behavior, which controls active styling. */
	active?: boolean;
}

export type LayoutKeyboardFeedback = ReadonlyMap<string, LayoutKeyboardKeyFeedback>;

export interface LayoutKeyboardSwapPath {
	from: string;
	to: string;
}

/** Presentation passed to a custom keyboard snippet in the shared workspace. */
export interface LayoutKeyboardPresentation {
	feedback: LayoutKeyboardFeedback;
	swapPaths: readonly LayoutKeyboardSwapPath[];
	highlightedKeys: readonly string[];
	unreachableKeys: readonly string[];
	highlightHomeKeys: boolean;
}

/**
 * Build the current styled-keyboard presentation for every Magic trigger.
 * This remains independently composable with Adaptive/keyswap feedback.
 */
export function buildMagicKeyboardFeedback(
	profile: MagicKeyProfile | undefined,
	inputHistory: string,
	disabledMappingIds: readonly string[] = [],
	knownTriggers: readonly string[] = []
): LayoutKeyboardFeedback {
	const feedback = new Map<string, LayoutKeyboardKeyFeedback>();
	for (const trigger of knownTriggers) feedback.set(trigger, { kind: 'magic' });
	if (!profile) return feedback;

	const disabledMappings = new Set(disabledMappingIds);
	for (const trigger of Object.keys(profile.triggers)) {
		const result = resolveMagicKeyOutput(profile, inputHistory, trigger, disabledMappings);
		feedback.set(trigger, {
			kind: 'magic',
			...(result.text ? { value: result.text, active: true } : {})
		});
	}

	return feedback;
}

/** Build the currently armed, bidirectional Adaptive swaps. */
export function buildAdaptiveKeyboardFeedback(
	profile: AdaptiveSwapProfile | undefined,
	inputHistory: string,
	disabledMappingIds: readonly string[] = []
): LayoutKeyboardFeedback {
	const feedback = new Map<string, LayoutKeyboardKeyFeedback>();
	if (!profile) return feedback;

	const trigger = Array.from(inputHistory.toLowerCase()).at(-1);
	if (!trigger) return feedback;

	const disabledMappings = new Set(disabledMappingIds);
	for (const key of Object.keys(profile.byTrigger[trigger] ?? {})) {
		const result = resolveAdaptiveSwap(profile, inputHistory, key, disabledMappings);
		if (!result.matched) continue;
		feedback.set(key, { kind: 'adaptive', value: result.text, active: true });
	}

	return feedback;
}

/**
 * Keep only Adaptive pairs containing a physical key that can emit the next
 * required typing-practice output. Non-Adaptive feedback remains composable.
 */
export function filterAdaptiveKeyboardFeedbackByKeys(
	feedback: LayoutKeyboardFeedback,
	relevantKeys: readonly string[] | undefined
): LayoutKeyboardFeedback {
	if (relevantKeys === undefined) return feedback;

	const relevant = new Set(relevantKeys.map((key) => key.toLowerCase()));
	const visibleAdaptiveKeys = new Set<string>();
	for (const [key, state] of feedback) {
		if (state.kind !== 'adaptive' || !state.active || !state.value) continue;
		if (!relevant.has(key.toLowerCase())) continue;
		visibleAdaptiveKeys.add(key.toLowerCase());
		visibleAdaptiveKeys.add(state.value.toLowerCase());
	}

	return new Map(
		Array.from(feedback).filter(
			([key, state]) => state.kind !== 'adaptive' || visibleAdaptiveKeys.has(key.toLowerCase())
		)
	);
}

/** Build connectors from the Adaptive feedback that is actually visible. */
export function buildAdaptiveKeyboardSwapPathsFromFeedback(
	feedback: LayoutKeyboardFeedback
): readonly LayoutKeyboardSwapPath[] {
	const paths: LayoutKeyboardSwapPath[] = [];
	const seen = new Set<string>();

	for (const [from, state] of feedback) {
		if (state.kind !== 'adaptive' || !state.active || !state.value) continue;
		const pair = [from, state.value].sort();
		const id = `${pair[0]}\0${pair[1]}`;
		if (seen.has(id)) continue;
		seen.add(id);
		paths.push({ from: pair[0], to: pair[1] });
	}

	return paths;
}

/** Build one undirected connector for each currently armed Adaptive pair. */
export function buildAdaptiveKeyboardSwapPaths(
	profile: AdaptiveSwapProfile | undefined,
	inputHistory: string,
	disabledMappingIds: readonly string[] = []
): readonly LayoutKeyboardSwapPath[] {
	const feedback = buildAdaptiveKeyboardFeedback(profile, inputHistory, disabledMappingIds);
	return buildAdaptiveKeyboardSwapPathsFromFeedback(feedback);
}

export interface LayoutKeyboardFeedbackOptions {
	magicKeys?: MagicKeyProfile;
	adaptiveSwaps?: AdaptiveSwapProfile;
	inputHistory: string;
	disabledMappingIds?: readonly string[];
	knownMagicTriggers?: readonly string[];
}

/**
 * Compose contextual feedback in input-resolution order. An armed Adaptive
 * swap replaces presentation for the physical key because it changes that
 * key before Magic behavior is considered.
 */
export function buildLayoutKeyboardFeedback({
	magicKeys,
	adaptiveSwaps,
	inputHistory,
	disabledMappingIds = [],
	knownMagicTriggers = []
}: LayoutKeyboardFeedbackOptions): LayoutKeyboardFeedback {
	return new Map([
		...buildMagicKeyboardFeedback(magicKeys, inputHistory, disabledMappingIds, knownMagicTriggers),
		...buildAdaptiveKeyboardFeedback(adaptiveSwaps, inputHistory, disabledMappingIds)
	]);
}
