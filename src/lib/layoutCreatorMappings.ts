import type { AdaptiveSwapMappings, AdaptiveSwapSource } from '$lib/adaptiveSwaps';
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

function mappingsFromAdaptiveRules(
	rules: readonly CreatorAdaptiveRule[]
): AdaptiveSwapMappings | undefined {
	const mappings: Record<string, Record<string, string>> = {};
	for (const rule of rules) {
		const trigger = rule.trigger.trim();
		const left = rule.left.trim();
		const right = rule.right.trim();
		if (!isSingleCharacter(trigger) || !isSingleCharacter(left) || !isSingleCharacter(right)) {
			continue;
		}
		if (left.toLowerCase() === right.toLowerCase()) continue;
		const swaps = (mappings[trigger] ??= {});
		if (swaps[left] !== undefined) continue;
		swaps[left] = right;
	}
	return Object.keys(mappings).length > 0 ? mappings : undefined;
}

export function magicSourceFromDraft(draft: CreatorMagicDraft): MagicKeySource | undefined {
	const byTrigger = new Map<
		string,
		{ rules: Record<string, string>; fallback?: MagicKeyFallbackSource }
	>();

	for (const section of draft.sections) {
		const trigger = section.trigger.trim();
		if (!trigger) continue;

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
	draft: CreatorAdaptiveDraft
): AdaptiveSwapSource | undefined {
	const mappings = mappingsFromAdaptiveRules(draft.rules);
	const groups = draft.groups.flatMap((group) => {
		const label = group.label.trim();
		const groupMappings = mappingsFromAdaptiveRules(group.rules);
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

/** Compile complete draft rules into a practice profile. Incomplete rows are omitted. */
export function compileCreatorInputProfile(
	magicEnabled: boolean,
	magicDraft: CreatorMagicDraft,
	adaptiveEnabled: boolean,
	adaptiveDraft: CreatorAdaptiveDraft
): LayoutInputProfile | undefined {
	const magicKeys = magicEnabled ? magicSourceFromDraft(magicDraft) : undefined;
	const adaptiveSwaps = adaptiveEnabled ? adaptiveSourceFromDraft(adaptiveDraft) : undefined;
	const combined = compileFeatureProfile(magicKeys, adaptiveSwaps);
	if (combined) return combined;
	return (
		compileFeatureProfile(magicKeys, undefined) ?? compileFeatureProfile(undefined, adaptiveSwaps)
	);
}
