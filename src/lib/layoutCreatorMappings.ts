import type { AdaptiveSwapMappings, AdaptiveSwapSource } from '$lib/adaptiveSwaps';
import {
	adaptiveProfileMappingIds,
	magicFallbackMappingId,
	magicProfileMappingIds,
	magicRuleMappingId
} from '$lib/inputMappingControls';
import { compileLayoutInputProfile, type LayoutInputProfile } from '$lib/layoutInputBehaviors';
import { CREATOR_MAGIC_KEY } from '$lib/layoutCreator';
import {
	validateLayoutSupplemental,
	type LayoutSupplementalByLayout,
	type MagicKeySource
} from '$lib/layoutSupplemental';
import type {
	ExtendedMagicKeyTriggerSource,
	MagicKeyFallbackSource,
	MagicKeyRules
} from '$lib/magicKeys';
import { DEFAULT_REPEAT_KEY } from '$lib/repeatKeys';

export type CreatorMagicRule = {
	id: string;
	after: string;
	emit: string;
};

export type CreatorMagicFallbackKind = 'no-op' | 'repeat-last' | 'emit';

export type CreatorMagicSection = {
	id: string;
	trigger: string;
	rules: CreatorMagicRule[];
	fallbackKind: CreatorMagicFallbackKind;
	fallbackEmit: string;
};

export type CreatorMagicDraft = {
	sections: CreatorMagicSection[];
};

export type CreatorAdaptiveRule = {
	id: string;
	trigger: string;
	left: string;
	right: string;
};

export type CreatorAdaptiveSection = {
	id: string;
	label: string;
	rules: CreatorAdaptiveRule[];
};

export type CreatorAdaptiveDraft = {
	rules: CreatorAdaptiveRule[];
	groups: CreatorAdaptiveSection[];
};

let nextCreatorMappingId = 0;

function createCreatorMappingId(prefix: string): string {
	nextCreatorMappingId += 1;
	return `${prefix}-${nextCreatorMappingId}`;
}

export function createCreatorMagicRule(): CreatorMagicRule {
	return { id: createCreatorMappingId('magic-rule'), after: '', emit: '' };
}

export function createCreatorMagicSection(trigger = CREATOR_MAGIC_KEY): CreatorMagicSection {
	return {
		id: createCreatorMappingId('magic-section'),
		trigger,
		rules: [createCreatorMagicRule()],
		fallbackKind: 'no-op',
		fallbackEmit: ''
	};
}

/** Compile a section fallback only when it can emit. Omitted and `no-op` are equivalent. */
export function creatorMagicFallbackSource(
	section: Pick<CreatorMagicSection, 'fallbackKind' | 'fallbackEmit'>
): MagicKeyFallbackSource | undefined {
	if (section.fallbackKind === 'repeat-last') return 'repeat-last';
	if (section.fallbackKind === 'emit' && section.fallbackEmit.trim()) {
		return { emit: section.fallbackEmit };
	}
	return undefined;
}

export function createEmptyCreatorMagicDraft(): CreatorMagicDraft {
	return { sections: [createCreatorMagicSection()] };
}

export function isDefaultCreatorMagicDraft(draft: CreatorMagicDraft): boolean {
	if (draft.sections.length !== 1) return false;
	const [section] = draft.sections;
	return (
		section.trigger === CREATOR_MAGIC_KEY &&
		section.fallbackKind === 'no-op' &&
		section.fallbackEmit === '' &&
		section.rules.length === 1 &&
		section.rules[0].after === '' &&
		section.rules[0].emit === ''
	);
}

export function creatorMagicDraftHasTrigger(draft: CreatorMagicDraft, trigger: string): boolean {
	const normalized = trigger.trim();
	return draft.sections.some((section) => section.trigger.trim() === normalized);
}

/** Add a Magic section for a typed trigger. Existing sections are never removed.
 *  `@` starts as fallback-only; `*` keeps the empty mapping row. */
