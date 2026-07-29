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
import {
	compileRepeatKeyProfile,
	DEFAULT_REPEAT_KEY,
	resolveRepeatKeyOutput,
	type RepeatKeyProfile
} from '$lib/repeatKeys';
import type { DisabledInputMappingIds } from '$lib/inputMappingControls';
import type { LayoutData } from '$lib/layout';

export interface LayoutInputBehaviorSource {
	magicKeys?: MagicKeyMappings;
	adaptiveSwaps?: AdaptiveSwapSource;
}

export type LayoutInputBehaviorsByLayout = Readonly<Record<string, LayoutInputBehaviorSource>>;

export interface LayoutInputProfile {
	magicKeys?: MagicKeyProfile;
	repeatKey?: RepeatKeyProfile;
	adaptiveSwaps?: AdaptiveSwapProfile;
	maxHistoryLength: number;
}

export type AppliedLayoutInputBehavior = 'adaptive-swap' | 'magic-key' | 'repeat-key';

export interface LayoutInputResult {
	text: string;
	nextHistory: string;
	applied: readonly AppliedLayoutInputBehavior[];
}

function trimContext(context: string, maxLength: number): string {
	if (maxLength <= 0) return '';
	return Array.from(context).slice(-maxLength).join('');
}

export function compileLayoutInputProfile(
	value: LayoutInputBehaviorSource,
	rawLayoutKeys?: unknown,
	repeatKeyEnabled = Boolean(compileRepeatKeyProfile(rawLayoutKeys, value.magicKeys))
): LayoutInputProfile {
	const magicKeys = value.magicKeys ? compileMagicKeyMappings(value.magicKeys) : undefined;
	const repeatKey =
		repeatKeyEnabled && !magicKeys?.triggers[DEFAULT_REPEAT_KEY]
			? compileRepeatKeyProfile(rawLayoutKeys)
			: undefined;
	const adaptiveSwaps = value.adaptiveSwaps
		? compileAdaptiveSwapSource(value.adaptiveSwaps)
		: undefined;
	if (!magicKeys && !repeatKey && !adaptiveSwaps) {
		throw new Error('Layout input profile must contain at least one behavior');
	}

	return {
		...(magicKeys ? { magicKeys } : {}),
		...(repeatKey ? { repeatKey } : {}),
		...(adaptiveSwaps ? { adaptiveSwaps } : {}),
		maxHistoryLength: Math.max(
			magicKeys?.maxHistoryLength ?? 0,
			repeatKey ? 1 : 0,
			adaptiveSwaps ? 1 : 0
		)
	};
}

export function compileLayoutInputRegistry(
	value: unknown,
	layouts: readonly (Pick<LayoutData, 'name' | 'keys'> &
		Partial<Pick<LayoutData, 'hasRepeatKey'>>)[] = []
): ReadonlyMap<string, LayoutInputProfile> {
	const profiles = new Map<string, LayoutInputProfile>();
	const sources =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const layoutByName = new Map(layouts.map((layout) => [layout.name, layout]));
	const layoutNames = new Set([...Object.keys(sources), ...layoutByName.keys()]);

	for (const layoutName of layoutNames) {
		const source = sources[layoutName];
		const layout = layoutByName.get(layoutName);
		const rawMagicMappings =
			source && typeof source === 'object' && !Array.isArray(source)
				? (source as LayoutInputBehaviorSource).magicKeys
				: undefined;
		const hasDefaultRepeat =
			layout?.hasRepeatKey ?? Boolean(compileRepeatKeyProfile(layout?.keys, rawMagicMappings));
		if (source === undefined && !hasDefaultRepeat) continue;
		if (source !== undefined && (!source || typeof source !== 'object' || Array.isArray(source))) {
			console.warn(`Ignoring invalid input-behavior profile ${layoutName}`);
			if (hasDefaultRepeat) {
				profiles.set(layoutName, compileLayoutInputProfile({}, layout?.keys, true));
			}
			continue;
		}
		try {
			profiles.set(
				layoutName,
				compileLayoutInputProfile(
					(source ?? {}) as LayoutInputBehaviorSource,
					layout?.keys,
					hasDefaultRepeat
				)
			);
		} catch (error) {
			console.warn(`Ignoring invalid input-behavior profile ${layoutName}:`, error);
			if (hasDefaultRepeat) {
				profiles.set(layoutName, compileLayoutInputProfile({}, layout?.keys, true));
			}
		}
	}
	return profiles;
}

/**
 * Resolve one uninterrupted logical keypress. Adaptive swaps run first; their
 * logical output may then act as a magic-key or repeat-key trigger. The final
 * emitted text is appended once to shared history so any behavior can arm the
 * next key.
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
	const repeat = magic.matched
		? { text: magic.text, matched: false }
		: resolveRepeatKeyOutput(profile.repeatKey, inputHistory, adaptive.text, disabledMappingIds);
	const applied: AppliedLayoutInputBehavior[] = [];
	if (adaptive.matched) applied.push('adaptive-swap');
	if (magic.matched) applied.push('magic-key');
	if (repeat.matched) applied.push('repeat-key');

	return {
		text: repeat.text,
		nextHistory: trimContext(inputHistory + repeat.text, profile.maxHistoryLength),
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
