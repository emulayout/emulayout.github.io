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
 * AKL mappings are authoritative for Magic-key presence, including
 * `*`, `@`, or another trigger symbol.
 *
 * @param {unknown} rawKeys
 * @param {unknown} magicMappings
 */
export function hasMagicKey(rawKeys, magicMappings) {
	return isRecord(magicMappings) && Object.keys(magicMappings).length > 0;
}

/**
 * `@` is a repeat key unless AKL Magic mappings claim that trigger.
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
