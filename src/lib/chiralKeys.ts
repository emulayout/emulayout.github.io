import { shiftedKeyCharacter } from '$lib/cmini/keyboard';

export type ChiralHand = 'l' | 'r';
export type ChiralOutput = { kind: 'repeat' } | { kind: 'char'; char: string };
export interface ChiralKey {
	key: string;
	same?: ChiralOutput;
	opposite?: ChiralOutput;
	except?: readonly string[];
}
export interface ChiralKeySource {
	keys: readonly ChiralKey[];
	/** Primary character hands from Spark; geometry is the fallback for locally made layouts. */
	hands?: Readonly<Record<string, ChiralHand>>;
}
export interface ChiralKeyProfile extends ChiralKeySource {
	hands: Readonly<Record<string, ChiralHand>>;
}
export function chiralMappingId(key: string): string {
	return JSON.stringify(['chiral-key', key]);
}
function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function character(value: unknown): value is string {
	return typeof value === 'string' && Array.from(value).length === 1 && !/\s/u.test(value);
}
function output(value: unknown): ChiralOutput | undefined {
	if (value === undefined) return undefined;
	if (record(value) && value.kind === 'repeat') return { kind: 'repeat' };
	if (record(value) && value.kind === 'char' && character(value.char))
		return { kind: 'char', char: value.char };
	throw new Error('Chiral output must be repeat or one character');
}
export function validateChiralKeySource(value: unknown): ChiralKeySource {
	if (!record(value) || !Array.isArray(value.keys) || !value.keys.length)
		throw new Error('Chiral keys must contain at least one key');
	const seen = new Set<string>();
	const keys = value.keys.map((raw): ChiralKey => {
		if (!record(raw) || !character(raw.key) || seen.has(raw.key))
			throw new Error('Chiral triggers must be unique single characters');
		seen.add(raw.key);
		const same = output(raw.same),
			opposite = output(raw.opposite);
		if (raw.except !== undefined && (!Array.isArray(raw.except) || !raw.except.every(character)))
			throw new Error('Chiral exceptions must be characters');
		return {
			key: raw.key,
			...(same ? { same } : {}),
			...(opposite ? { opposite } : {}),
			...(raw.except ? { except: raw.except as string[] } : {})
		};
	});
	const hands: Record<string, ChiralHand> = Object.create(null);
	if (value.hands !== undefined) {
		if (!record(value.hands)) throw new Error('Chiral hands must be an object');
		for (const [key, hand] of Object.entries(value.hands)) {
			if (!character(key) || (hand !== 'l' && hand !== 'r')) throw new Error('Invalid chiral hand');
			hands[key] = hand;
		}
	}
	return { keys, ...(value.hands !== undefined ? { hands } : {}) };
}
export function compileChiralKeys(source: ChiralKeySource, rawKeys?: unknown): ChiralKeyProfile {
	const validated = validateChiralKeySource(source);
	const hands: Record<string, ChiralHand> = Object.create(null);
	if (record(rawKeys))
		for (const [key, info] of Object.entries(rawKeys)) {
			if (!record(info)) continue;
			const hand = info.hand ?? info.thumbHand;
			if (hand === 'l' || hand === 'r') hands[key] = hand;
			else if (typeof info.col === 'number') hands[key] = info.col < 5 ? 'l' : 'r';
		}
	Object.assign(hands, validated.hands);
	// Explicit shifted/base characters win over inferred aliases.
	for (const [key, hand] of Object.entries(hands)) {
		const shifted = shiftedKeyCharacter(key);
		if (shifted && !hands[shifted]) hands[shifted] = hand;
		const upper = key.toUpperCase();
		if (Array.from(upper).length === 1 && !hands[upper]) hands[upper] = hand;
	}
	return { keys: validated.keys, hands };
}
export function resolveChiralKeyOutput(
	profile: ChiralKeyProfile | undefined,
	history: string,
	key: string,
	disabled?: ReadonlySet<string>
) {
	const rule = profile?.keys.find((rule) => rule.key === key);
	if (!profile || !rule || disabled?.has(chiralMappingId(key)))
		return { text: key, matched: false };
	const previous = Array.from(history).at(-1);
	const hand = profile.hands[key],
		previousHand = previous ? profile.hands[previous] : undefined;
	if (!previous || !hand || !previousHand || rule.except?.includes(previous))
		return { text: key, matched: true };
	const emit = hand === previousHand ? rule.same : rule.opposite;
	return {
		text: emit?.kind === 'repeat' ? previous : emit?.kind === 'char' ? emit.char : key,
		matched: true
	};
}

/** Temporary projection for analyzers/planners only; never persisted or shown as Magic rows. */
export function chiralRuleMappings(
	profile: ChiralKeyProfile | undefined,
	disabled?: ReadonlySet<string>
) {
	const mappings: Record<string, Record<string, string>> = Object.create(null);
	for (const rule of profile?.keys ?? []) {
		if (disabled?.has(chiralMappingId(rule.key))) continue;
		const rules: Record<string, string> = Object.create(null);
		for (const after of Object.keys(profile!.hands)) {
			const result = resolveChiralKeyOutput(profile, after, rule.key);
			if (result.text !== rule.key) rules[after] = result.text;
		}
		if (Object.keys(rules).length) mappings[rule.key] = rules;
	}
	return mappings;
}
