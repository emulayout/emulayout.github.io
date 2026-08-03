import { resolveMagicKeyOutput, type MagicKeyProfile } from '$lib/magicKeys';

export type LayoutKeyboardFeedbackKind = 'magic' | 'adaptive';

export interface LayoutKeyboardKeyFeedback {
	kind: LayoutKeyboardFeedbackKind;
	/** The value this key would emit from the current uninterrupted input history. */
	value?: string;
}

export type LayoutKeyboardFeedback = ReadonlyMap<string, LayoutKeyboardKeyFeedback>;

/**
 * Build the current styled-keyboard presentation for every Magic trigger.
 * Keeping this separate from the component leaves room for Adaptive/keyswap
 * feedback to feed the same rendering model later.
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
			...(result.text ? { value: result.text } : {})
		});
	}

	return feedback;
}
