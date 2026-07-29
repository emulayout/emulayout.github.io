import { repeatKeyMappingId, type DisabledInputMappingIds } from '$lib/inputMappingControls';

export const DEFAULT_REPEAT_KEY = '@';

export interface RepeatKeyProfile {
	trigger: typeof DEFAULT_REPEAT_KEY;
}

export interface RepeatKeyOutputResult {
	text: string;
	matched: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * `@` is a repeat key by convention unless a curated magic mapping explicitly
 * claims that trigger.
 */
export function hasDefaultRepeatKey(rawLayoutKeys: unknown, rawMagicMappings?: unknown): boolean {
	if (!isRecord(rawLayoutKeys) || !hasOwn(rawLayoutKeys, DEFAULT_REPEAT_KEY)) return false;
	return !isRecord(rawMagicMappings) || !hasOwn(rawMagicMappings, DEFAULT_REPEAT_KEY);
}

export function compileRepeatKeyProfile(
	rawLayoutKeys: unknown,
	rawMagicMappings?: unknown
): RepeatKeyProfile | undefined {
	return hasDefaultRepeatKey(rawLayoutKeys, rawMagicMappings)
		? { trigger: DEFAULT_REPEAT_KEY }
		: undefined;
}

export function resolveRepeatKeyOutput(
	profile: RepeatKeyProfile | undefined,
	inputHistory: string,
	inputText: string,
	disabledMappingIds?: DisabledInputMappingIds
): RepeatKeyOutputResult {
	if (
		!profile ||
		inputText !== profile.trigger ||
		disabledMappingIds?.has(repeatKeyMappingId(profile.trigger))
	) {
		return { text: inputText, matched: false };
	}

	const lastCharacter = Array.from(inputHistory).at(-1);
	return lastCharacter === undefined
		? { text: inputText, matched: false }
		: { text: lastCharacter, matched: true };
}