export function ensureCreatorMagicTrigger(
	draft: CreatorMagicDraft,
	trigger: string,
	options: { replaceUnusedPlaceholder?: boolean } = {}
): CreatorMagicDraft {
	const normalized = trigger.trim();
	if (!normalized || creatorMagicDraftHasTrigger(draft, normalized)) return draft;

	const section =
		normalized === DEFAULT_REPEAT_KEY
			? {
					id: createCreatorMappingId('magic-section'),
					trigger: normalized,
					rules: [],
					fallbackKind: 'repeat-last' as const,
					fallbackEmit: ''
				}
			: createCreatorMagicSection(normalized);
	const baseSections =
		options.replaceUnusedPlaceholder && isDefaultCreatorMagicDraft(draft) ? [] : draft.sections;
	return { sections: [...baseSections, section] };
}

export function createCreatorAdaptiveRule(): CreatorAdaptiveRule {
	return { id: createCreatorMappingId('adaptive-rule'), trigger: '', left: '', right: '' };
}

export function createCreatorAdaptiveSection(label = 'New section'): CreatorAdaptiveSection {
	return {
		id: createCreatorMappingId('adaptive-section'),
		label,
		rules: [createCreatorAdaptiveRule()]
	};
}

export function createEmptyCreatorAdaptiveDraft(): CreatorAdaptiveDraft {
	return { rules: [createCreatorAdaptiveRule()], groups: [] };
}

function isExtendedTriggerSource(
	value: MagicKeyRules | ExtendedMagicKeyTriggerSource
): value is ExtendedMagicKeyTriggerSource {
	if (!value || typeof value !== 'object' || Array.isArray(value) || !('rules' in value)) {
		return false;
	}
	const rules = value.rules;
	return Boolean(rules) && typeof rules === 'object' && !Array.isArray(rules);
}

function fallbackFieldsFromSource(fallback: MagicKeyFallbackSource | undefined): {
	fallbackKind: CreatorMagicFallbackKind;
	fallbackEmit: string;
} {
	if (fallback === 'repeat-last') return { fallbackKind: 'repeat-last', fallbackEmit: '' };
	if (fallback && typeof fallback === 'object') {
		return { fallbackKind: 'emit', fallbackEmit: fallback.emit };
	}
	return { fallbackKind: 'no-op', fallbackEmit: '' };
}

export function magicDraftFromSource(source: MagicKeySource | undefined): CreatorMagicDraft {
	if (!source) return createEmptyCreatorMagicDraft();

	const sections: CreatorMagicSection[] = [];
	for (const [trigger, rawTrigger] of Object.entries(source.mappings)) {
		const extended = isExtendedTriggerSource(rawTrigger);
		const rulesMap = extended ? rawTrigger.rules : rawTrigger;
		const fallback = extended ? rawTrigger.fallback : undefined;
		const rules = Object.entries(rulesMap).map(([after, emit]) => ({
			id: createCreatorMappingId('magic-rule'),
			after,
			emit
		}));
		sections.push({
			id: createCreatorMappingId('magic-section'),
			trigger,
			rules,
			...fallbackFieldsFromSource(fallback)
		});
	}

	return { sections: sections.length > 0 ? sections : [createCreatorMagicSection()] };
}

function adaptiveRulesFromMappings(
	mappings: AdaptiveSwapMappings | undefined
): CreatorAdaptiveRule[] {
	if (!mappings) return [];
	const rules: CreatorAdaptiveRule[] = [];
	for (const [trigger, swaps] of Object.entries(mappings)) {
		for (const [left, right] of Object.entries(swaps)) {
			rules.push({
				id: createCreatorMappingId('adaptive-rule'),
				trigger,
				left,
				right
			});
		}
	}
	return rules;
}

export function adaptiveDraftFromSource(
	source: AdaptiveSwapSource | undefined
): CreatorAdaptiveDraft {
	if (!source) return createEmptyCreatorAdaptiveDraft();

	const rules = adaptiveRulesFromMappings(source.mappings);
	const groups = (source.groups ?? []).map((group) => ({
		id: group.id,
		label: group.label,
		rules: adaptiveRulesFromMappings(group.mappings)
	}));
	if (rules.length === 0 && groups.length === 0) return createEmptyCreatorAdaptiveDraft();
	return { rules, groups };
}

