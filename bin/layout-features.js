/**
 * @typedef {import('../src/lib/layoutSupplemental.ts').LayoutSupplementalVariant} LayoutSupplementalVariant
 */

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

/** @param {unknown} rawKeys */
export function hasMagicKeyMarker(rawKeys) {
	return isRecord(rawKeys) && hasOwn(rawKeys, '*');
}

/**
 * `*` conventionally marks a magic key. Any mapped trigger also establishes
 * magic-key behavior, including `@` or another symbol.
 *
 * @param {unknown} rawKeys
 * @param {unknown} magicMappings
 */
export function hasMagicKey(rawKeys, magicMappings) {
	return (
		hasMagicKeyMarker(rawKeys) || (isRecord(magicMappings) && Object.keys(magicMappings).length > 0)
	);
}

/**
 * `@` is a repeat key unless curated magic mappings claim that trigger.
 *
 * @param {unknown} rawKeys
 * @param {unknown} magicMappings
 */
export function hasRepeatKey(rawKeys, magicMappings) {
	return (
		isRecord(rawKeys) &&
		hasOwn(rawKeys, '@') &&
		(!isRecord(magicMappings) || !hasOwn(magicMappings, '@'))
	);
}

/**
 * Magic mappings of the variant the runtime loads first. Repeat-key
 * classification is scoped to it so the compact flag matches the profile the
 * client actually compiles.
 *
 * @param {readonly LayoutSupplementalVariant[]} variants
 */
export function defaultMagicMappings(variants) {
	return variants[0]?.magicKeys?.mappings;
}

/**
 * Mapping availability spans every variant so `Require with known mappings`
 * still matches a layout whose alternatives carry the feature.
 *
 * @param {readonly LayoutSupplementalVariant[]} variants
 */
export function hasMagicKeyMappings(variants) {
	return variants.some((variant) => Boolean(variant.magicKeys));
}

/** @param {readonly LayoutSupplementalVariant[]} variants */
export function hasAdaptiveSwapMappings(variants) {
	return variants.some((variant) => Boolean(variant.adaptiveSwaps));
}
