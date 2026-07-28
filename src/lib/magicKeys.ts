import {
	magicFallbackMappingId,
	magicRuleMappingId,
	type DisabledInputMappingIds
} from '$lib/inputMappingControls';

export type MagicKeyFallback = 'repeat-last';

export type MagicKeyRules = Readonly<Record<string, string>>;

export interface ExtendedMagicKeyTriggerSource {
	mappings: MagicKeyRules;
	fallback?: MagicKeyFallback;
}

/**
 * trigger key -> either a compact rule map or an extended trigger definition.
 *
 * Preceding sequences are strings rather than single characters so a future
 * rule such as `"th": "e"` does not require a storage or resolver change.
 */
export type MagicKeyMappings = Readonly<
	Record<string, MagicKeyRules | ExtendedMagicKeyTriggerSource>
>;

export interface CompiledMagicKeyRule {
	after: string;
	emit: string;
}

export interface CompiledMagicKeyTrigger {
	rules: readonly CompiledMagicKeyRule[];
	fallback?: MagicKeyFallback;
}

export interface MagicKeyProfile {
	triggers: Readonly<Record<string, CompiledMagicKeyTrigger>>;
	maxHistoryLength: number;
}

export interface MagicKeyOutputResult {
	text: string;
	matched: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimContext(context: string, maxLength: number): string {
	if (maxLength <= 0) return '';
	const characters = Array.from(context);
	return characters.slice(-maxLength).join('');
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}

function isExtendedTriggerSource(
	value: MagicKeyRules | ExtendedMagicKeyTriggerSource
): value is ExtendedMagicKeyTriggerSource {
	return isRecord(value.mappings);
}

/**
 * Validate untrusted JSON and return a normalized profile with null-prototype
 * rule objects. Sync scripts use the same validator before publishing.
 */
export function validateMagicKeyMappings(value: unknown): MagicKeyMappings {
	if (!isRecord(value)) {
		throw new Error('Magic-key mappings must be an object');
	}

	const mappings: Record<string, MagicKeyRules | ExtendedMagicKeyTriggerSource> =
		Object.create(null);
	for (const [trigger, rawTrigger] of Object.entries(value)) {
		if (!trigger) throw new Error('Magic key triggers cannot be empty');
		if (!isRecord(rawTrigger)) {
			throw new Error(`Magic key "${trigger}" rules must be an object`);
		}

		const extended = hasOwn(rawTrigger, 'mappings') || hasOwn(rawTrigger, 'fallback');
		let rawRules: Record<string, unknown> = rawTrigger;
		let fallback: MagicKeyFallback | undefined;
		if (extended) {
			if (!isRecord(rawTrigger.mappings)) {
				throw new Error(`Magic key "${trigger}" mappings must be an object`);
			}
			rawRules = rawTrigger.mappings;
			for (const key of Object.keys(rawTrigger)) {
				if (key !== 'mappings' && key !== 'fallback') {
					throw new Error(`Magic key "${trigger}" has unknown option "${key}"`);
				}
			}
			if (hasOwn(rawTrigger, 'fallback')) {
				if (rawTrigger.fallback !== 'repeat-last') {
					throw new Error(`Magic key "${trigger}" fallback must be "repeat-last" when provided`);
				}
				fallback = rawTrigger.fallback;
			}
		}

		const rules: Record<string, string> = Object.create(null);
		const normalizedAfter = new Set<string>();
		for (const [after, emit] of Object.entries(rawRules)) {
			if (!after) throw new Error(`Magic key "${trigger}" has an empty preceding sequence`);
			if (typeof emit !== 'string' || !emit) {
				throw new Error(`Magic key "${trigger}" rule "${after}" must emit nonempty text`);
			}

			const normalized = after.toLowerCase();
			if (normalizedAfter.has(normalized)) {
				throw new Error(
					`Magic key "${trigger}" repeats preceding sequence "${after}" when normalized`
				);
			}
			normalizedAfter.add(normalized);
			rules[after] = emit;
		}

		if (Object.keys(rules).length === 0 && !fallback) {
			throw new Error(`Magic key "${trigger}" must have at least one rule`);
		}
		mappings[trigger] = extended ? { mappings: rules, ...(fallback ? { fallback } : {}) } : rules;
	}

	if (Object.keys(mappings).length === 0) {
		throw new Error('Magic-key mappings must contain at least one trigger');
	}
	return mappings;
}

export function compileMagicKeyMappings(value: unknown): MagicKeyProfile {
	const mappings = validateMagicKeyMappings(value);
	const triggers: Record<string, CompiledMagicKeyTrigger> = Object.create(null);
	let maxHistoryLength = 0;

	for (const [trigger, rawTrigger] of Object.entries(mappings)) {
		const extended = isExtendedTriggerSource(rawTrigger);
		const rawRules = extended ? rawTrigger.mappings : rawTrigger;
		const fallback: MagicKeyFallback | undefined = extended ? rawTrigger.fallback : undefined;
		const rules: CompiledMagicKeyRule[] = [];

		for (const [after, emit] of Object.entries(rawRules)) {
			rules.push({ after: after.toLowerCase(), emit });
			maxHistoryLength = Math.max(maxHistoryLength, Array.from(after).length);
		}

		// Longest suffix wins if both a one-key and multi-key rule could match.
		rules.sort((a, b) => Array.from(b.after).length - Array.from(a.after).length);
		triggers[trigger] = { rules, ...(fallback ? { fallback } : {}) };
		if (fallback === 'repeat-last') maxHistoryLength = Math.max(maxHistoryLength, 1);
	}

	return { triggers, maxHistoryLength };
}

export function resolveMagicKeyOutput(
	profile: MagicKeyProfile | undefined,
	inputHistory: string,
	inputText: string,
	disabledMappingIds?: DisabledInputMappingIds
): MagicKeyOutputResult {
	if (!profile) return { text: inputText, matched: false };

	const trigger = profile.triggers[inputText];
	if (trigger) {
		const normalizedHistory = trimContext(inputHistory.toLowerCase(), profile.maxHistoryLength);
		const rule = trigger.rules.find(
			({ after }) =>
				!disabledMappingIds?.has(magicRuleMappingId(inputText, after)) &&
				normalizedHistory.endsWith(after)
		);
		if (rule) return { text: rule.emit, matched: true };

		if (
			trigger.fallback === 'repeat-last' &&
			!disabledMappingIds?.has(magicFallbackMappingId(inputText))
		) {
			const lastCharacter = Array.from(inputHistory).at(-1);
			if (lastCharacter !== undefined) return { text: lastCharacter, matched: true };
		}

		return { text: inputText, matched: false };
	}

	return { text: inputText, matched: false };
}
