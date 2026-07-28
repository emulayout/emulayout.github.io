import { compileMagicKeyMappings, type MagicKeyProfile } from '$lib/magicKeys';

export function compileMagicKeyRegistry(
	rawMappingsByLayout: unknown
): ReadonlyMap<string, MagicKeyProfile> {
	const profilesByLayout = new Map<string, MagicKeyProfile>();
	if (
		!rawMappingsByLayout ||
		typeof rawMappingsByLayout !== 'object' ||
		Array.isArray(rawMappingsByLayout)
	) {
		return profilesByLayout;
	}

	for (const [layoutName, mappings] of Object.entries(rawMappingsByLayout)) {
		try {
			profilesByLayout.set(layoutName, compileMagicKeyMappings(mappings));
		} catch (error) {
			console.warn(
				`Ignoring invalid magic-key profile ${layoutName}:`,
				error instanceof Error ? error.message : error
			);
		}
	}
	return profilesByLayout;
}