export function creatorDraftsFromSupplemental(
	supplemental: LayoutSupplementalByLayout,
	layoutName: string
): {
	magicDraft: CreatorMagicDraft;
	adaptiveDraft: CreatorAdaptiveDraft;
	hasMagicMappings: boolean;
	hasAdaptiveMappings: boolean;
} {
	const raw = supplemental[layoutName];
	let magicKeys: MagicKeySource | undefined;
	let adaptiveSwaps: AdaptiveSwapSource | undefined;
	if (raw) {
		try {
			const variant = validateLayoutSupplemental(raw, { derived: true }).variants[0];
			magicKeys = variant?.magicKeys;
			adaptiveSwaps = variant?.adaptiveSwaps;
		} catch {
			magicKeys = undefined;
			adaptiveSwaps = undefined;
		}
	}

	return {
		magicDraft: magicDraftFromSource(magicKeys),
		adaptiveDraft: adaptiveDraftFromSource(adaptiveSwaps),
		hasMagicMappings: Boolean(magicKeys),
		hasAdaptiveMappings: Boolean(adaptiveSwaps)
	};
}

function isSingleCharacter(value: string): boolean {
	return Array.from(value).length === 1;
}

function normalizedAvailableKeys(availableKeys: readonly string[] | undefined): Set<string> | null {
	return availableKeys ? new Set(availableKeys.map((key) => key.toLowerCase())) : null;
}

function unavailableKeyError(
	value: string,
	label: string,
	availableKeys: ReadonlySet<string> | null
): string | null {
	if (!availableKeys || availableKeys.has(value.toLowerCase())) return null;
	return `${label} ${JSON.stringify(value)} is not assigned to the keyboard.`;
}

export function creatorMagicTriggerError(
	trigger: string,
	availableKeys?: readonly string[]
): string | null {
	const normalized = trigger.trim();
	if (!normalized) return null;
	if (!isSingleCharacter(normalized)) return 'A Magic trigger must be one key.';
	return unavailableKeyError(normalized, 'Magic trigger', normalizedAvailableKeys(availableKeys));
}

function creatorAdaptiveRuleError(
	rule: CreatorAdaptiveRule,
	availableKeys: ReadonlySet<string> | null
): string | null {
	const fields = [rule.trigger.trim(), rule.left.trim(), rule.right.trim()];
	if (fields.every((field) => !field)) return null;
	if (fields.some((field) => !field)) return null;
	if (fields.some((field) => !isSingleCharacter(field))) {
		return 'Adaptive triggers and swap keys must each be one key.';
	}
	const [trigger, left, right] = fields;
	if (left.toLowerCase() === right.toLowerCase()) {
		return 'An adaptive swap must use two different keys.';
	}
	return (
		unavailableKeyError(trigger, 'Adaptive trigger', availableKeys) ??
		unavailableKeyError(left, 'Adaptive key', availableKeys) ??
		unavailableKeyError(right, 'Adaptive key', availableKeys)
	);
}

function allAdaptiveRules(draft: CreatorAdaptiveDraft): CreatorAdaptiveRule[] {
	return [...draft.rules, ...draft.groups.flatMap((group) => group.rules)];
}

export function creatorAdaptiveDraftErrors(
	draft: CreatorAdaptiveDraft,
	availableKeys?: readonly string[]
): ReadonlyMap<string, string> {
	const errors = new Map<string, string>();
	const keys = normalizedAvailableKeys(availableKeys);
	const usedByTrigger = new Map<string, Set<string>>();
	for (const rule of allAdaptiveRules(draft)) {
		const error = creatorAdaptiveRuleError(rule, keys);
		if (error) {
			errors.set(rule.id, error);
			continue;
		}
		const trigger = rule.trigger.trim().toLowerCase();
		const left = rule.left.trim().toLowerCase();
		const right = rule.right.trim().toLowerCase();
		if (!trigger || !left || !right) continue;
		const used = usedByTrigger.get(trigger) ?? new Set<string>();
		if (used.has(left) || used.has(right)) {
			errors.set(rule.id, 'A key can only belong to one swap for the same trigger.');
			continue;
		}
		used.add(left);
		used.add(right);
		usedByTrigger.set(trigger, used);
	}
	return errors;
}

const ENGLISH_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function addEnglishLetters(target: Set<string>, value: string) {
	for (const character of value.toLowerCase()) {
		if (character >= 'a' && character <= 'z') target.add(character);
	}
}

