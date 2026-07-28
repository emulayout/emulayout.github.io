/**
 * trigger key -> preceding key sequence -> text emitted by the magic key.
 *
 * Preceding sequences are strings rather than single characters so a future
 * rule such as `"th": "e"` does not require a storage or resolver change.
 */
export type MagicKeyMappings = Readonly<Record<string, Readonly<Record<string, string>>>>;
export type MagicKeyMappingsByLayout = Readonly<Record<string, MagicKeyMappings>>;

export interface CompiledMagicKeyRule {
	after: string;
	emit: string;
}

export interface MagicKeyProfile {
	triggers: Readonly<Record<string, readonly CompiledMagicKeyRule[]>>;
	maxHistoryLength: number;
}

export interface MagicKeyInputResult {
	text: string;
	matched: boolean;
	nextHistory: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimContext(context: string, maxLength: number): string {
	if (maxLength <= 0) return '';
	const characters = Array.from(context);
	return characters.slice(-maxLength).join('');
}

/**
 * Validate untrusted JSON and return a normalized profile with null-prototype
 * rule objects. Sync scripts use the same validator before publishing.
 */
export function validateMagicKeyMappings(value: unknown): MagicKeyMappings {
	if (!isRecord(value)) {
		throw new Error('Magic-key mappings must be an object');
	}

	const mappings: Record<string, Record<string, string>> = Object.create(null);
	for (const [trigger, rawRules] of Object.entries(value)) {
		if (!trigger) throw new Error('Magic key triggers cannot be empty');
		if (!isRecord(rawRules)) {
			throw new Error(`Magic key "${trigger}" rules must be an object`);
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

		if (Object.keys(rules).length === 0) {
			throw new Error(`Magic key "${trigger}" must have at least one rule`);
		}
		mappings[trigger] = rules;
	}

	if (Object.keys(mappings).length === 0) {
		throw new Error('Magic-key mappings must contain at least one trigger');
	}
	return mappings;
}

export function compileMagicKeyMappings(value: unknown): MagicKeyProfile {
	const mappings = validateMagicKeyMappings(value);
	const triggers: Record<string, CompiledMagicKeyRule[]> = Object.create(null);
	let maxHistoryLength = 0;

	for (const [trigger, rawRules] of Object.entries(mappings)) {
		const rules: CompiledMagicKeyRule[] = [];

		for (const [after, emit] of Object.entries(rawRules)) {
			rules.push({ after: after.toLowerCase(), emit });
			maxHistoryLength = Math.max(maxHistoryLength, Array.from(after).length);
		}

		// Longest suffix wins if both a one-key and multi-key rule could match.
		rules.sort((a, b) => Array.from(b.after).length - Array.from(a.after).length);
		triggers[trigger] = rules;
	}

	return { triggers, maxHistoryLength };
}

/**
 * Process one logical layout-key output and advance its bounded history.
 *
 * History represents uninterrupted logical key input, not the text around the
 * editor caret. Callers clear it when navigation or an external edit interrupts
 * that input sequence. Magic-key output is appended like ordinary input so it
 * can trigger a subsequent rule.
 */
export function resolveMagicKeyInput(
	profile: MagicKeyProfile | undefined,
	inputHistory: string,
	inputText: string
): MagicKeyInputResult {
	if (!profile) {
		return { text: inputText, matched: false, nextHistory: '' };
	}

	const rules = profile.triggers[inputText];
	if (rules) {
		const normalizedHistory = trimContext(inputHistory.toLowerCase(), profile.maxHistoryLength);
		const rule = rules.find(({ after }) => normalizedHistory.endsWith(after));
		const text = rule?.emit ?? inputText;
		return {
			text,
			matched: Boolean(rule),
			nextHistory: trimContext(inputHistory + text, profile.maxHistoryLength)
		};
	}

	return {
		text: inputText,
		matched: false,
		nextHistory: trimContext(inputHistory + inputText, profile.maxHistoryLength)
	};
}
