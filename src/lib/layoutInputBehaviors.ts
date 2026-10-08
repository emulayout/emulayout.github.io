import { compileSparkLayout } from '$lib/sparkCompiler';
import {
	compileAdaptiveSwapSource,
	resolveAdaptiveSwap,
	type AdaptiveSwapSource,
	type AdaptiveSwapProfile
} from '$lib/adaptiveSwaps';
import {
	compileMagicKeyMappings,
	resolveMagicKeyOutput,
	type MagicKeySource,
	type MagicKeyProfile
} from '$lib/magicKeys';
import {
	compileRepeatKeyProfile,
	DEFAULT_REPEAT_KEY,
	resolveRepeatKeyOutput,
	type RepeatKeyProfile
} from '$lib/repeatKeys';
import { readCatalogSparkContent } from '$lib/catalogSpark';
import type { DisabledInputMappingIds } from '$lib/inputMappingControls';
import type { LayoutData } from '$lib/layout';
import {
	compileChiralKeys,
	resolveChiralKeyOutput,
	chiralRuleMappings,
	type ChiralKeySource,
	type ChiralKeyProfile
} from '$lib/chiralKeys';

/** Derived behavior sources; grouping and fixed-text fallbacks also serve the creator. */
export interface LayoutInputSource {
	magicKeys?: MagicKeySource;
	adaptiveSwaps?: AdaptiveSwapSource;
	chiralKeys?: ChiralKeySource;
}

type LayoutInputLayout = Pick<LayoutData, 'name' | 'keys'> &
	Partial<Pick<LayoutData, 'hasRepeatKey'>>;

export interface LayoutInputProfile {
	chiralKeys?: ChiralKeyProfile;
	magicKeys?: MagicKeyProfile;
	repeatKey?: RepeatKeyProfile;
	adaptiveSwaps?: AdaptiveSwapProfile;
	maxHistoryLength: number;
}

export type AppliedLayoutInputBehavior =
	| 'adaptive-swap'
	| 'magic-key'
	| 'repeat-key'
	| 'chiral-key';

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
	source: LayoutInputSource,
	rawLayoutKeys?: unknown,
	repeatKeyEnabled = Boolean(compileRepeatKeyProfile(rawLayoutKeys, source.magicKeys?.mappings))
): LayoutInputProfile {
	const magicKeys = source.magicKeys
		? compileMagicKeyMappings(source.magicKeys.mappings)
		: undefined;
	const chiralKeys = source.chiralKeys
		? compileChiralKeys(source.chiralKeys, rawLayoutKeys)
		: undefined;
	const repeatKey =
		repeatKeyEnabled &&
		!magicKeys?.triggers[DEFAULT_REPEAT_KEY] &&
		!chiralKeys?.keys.some((rule) => rule.key === DEFAULT_REPEAT_KEY)
			? compileRepeatKeyProfile(rawLayoutKeys)
			: undefined;
	const adaptiveSwaps = source.adaptiveSwaps
		? compileAdaptiveSwapSource(source.adaptiveSwaps)
		: undefined;
	if (!magicKeys && !repeatKey && !adaptiveSwaps && !chiralKeys) {
		throw new Error('Layout input profile must contain at least one behavior');
	}

	return {
		...(chiralKeys ? { chiralKeys } : {}),
		...(magicKeys ? { magicKeys } : {}),
		...(repeatKey ? { repeatKey } : {}),
		...(adaptiveSwaps ? { adaptiveSwaps } : {}),
		maxHistoryLength: Math.max(
			magicKeys?.maxHistoryLength ?? 0,
			repeatKey ? 1 : 0,
			adaptiveSwaps ? 1 : 0,
			chiralKeys ? 1 : 0
		)
	};
}

/** Compile Spark catalog entries, isolating malformed records from the rest of the catalog. */
export function compileLayoutInputRegistry(
	value: unknown,
	layouts: readonly LayoutInputLayout[] = []
): ReadonlyMap<string, LayoutInputProfile> {
	const profiles = new Map<string, LayoutInputProfile>();
	const sources =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	for (const [layoutName, rawEntry] of Object.entries(sources)) {
		try {
			const content = readCatalogSparkContent(rawEntry);
			const compiled = compileSparkLayout(content.layout);
			if (compiled.warnings.length)
				console.warn(`Spark compilation omissions for ${layoutName}:`, compiled.warnings);
			if (compiled.profile) profiles.set(layoutName, compiled.profile);
		} catch (error) {
			console.warn(`Ignoring invalid catalog Spark data for ${layoutName}:`, error);
		}
	}
	// Compact metadata remains authoritative when behavior data is missing or invalid.

	for (const layout of layouts) {
		if (profiles.has(layout.name)) continue;
		const hasDefaultRepeat = layout.hasRepeatKey ?? Boolean(compileRepeatKeyProfile(layout.keys));
		if (hasDefaultRepeat)
			profiles.set(layout.name, compileLayoutInputProfile({}, layout.keys, true));
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
	const chiral = magic.matched
		? { text: magic.text, matched: false }
		: resolveChiralKeyOutput(profile.chiralKeys, inputHistory, adaptive.text, disabledMappingIds);
	const repeat =
		magic.matched || chiral.matched
			? { text: chiral.text, matched: false }
			: resolveRepeatKeyOutput(profile.repeatKey, inputHistory, adaptive.text, disabledMappingIds);
	const applied: AppliedLayoutInputBehavior[] = [];
	if (adaptive.matched) applied.push('adaptive-swap');
	if (magic.matched) applied.push('magic-key');
	if (chiral.matched) applied.push('chiral-key');
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
	chiralKeys?: boolean;
}): string {
	if (features.chiralKeys)
		return features.magicKeys || features.adaptiveSwaps ? 'input mappings' : 'chiral key mappings';
	if (features.magicKeys && features.adaptiveSwaps) return 'input mappings';
	if (features.adaptiveSwaps) return 'adaptive swap mappings';
	return 'magic key mappings';
}

export function inputProfileMappingsLabel(profile: LayoutInputProfile): string {
	return inputMappingsLabel({
		chiralKeys: Boolean(profile.chiralKeys),
		magicKeys: Boolean(profile.magicKeys),
		adaptiveSwaps: Boolean(profile.adaptiveSwaps)
	});
}

/** Compatibility projection for shortcut planning; the runtime and UI retain native chirals. */
export function planningMagicProfile(
	profile: LayoutInputProfile | undefined,
	disabled?: DisabledInputMappingIds
): MagicKeyProfile | undefined {
	if (!profile?.chiralKeys) return profile?.magicKeys;
	const projected = chiralRuleMappings(profile.chiralKeys, disabled);
	const triggers = {
		...(Object.keys(projected).length ? compileMagicKeyMappings(projected).triggers : {}),
		...profile.magicKeys?.triggers
	};
	return { triggers, maxHistoryLength: Math.max(1, profile.magicKeys?.maxHistoryLength ?? 0) };
}