/** Letters a Magic draft can produce when its trigger is on the keyboard. */
function magicEmittedLetters(
	draft: CreatorMagicDraft,
	availableKeys: readonly string[],
	disabledMappingIds: readonly string[]
): Set<string> {
	const letters = new Set<string>();
	const disabledIds = new Set(disabledMappingIds);
	for (const section of draft.sections) {
		const trigger = section.trigger.trim();
		if (!trigger || creatorMagicTriggerError(trigger, availableKeys)) continue;
		for (const rule of section.rules) {
			const after = rule.after.trim().toLowerCase();
			if (!after || !rule.emit.trim() || disabledIds.has(magicRuleMappingId(trigger, after))) {
				continue;
			}
			addEnglishLetters(letters, rule.emit);
		}
		if (
			section.fallbackKind === 'emit' &&
			section.fallbackEmit.trim() &&
			!disabledIds.has(magicFallbackMappingId(trigger))
		) {
			addEnglishLetters(letters, section.fallbackEmit);
		}
	}
	return letters;
}

/**
 * A–Z letters that are not on the keyboard and are not produced by a Magic
 * mapping whose trigger is on the keyboard.
 */
export function creatorLayoutMissingKeys(
	magicDraft: CreatorMagicDraft | undefined,
	availableKeys: readonly string[],
	disabledMappingIds: readonly string[] = []
): string[] {
	const covered = new Set(availableKeys.map((key) => key.toLowerCase()));
	if (magicDraft) {
		for (const letter of magicEmittedLetters(magicDraft, availableKeys, disabledMappingIds)) {
			covered.add(letter);
		}
	}

	const missing: string[] = [];
	for (const letter of ENGLISH_LETTERS) {
		if (!covered.has(letter)) missing.push(letter);
	}
	return missing;
}

function mappingsFromAdaptiveRules(
	rules: readonly CreatorAdaptiveRule[],
	availableKeys: ReadonlySet<string> | null,
	usedByTrigger: Map<string, Set<string>>
): AdaptiveSwapMappings | undefined {
	const mappings: Record<string, Record<string, string>> = {};
	for (const rule of rules) {
		const trigger = rule.trigger.trim();
		const left = rule.left.trim();
		const right = rule.right.trim();
		if (creatorAdaptiveRuleError(rule, availableKeys)) continue;
		if (!isSingleCharacter(trigger) || !isSingleCharacter(left) || !isSingleCharacter(right))
			continue;
		const normalizedTrigger = trigger.toLowerCase();
		const normalizedLeft = left.toLowerCase();
		const normalizedRight = right.toLowerCase();
		const used = usedByTrigger.get(normalizedTrigger) ?? new Set<string>();
		if (used.has(normalizedLeft) || used.has(normalizedRight)) continue;
		used.add(normalizedLeft);
		used.add(normalizedRight);
		usedByTrigger.set(normalizedTrigger, used);
		const swaps = (mappings[trigger] ??= {});
		swaps[left] = right;
	}
	return Object.keys(mappings).length > 0 ? mappings : undefined;
}

export function magicSourceFromDraft(
	draft: CreatorMagicDraft,
	availableKeys?: readonly string[]
): MagicKeySource | undefined {
	const byTrigger = new Map<
		string,
		{ rules: Record<string, string>; fallback?: MagicKeyFallbackSource }
	>();

	for (const section of draft.sections) {
		const trigger = section.trigger.trim();
		if (!trigger || creatorMagicTriggerError(trigger, availableKeys)) continue;

		const current = byTrigger.get(trigger) ?? { rules: {} };
		const seen = new Set(Object.keys(current.rules).map((after) => after.toLowerCase()));
		for (const rule of section.rules) {
			const after = rule.after.trim();
			const emit = rule.emit;
			if (!after || !emit.trim()) continue;
			const normalized = after.toLowerCase();
			if (seen.has(normalized) || current.rules[after] !== undefined) continue;
			seen.add(normalized);
			current.rules[after] = emit;
		}

		const fallback = creatorMagicFallbackSource(section);
		if (fallback) current.fallback = fallback;
		byTrigger.set(trigger, current);
	}

	const mappings: Record<string, MagicKeyRules | ExtendedMagicKeyTriggerSource> = {};
	for (const [trigger, { rules, fallback }] of byTrigger) {
		if (Object.keys(rules).length === 0 && !fallback) continue;
		mappings[trigger] = fallback ? { rules, fallback } : rules;
	}
	return Object.keys(mappings).length > 0 ? { mappings } : undefined;
}

