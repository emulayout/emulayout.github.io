import {
	compileAdaptiveSwapSource,
	resolveAdaptiveSwap,
	type AdaptiveSwapProfile
} from '$lib/adaptiveSwaps';
import {
	compileMagicKeyMappings,
	resolveMagicKeyOutput,
	type MagicKeyProfile
} from '$lib/magicKeys';
import {
	compileRepeatKeyProfile,
	DEFAULT_REPEAT_KEY,
	resolveRepeatKeyOutput,
	type RepeatKeyProfile
} from '$lib/repeatKeys';
import {
	validateLayoutSupplemental,
	type LayoutSupplementalMeta,
	type LayoutSupplementalVariant
} from '$lib/layoutSupplemental';
import type { DisabledInputMappingIds } from '$lib/inputMappingControls';
import type { LayoutData } from '$lib/layout';

export type LayoutInputVariantSource = Partial<LayoutSupplementalVariant>;

type LayoutInputLayout = Pick<LayoutData, 'name' | 'keys'> &
	Partial<Pick<LayoutData, 'hasRepeatKey'>>;

export interface LayoutInputProfile {
	magicKeys?: MagicKeyProfile;
	repeatKey?: RepeatKeyProfile;
	adaptiveSwaps?: AdaptiveSwapProfile;
	maxHistoryLength: number;
	variantId?: string;
	variantLabel?: string;
	/** Author-declared: superseded by a newer set but still usable. */
	outdated?: boolean;
	/** Sync-derived: references a key the layout no longer has. */
	stale?: boolean;
}

export interface CompiledSupplementalVariant {
	id: string;
	label?: string;
	description?: string;
	outdated?: boolean;
	stale?: boolean;
	profile: LayoutInputProfile;
}

export interface CompiledLayoutSupplemental {
	meta?: LayoutSupplementalMeta;
	variants: readonly CompiledSupplementalVariant[];
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
	variant: LayoutInputVariantSource,
	rawLayoutKeys?: unknown,
	repeatKeyEnabled = Boolean(compileRepeatKeyProfile(rawLayoutKeys, variant.magicKeys?.mappings))
): LayoutInputProfile {
	const magicKeys = variant.magicKeys
		? compileMagicKeyMappings(variant.magicKeys.mappings)
		: undefined;
	const repeatKey =
		repeatKeyEnabled && !magicKeys?.triggers[DEFAULT_REPEAT_KEY]
			? compileRepeatKeyProfile(rawLayoutKeys)
			: undefined;
	const adaptiveSwaps = variant.adaptiveSwaps
		? compileAdaptiveSwapSource(variant.adaptiveSwaps)
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
		),
		...(variant.id ? { variantId: variant.id } : {}),
		...(variant.label ? { variantLabel: variant.label } : {}),
		...(variant.outdated ? { outdated: true } : {}),
		...(variant.stale ? { stale: true } : {})
	};
}

/**
 * Compact metadata is authoritative for the variant the runtime loads first.
 * Later variants re-derive because that flag is scoped to the default one and
 * an alternative may claim `@` as a magic trigger while the default does not.
 */
function repeatEnabledForVariant(
	layout: LayoutInputLayout | undefined,
	variant: LayoutSupplementalVariant,
	isDefault: boolean
): boolean {
	const derived = Boolean(compileRepeatKeyProfile(layout?.keys, variant.magicKeys?.mappings));
	return isDefault ? (layout?.hasRepeatKey ?? derived) : derived;
}

/**
 * Compile the published supplemental payload. Entries that fail validation are
 * dropped with a warning so one bad record cannot break the whole catalog.
 */
export function compileLayoutSupplementalRegistry(
	value: unknown,
	layouts: readonly LayoutInputLayout[] = []
): ReadonlyMap<string, CompiledLayoutSupplemental> {
	const entries = new Map<string, CompiledLayoutSupplemental>();
	const sources =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const layoutByName = new Map(layouts.map((layout) => [layout.name, layout]));

	for (const [layoutName, rawEntry] of Object.entries(sources)) {
		const layout = layoutByName.get(layoutName);
		try {
			const supplemental = validateLayoutSupplemental(rawEntry, { derived: true });
			entries.set(layoutName, {
				...(supplemental.meta ? { meta: supplemental.meta } : {}),
				variants: supplemental.variants.map((variant, index) => ({
					id: variant.id,
					...(variant.label ? { label: variant.label } : {}),
					...(variant.description ? { description: variant.description } : {}),
					...(variant.outdated ? { outdated: true } : {}),
					...(variant.stale ? { stale: true } : {}),
					profile: compileLayoutInputProfile(
						variant,
						layout?.keys,
						repeatEnabledForVariant(layout, variant, index === 0)
					)
				}))
			});
		} catch (error) {
			console.warn(`Ignoring invalid supplemental data for ${layoutName}:`, error);
		}
	}
	return entries;
}

/**
 * The profile each layout loads by default: its first variant, or a repeat-only
 * profile for a layout whose `@` needs no exported mapping data.
 */
export function compileLayoutInputRegistry(
	value: unknown,
	layouts: readonly LayoutInputLayout[] = []
): ReadonlyMap<string, LayoutInputProfile> {
	const profiles = new Map<string, LayoutInputProfile>();
	for (const [layoutName, entry] of compileLayoutSupplementalRegistry(value, layouts)) {
		const defaultVariant = entry.variants[0];
		if (defaultVariant) profiles.set(layoutName, defaultVariant.profile);
	}

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
