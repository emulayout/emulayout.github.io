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