export function adaptiveSourceFromDraft(
	draft: CreatorAdaptiveDraft,
	availableKeys?: readonly string[]
): AdaptiveSwapSource | undefined {
	const keys = normalizedAvailableKeys(availableKeys);
	const usedByTrigger = new Map<string, Set<string>>();
	const mappings = mappingsFromAdaptiveRules(draft.rules, keys, usedByTrigger);
	const groups = draft.groups.flatMap((group) => {
		const label = group.label.trim();
		const groupMappings = mappingsFromAdaptiveRules(group.rules, keys, usedByTrigger);
		if (!label || !groupMappings) return [];
		return [{ id: group.id, label, mappings: groupMappings }];
	});
	if (!mappings && groups.length === 0) return undefined;
	return {
		...(mappings ? { mappings } : {}),
		...(groups.length > 0 ? { groups } : {})
	};
}

function compileFeatureProfile(
	magicKeys: MagicKeySource | undefined,
	adaptiveSwaps: AdaptiveSwapSource | undefined
): LayoutInputProfile | undefined {
	if (!magicKeys && !adaptiveSwaps) return undefined;
	try {
		return compileLayoutInputProfile(
			{
				...(magicKeys ? { magicKeys } : {}),
				...(adaptiveSwaps ? { adaptiveSwaps } : {})
			},
			undefined,
			false
		);
	} catch {
		return undefined;
	}
}

export function creatorMagicDraftHasMappings(
	draft: CreatorMagicDraft,
	availableKeys?: readonly string[]
): boolean {
	return Boolean(magicSourceFromDraft(draft, availableKeys));
}

export function creatorAdaptiveDraftHasMappings(
	draft: CreatorAdaptiveDraft,
	availableKeys?: readonly string[]
): boolean {
	return Boolean(adaptiveSourceFromDraft(draft, availableKeys));
}

function someMappingEnabled(
	ids: readonly string[],
	disabledMappingIds: readonly string[]
): boolean {
	if (ids.length === 0) return false;
	const disabled = new Set(disabledMappingIds);
	return ids.some((id) => !disabled.has(id));
}

/** True when the draft compiles at least one mapping that is not disabled. */
export function creatorMagicDraftHasEnabledMappings(
	draft: CreatorMagicDraft,
	disabledMappingIds: readonly string[] = [],
	availableKeys?: readonly string[]
): boolean {
	const profile = compileFeatureProfile(magicSourceFromDraft(draft, availableKeys), undefined);
	return someMappingEnabled(magicProfileMappingIds(profile?.magicKeys), disabledMappingIds);
}

/** True when the draft compiles at least one mapping that is not disabled. */
export function creatorAdaptiveDraftHasEnabledMappings(
	draft: CreatorAdaptiveDraft,
	disabledMappingIds: readonly string[] = [],
	availableKeys?: readonly string[]
): boolean {
	const profile = compileFeatureProfile(undefined, adaptiveSourceFromDraft(draft, availableKeys));
	return someMappingEnabled(adaptiveProfileMappingIds(profile?.adaptiveSwaps), disabledMappingIds);
}

/** Compile complete draft rules into a practice profile. Incomplete rows are omitted. */
export function compileCreatorInputProfile(
	magicEnabled: boolean,
	magicDraft: CreatorMagicDraft,
	adaptiveEnabled: boolean,
	adaptiveDraft: CreatorAdaptiveDraft,
	availableKeys?: readonly string[]
): LayoutInputProfile | undefined {
	const magicKeys = magicEnabled ? magicSourceFromDraft(magicDraft, availableKeys) : undefined;
	const adaptiveSwaps = adaptiveEnabled
		? adaptiveSourceFromDraft(adaptiveDraft, availableKeys)
		: undefined;
	const combined = compileFeatureProfile(magicKeys, adaptiveSwaps);
	if (combined) return combined;
	return (
		compileFeatureProfile(magicKeys, undefined) ?? compileFeatureProfile(undefined, adaptiveSwaps)
	);
}
