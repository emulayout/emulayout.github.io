import {
	compileAdaptiveSwapSource,
	resolveAdaptiveSwap,
	type AdaptiveSwapProfile,
	type AdaptiveSwapSource
} from '$lib/adaptiveSwaps';
import {
	compileMagicKeyMappings,
	resolveMagicKeyOutput,
	type MagicKeyMappings,
	type MagicKeyProfile
} from '$lib/magicKeys';
import type { DisabledInputMappingIds } from '$lib/inputMappingControls';

export interface LayoutInputBehaviorSource {
	magicKeys?: MagicKeyMappings;
	adaptiveSwaps?: AdaptiveSwapSource;
}

export type LayoutInputBehaviorsByLayout = Readonly<Record<string, LayoutInputBehaviorSource>>;

export interface LayoutInputProfile {
	magicKeys?: MagicKeyProfile;
	adaptiveSwaps?: AdaptiveSwapProfile;
	maxHistoryLength: number;
}

export type AppliedLayoutInputBehavior = 'adaptive-swap' | 'magic-key';

export interface LayoutInputResult {
	text: string;
	nextHistory: string;
	applied: readonly AppliedLayoutInputBehavior[];
}

function trimContext(context: string, maxLength: number): string {
	if (maxLength <= 0) return '';
	return Array.from(context).slice(-maxLength).join('');
}

export function compileLayoutInputProfile(value: LayoutInputBehaviorSource): LayoutInputProfile {
	const magicKeys = value.magicKeys ? compileMagicKeyMappings(value.magicKeys) : undefined;
	const adaptiveSwaps = value.adaptiveSwaps
		? compileAdaptiveSwapSource(value.adaptiveSwaps)
		: undefined;
	if (!magicKeys && !adaptiveSwaps) {
		throw new Error('Layout input profile must contain at least one behavior');
	}

	return {
		...(magicKeys ? { magicKeys } : {}),
		...(adaptiveSwaps ? { adaptiveSwaps } : {}),
		maxHistoryLength: Math.max(magicKeys?.maxHistoryLength ?? 0, adaptiveSwaps ? 1 : 0)
	};
}

export function compileLayoutInputRegistry(
	value: unknown
): ReadonlyMap<string, LayoutInputProfile> {
	const profiles = new Map<string, LayoutInputProfile>();
	if (!value || typeof value !== 'object' || Array.isArray(value)) return profiles;

	for (const [layoutName, source] of Object.entries(value)) {
		if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
		try {
			profiles.set(layoutName, compileLayoutInputProfile(source as LayoutInputBehaviorSource));
		} catch (error) {
			console.warn(`Ignoring invalid input-behavior profile ${layoutName}:`, error);
		}
	}
	return profiles;
}

/**
 * Resolve one uninterrupted logical keypress. Adaptive swaps run first; their
 * logical output may then act as a magic-key trigger. The final emitted text is
 * appended once to the shared history so either behavior can arm the next key.
 */
export function resolveLayoutInput(
	profile: LayoutInputProfile | undefined,
	inputHistory: string,
	inputText: string,
	disabledMappingIds?: DisabledInputMappingIds
): LayoutInputResult {
	if (!profile) {
		return {
			text: inputText,
			nextHistory: '',
			applied: []
		};
	}

	const adaptive = resolveAdaptiveSwap(
		profile.adaptiveSwaps,
		inputHistory,
		inputText,
		disabledMappingIds
	);
	const magic = resolveMagicKeyOutput(
		profile.magicKeys,
		inputHistory,
		adaptive.text,
		disabledMappingIds
	);
	const applied: AppliedLayoutInputBehavior[] = [];
	if (adaptive.matched) applied.push('adaptive-swap');
	if (magic.matched) applied.push('magic-key');

	return {
		text: magic.text,
		nextHistory: trimContext(inputHistory + magic.text, profile.maxHistoryLength),
		applied
	};
}

export function inputMappingsLabel(features: {
	magicKeys: boolean;
	adaptiveSwaps: boolean;
}): string {
	if (features.magicKeys && features.adaptiveSwaps) return 'input mappings';
	if (features.adaptiveSwaps) return 'adaptive swap mappings';
	return 'magic key mappings';
}

export function inputProfileMappingsLabel(profile: LayoutInputProfile): string {
	return inputMappingsLabel({
		magicKeys: Boolean(profile.magicKeys),
		adaptiveSwaps: Boolean(profile.adaptiveSwaps)
	});
}
