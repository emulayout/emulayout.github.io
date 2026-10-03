import { validateLayoutSupplemental } from '../src/lib/layoutSupplemental.ts';
import { validateChiralKeySource, isChiralCharacter } from '../src/lib/chiralKeys.ts';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {import('./akldb-cache.js').AkldbLayout} layout */
function conventionalRepeatTrigger(layout) {
	const magicKeys = Array.isArray(layout.magic?.magic_keys) ? layout.magic.magic_keys : [];
	return magicKeys.some(
		(entry) =>
			isRecord(entry) &&
			entry.key === '@' &&
			Array.isArray(entry.rules) &&
			entry.rules.length === 0 &&
			(!Array.isArray(entry.except) || entry.except.length === 0) &&
			isRecord(entry.default) &&
			entry.default.kind === 'repeat'
	);
}

/**
 * Adapt AKLDB's canonical Spark intent plus its authoritative Mana2 lowering
 * into Emulayout's executable supplemental payload.
 *
 * @param {import('./akldb-cache.js').AkldbLayout} layout
 */
export function supplementalFromAkldbLayout(layout) {
	const magicKeys = Array.isArray(layout.magic?.magic_keys) ? layout.magic.magic_keys : [];
	const chiralKeys = Array.isArray(layout.magic?.chiral_keys)
		? layout.magic.chiral_keys.filter(isRecord).map((key) => ({
				...key,
				key: key.key,
				same: key.same ?? undefined,
				opposite: key.opposite ?? undefined
			}))
		: [];
	const triggerKeys = new Set(
		[...magicKeys, ...chiralKeys]
			.filter(isRecord)
			.map((entry) => entry.key)
			.filter((key) => typeof key === 'string' && key)
	);
	const repeatTrigger =
		conventionalRepeatTrigger(layout) ||
		(layout.keys.some((key) => key.char === '@') && !triggerKeys.has('@'));
	if (repeatTrigger) triggerKeys.delete('@');

	/** @type {Record<string, { rules: Record<string, string> }>} */
	const mappings = Object.create(null);
	for (const rule of layout.manaMagic?.rules ?? []) {
		const inputs = Array.from(rule.inputs);
		const trigger = inputs.pop();
		if (!trigger || !triggerKeys.has(trigger)) continue;
		const after = inputs.join('');
		if (!after || !rule.output.startsWith(after)) {
			throw new Error(
				`AKLDB Magic rule for ${JSON.stringify(layout.name)} rewrites its context and cannot be represented`
			);
		}
		const emit = rule.output.slice(after.length);
		if (!emit) throw new Error(`AKLDB Magic rule for ${JSON.stringify(layout.name)} emits no text`);
		const mapping = (mappings[trigger] ??= { rules: Object.create(null) });
		if (Object.hasOwn(mapping.rules, after)) {
			throw new Error(`AKLDB Magic rules repeat ${JSON.stringify(after + trigger)}`);
		}
		mapping.rules[after] = emit;
	}

	const adaptiveSwaps = Array.isArray(layout.magic?.adaptive_swaps)
		? layout.magic.adaptive_swaps
		: [];
	/** @type {Record<string, Record<string, string>>} */
	const adaptiveMappings = Object.create(null);
	for (const [index, entry] of adaptiveSwaps.entries()) {
		if (
			!isRecord(entry) ||
			typeof entry.trigger !== 'string' ||
			!Array.isArray(entry.swap) ||
			entry.swap.length !== 2 ||
			typeof entry.swap[0] !== 'string' ||
			typeof entry.swap[1] !== 'string'
		) {
			throw new Error(
				`AKLDB adaptive swap ${index} for ${JSON.stringify(layout.name)} is malformed`
			);
		}
		// Spark can explicitly list an identity swap; it adds no runtime behavior.
		if (entry.swap[0].toLowerCase() === entry.swap[1].toLowerCase()) continue;
		(adaptiveMappings[entry.trigger.toLowerCase()] ??= Object.create(null))[
			entry.swap[0].toLowerCase()
		] = entry.swap[1].toLowerCase();
	}

	const hasMagic = Object.keys(mappings).length > 0;
	const hasAdaptive = Object.keys(adaptiveMappings).length > 0;
	const analyzerMappings = hasMagic ? mappings : undefined;
	const nativeChiralKeys = chiralKeys.flatMap((key) => {
		try {
			return validateChiralKeySource({ keys: [key] }).keys;
		} catch {
			console.warn(
				`  ⚠ ${layout.name}: using Mana2 rules for unsupported native chiral ${JSON.stringify(key.key)}`
			);
			return [];
		}
	});
	const nativeMappings = Object.fromEntries(
		Object.entries(mappings).filter(
			([trigger]) =>
				!nativeChiralKeys.some((key) => key.key === trigger) ||
				magicKeys.some((key) => isRecord(key) && key.key === trigger)
		)
	);
	/** @type {Record<string, 'l' | 'r'>} */
	const hands = Object.create(null);
	for (const key of layout.keys)
		if (isChiralCharacter(key.char) && !Object.hasOwn(hands, key.char))
			hands[key.char] = key.finger.startsWith('L') ? 'l' : 'r';
	if (!hasMagic && !hasAdaptive && !nativeChiralKeys.length)
		return { supplemental: undefined, repeatTrigger, analyzerMappings };
	const supplemental = validateLayoutSupplemental({
		schema: 1,
		...(Object.keys(nativeMappings).length ? { magicKeys: { mappings: nativeMappings } } : {}),
		...(nativeChiralKeys.length ? { chiralKeys: { keys: nativeChiralKeys, hands } } : {}),
		...(hasAdaptive ? { adaptiveSwaps: { mappings: adaptiveMappings } } : {})
	});
	return { supplemental, repeatTrigger, analyzerMappings };
}
