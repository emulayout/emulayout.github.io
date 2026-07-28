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

export function adaptiveRuleMappingId(
	groupId: string | undefined,
	rule: { trigger: string; left: string; right: string }
): string {
	return mappingId('adaptive-rule', [groupId ?? '', rule.trigger, rule.left, rule.right]);
}
