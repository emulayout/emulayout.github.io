/**
 * Adapt Emulayout's general magic-key profiles to the deliberately narrower
 * feature set supported by Mana2's experimental extended engine.
 */

/** @typedef {Record<string, unknown>} RawMagicKeyMappings */

/**
 * @typedef {
 *   | 'mappings-unavailable'
 *   | 'multiple-magic-keys'
 *   | 'invalid-magic-key'
 *   | 'no-rules'
 *   | 'multi-key-input'
 *   | 'multiple-outputs-per-input'
 *   | 'multi-character-output'
 *   | 'magic-key-not-on-layout'
 *   | 'input-key-not-on-layout'
 *   | 'invalid-profile'
 *   | 'extended-engine-failed'
 * } Mana2MagicExclusionReason
 */

/**
 * @typedef {
 *   | { status: 'included', engine: 'extended' }
 *   | {
 *       status: 'excluded',
 *       engine: 'standard',
 *       reason: Mana2MagicExclusionReason,
 *       detail: string
 *     }
 * } Mana2MagicAnalysis
 */

/**
 * @typedef {{
 *   engine: 'standard' | 'extended',
 *   analysis: Mana2MagicAnalysis,
 *   rules: { inputs: string, output: string }[]
 * }} Mana2MagicPreparation
 */

/** @param {unknown} value */
function runeLength(value) {
	return typeof value === 'string' ? [...value].length : 0;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} value
 * @param {string} key
 */
function hasOwn(value, key) {
	return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * @param {Mana2MagicExclusionReason} reason
 * @param {string} detail
 * @returns {Mana2MagicPreparation}
 */
function excluded(reason, detail) {
	return {
		engine: 'standard',
		analysis: { status: 'excluded', engine: 'standard', reason, detail },
		rules: []
	};
}

/**
 * Validate and translate one stored magic-key profile for Mana2.
 *
 * Emulayout supports multiple triggers, multi-key history, and multi-character
 * emissions. Mana2's extended engine currently supports only one one-character
 * trigger and bigram rules, so unsupported profiles receive explicit metadata
 * and continue to use ordinary standard-engine stats.
 *
 * @param {unknown} rawMappings
 * @param {Record<string, unknown>} layoutKeys
 * @returns {Mana2MagicPreparation}
 */
export function prepareMana2Magic(rawMappings, layoutKeys) {
	if (
		!rawMappings ||
		typeof rawMappings !== 'object' ||
		Array.isArray(rawMappings) ||
		!layoutKeys ||
		typeof layoutKeys !== 'object'
	) {
		return excluded('invalid-profile', 'Magic-key mappings must be an object.');
	}

	const triggers = Object.entries(/** @type {Record<string, unknown>} */ (rawMappings));
	if (triggers.length !== 1) {
		return excluded(
			'multiple-magic-keys',
			`Mana2 supports exactly one magic key; found ${triggers.length}.`
		);
	}

	const [trigger, rawRules] = triggers[0];
	if (runeLength(trigger) !== 1) {
		return excluded('invalid-magic-key', 'Mana2 magic keys must be one character.');
	}
	if (!(trigger in layoutKeys)) {
		return excluded(
			'magic-key-not-on-layout',
			`Magic key ${JSON.stringify(trigger)} is not present on the layout.`
		);
	}
	if (!isRecord(rawRules)) {
		return excluded('invalid-profile', 'Magic-key rules must be an object.');
	}

	let rawRuleMap = rawRules;
	let fallback;
	const extended = hasOwn(rawRules, 'mappings') || hasOwn(rawRules, 'fallback');
	if (extended) {
		if (!isRecord(rawRules.mappings)) {
			return excluded('invalid-profile', 'Extended magic-key mappings must be an object.');
		}
		rawRuleMap = rawRules.mappings;
		fallback = rawRules.fallback;
		const unknownOption = Object.keys(rawRules).find(
			(key) => key !== 'mappings' && key !== 'fallback'
		);
		if (unknownOption) {
			return excluded(
				'invalid-profile',
				`Magic key ${JSON.stringify(trigger)} has unknown option ${JSON.stringify(unknownOption)}.`
			);
		}
	}
	if (fallback !== undefined && fallback !== 'repeat-last') {
		return excluded(
			'invalid-profile',
			`Mana2 does not recognize the magic-key fallback ${JSON.stringify(fallback)}.`
		);
	}
	const entries = Object.entries(rawRuleMap);

	/** @type {{ inputs: string, output: string }[]} */
	const rules = [];
	const explicitInputs = new Set();
	for (const [after, emit] of entries) {
		if (runeLength(after) !== 1) {
			return excluded(
				'multi-key-input',
				`Mana2 does not support preceding sequences such as ${JSON.stringify(after)}.`
			);
		}
		if (!(after in layoutKeys)) {
			return excluded(
				'input-key-not-on-layout',
				`Preceding key ${JSON.stringify(after)} is not present on the layout.`
			);
		}
		if (Array.isArray(emit)) {
			return excluded(
				'multiple-outputs-per-input',
				`Mana2 does not support multiple outputs for ${JSON.stringify(after + trigger)}.`
			);
		}
		if (runeLength(emit) !== 1) {
			return excluded(
				'multi-character-output',
				`Mana2 does not support the output ${JSON.stringify(emit)} for ${JSON.stringify(after + trigger)}.`
			);
		}

		rules.push({
			inputs: after + trigger,
			output: after + /** @type {string} */ (emit)
		});
		explicitInputs.add(after);
	}

	if (fallback === 'repeat-last') {
		for (const key of Object.keys(layoutKeys)) {
			if (key === trigger || runeLength(key) !== 1 || explicitInputs.has(key)) continue;
			rules.push({
				inputs: key + trigger,
				output: key + key
			});
		}
	}

	if (rules.length === 0) {
		return excluded('no-rules', 'The magic key has no mappings or applicable fallback rules.');
	}

	return {
		engine: 'extended',
		analysis: { status: 'included', engine: 'extended' },
		rules
	};
}

/**
 * @param {number[]} stats
 * @param {Mana2MagicAnalysis | null} analysis
 */
export function encodeMana2StatsResult(stats, analysis) {
	return analysis ? { stats, magicKeys: analysis } : stats;
}

/**
 * Downgrade an eligible profile when extended-engine analysis fails.
 * @param {string} detail
 * @returns {Mana2MagicAnalysis}
 */
export function mana2MagicEngineFailure(detail) {
	return {
		status: 'excluded',
		engine: 'standard',
		reason: 'extended-engine-failed',
		detail
	};
}

/**
 * Record that a magic-key layout could only be analyzed literally because no
 * curated mappings are available.
 *
 * @returns {Mana2MagicAnalysis}
 */
export function mana2MagicMappingsUnavailable() {
	return {
		status: 'excluded',
		engine: 'standard',
		reason: 'mappings-unavailable',
		detail: 'No curated magic-key mappings are available for this layout.'
	};
}
