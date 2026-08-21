/**
 * Adapt cminibrowser's canonical Magic-key and Adaptive-swap export to the
 * normalized supplemental payload consumed by Emulayout.
 */

import { compileAdaptiveSwapSource } from '../src/lib/adaptiveSwaps.ts';
import { compileMagicKeyMappings } from '../src/lib/magicKeys.ts';
import { validateLayoutSupplemental } from '../src/lib/layoutSupplemental.ts';
import { ensureCminibrowserDump } from './cminibrowser-cache.js';

export const CMINIBROWSER_MAGIC_RULES_PATH = 'magic_rules_export.json';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isSingleCharacter(value) {
	return typeof value === 'string' && Array.from(value).length === 1;
}

/** @param {string} layoutId @param {string} message */
function sourceError(layoutId, message) {
	return new Error(
		`Invalid cminibrowser input mappings for ${JSON.stringify(layoutId)}: ${message}`
	);
}

/** @param {string} layoutId @param {unknown} value */
function normalizeMagicKeys(layoutId, value) {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) throw sourceError(layoutId, 'magic_keys must be an array');

	const mappings = Object.create(null);
	for (const [index, rawMagicKey] of value.entries()) {
		if (!isRecord(rawMagicKey)) {
			throw sourceError(layoutId, `magic_keys[${index}] must be an object`);
		}
		const { key, rules, default: defaultOutput } = rawMagicKey;
		if (typeof key !== 'string' || !key) {
			throw sourceError(layoutId, `magic_keys[${index}].key must be nonempty text`);
		}
		if (Object.hasOwn(mappings, key)) {
			throw sourceError(layoutId, `magic key ${JSON.stringify(key)} is duplicated`);
		}
		if (!Array.isArray(rules)) {
			throw sourceError(layoutId, `magic key ${JSON.stringify(key)} rules must be an array`);
		}
		if (typeof defaultOutput !== 'string' || !defaultOutput) {
			throw sourceError(layoutId, `magic key ${JSON.stringify(key)} default must be nonempty text`);
		}

		const normalizedRules = Object.create(null);
		for (const [ruleIndex, rawRule] of rules.entries()) {
			if (!isRecord(rawRule)) {
				throw sourceError(
					layoutId,
					`magic key ${JSON.stringify(key)} rule ${ruleIndex} must be an object`
				);
			}
			const { after, output } = rawRule;
			if (typeof after !== 'string' || !after) {
				throw sourceError(
					layoutId,
					`magic key ${JSON.stringify(key)} rule ${ruleIndex} after must be nonempty text`
				);
			}
			if (typeof output !== 'string' || !output.startsWith(after)) {
				throw sourceError(
					layoutId,
					`magic key ${JSON.stringify(key)} output ${JSON.stringify(output)} must start with ${JSON.stringify(after)}`
				);
			}
			const emit = output.slice(after.length);
			if (!emit) {
				throw sourceError(
					layoutId,
					`magic key ${JSON.stringify(key)} rule after ${JSON.stringify(after)} emits no text`
				);
			}
			if (Object.hasOwn(normalizedRules, after)) {
				throw sourceError(
					layoutId,
					`magic key ${JSON.stringify(key)} repeats rule after ${JSON.stringify(after)}`
				);
			}
			normalizedRules[after] = emit;
		}

		const fallback =
			defaultOutput === 'repeat_previous'
				? 'repeat-last'
				: defaultOutput === 'none'
					? 'no-op'
					: { emit: defaultOutput };

		// cminibrowser represents a conventional, rule-free @ Repeat key in the
		// Magic-key schema, with either repeat-previous or no-op as the default.
		// Keep it in Emulayout's dedicated Repeat model.
		if (key === '@' && rules.length === 0 && (fallback === 'repeat-last' || fallback === 'no-op')) {
			continue;
		}

		mappings[key] = { rules: normalizedRules, fallback };
	}

	if (Object.keys(mappings).length === 0) return undefined;
	compileMagicKeyMappings(mappings);
	return { mappings };
}

/** @param {string} layoutId @param {unknown} value */
function normalizeAdaptiveSwaps(layoutId, value) {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) throw sourceError(layoutId, 'adaptive_swaps must be an array');
	if (value.length === 0) return undefined;

	const mappings = Object.create(null);
	for (const [index, rawSwap] of value.entries()) {
		if (!isRecord(rawSwap)) {
			throw sourceError(layoutId, `adaptive_swaps[${index}] must be an object`);
		}
		const { trigger, swap } = rawSwap;
		if (!isSingleCharacter(trigger)) {
			throw sourceError(layoutId, `adaptive_swaps[${index}].trigger must be one character`);
		}
		if (
			!Array.isArray(swap) ||
			swap.length !== 2 ||
			!isSingleCharacter(swap[0]) ||
			!isSingleCharacter(swap[1])
		) {
			throw sourceError(layoutId, `adaptive_swaps[${index}].swap must contain two characters`);
		}

		const normalizedTrigger = trigger.toLowerCase();
		const left = swap[0].toLowerCase();
		const right = swap[1].toLowerCase();
		const swaps = (mappings[normalizedTrigger] ??= Object.create(null));
		if (Object.hasOwn(swaps, left)) {
			throw sourceError(
				layoutId,
				`adaptive trigger ${JSON.stringify(trigger)} repeats left key ${JSON.stringify(swap[0])}`
			);
		}
		swaps[left] = right;
	}

	const source = { mappings };
	compileAdaptiveSwapSource(source);
	return source;
}

/**
 * @param {unknown} value
 * @returns {{ layoutIds: ReadonlySet<string>, supplementalByLayoutId: ReadonlyMap<string, import('../src/lib/layoutSupplemental.ts').LayoutSupplemental> }}
 */
export function normalizeCminibrowserMagicRules(value) {
	if (!isRecord(value)) {
		throw new Error('cminibrowser magic_rules_export.json must be an object');
	}

	const layoutIds = new Set();
	const supplementalByLayoutId = new Map();
	for (const [layoutId, rawLayout] of Object.entries(value)) {
		if (!layoutId) throw new Error('cminibrowser input mapping layout ids cannot be empty');
		if (!isRecord(rawLayout)) throw sourceError(layoutId, 'layout entry must be an object');
		layoutIds.add(layoutId);

		const magicKeys = normalizeMagicKeys(layoutId, rawLayout.magic_keys);
		const adaptiveSwaps = normalizeAdaptiveSwaps(layoutId, rawLayout.adaptive_swaps);
		if (!magicKeys && !adaptiveSwaps) continue;

		const supplemental = validateLayoutSupplemental({
			schema: 1,
			...(magicKeys ? { magicKeys } : {}),
			...(adaptiveSwaps ? { adaptiveSwaps } : {})
		});
		supplementalByLayoutId.set(layoutId, supplemental);
	}

	return { layoutIds, supplementalByLayoutId };
}

/**
 * @param {{ offline?: boolean, force?: boolean }} [options]
 */
export async function loadCminibrowserMagicRules(options = {}) {
	const dump = await ensureCminibrowserDump(CMINIBROWSER_MAGIC_RULES_PATH, {
		...options,
		validateJson: normalizeCminibrowserMagicRules
	});
	return { ...normalizeCminibrowserMagicRules(dump.json), updated: dump.updated };
}
