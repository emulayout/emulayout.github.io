import type { AdaptiveSwapProfile, AdaptiveSwapRule } from '$lib/adaptiveSwaps';
import { magicFallbackEmits, type MagicKeyProfile } from '$lib/magicKeys';

export type DisabledInputMappingIds = ReadonlySet<string>;

function mappingId(kind: string, parts: readonly string[]): string {
	return JSON.stringify([kind, ...parts]);
}

export function magicRuleMappingId(trigger: string, after: string): string {
	return mappingId('magic-rule', [trigger, after]);
}

export function magicFallbackMappingId(trigger: string): string {
	return mappingId('magic-fallback', [trigger]);
}

export function repeatKeyMappingId(trigger: string): string {
	return mappingId('repeat-key', [trigger]);
}

export function adaptiveRuleMappingId(
	groupId: string | undefined,
	rule: { trigger: string; left: string; right: string }
): string {
	return mappingId('adaptive-rule', [groupId ?? '', rule.trigger, rule.left, rule.right]);
}

export function magicProfileMappingIds(profile: MagicKeyProfile | undefined): string[] {
	return Object.entries(profile?.triggers ?? {}).flatMap(([trigger, definition]) => [
		...definition.rules.map((rule) => magicRuleMappingId(trigger, rule.after)),
		...(magicFallbackEmits(definition.fallback) ? [magicFallbackMappingId(trigger)] : [])
	]);
}

export function adaptiveRulesMappingIds(
	rules: readonly AdaptiveSwapRule[],
	groupId?: string
): string[] {
	return rules.map((rule) => adaptiveRuleMappingId(groupId, rule));
}

export function adaptiveProfileMappingIds(profile: AdaptiveSwapProfile | undefined): string[] {
	return [
		...adaptiveRulesMappingIds(profile?.rules ?? []),
		...(profile?.groups ?? []).flatMap((group) => adaptiveRulesMappingIds(group.rules, group.id))
	];
}
