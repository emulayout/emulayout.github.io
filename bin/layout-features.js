/**
 * Match the existing layout-filter definition: a layout requires magic-key
 * handling when either supported magic-key position appears in its key map.
 *
 * @param {unknown} rawKeys
 */
export function hasMagicKey(rawKeys) {
	if (!rawKeys || typeof rawKeys !== 'object' || Array.isArray(rawKeys)) return false;
	return Object.keys(rawKeys).some((key) => key === '*' || key === '@');
}
