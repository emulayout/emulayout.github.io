const LEGACY_REMAPPING_TYPES = ['magic', 'adaptive', 'chiral'] as const;
const DEFAULT_REPEAT_WEIGHT = 100;
export const REMAPPING_TYPES = [...LEGACY_REMAPPING_TYPES, 'repeat'] as const;
export type RemappingType = (typeof REMAPPING_TYPES)[number];
export type RemappingPreferences = Record<RemappingType, number> & { split: boolean };

export function defaultRemappingPreferences(): RemappingPreferences {
	return { split: false, magic: 100, adaptive: 100, chiral: 100, repeat: DEFAULT_REPEAT_WEIGHT };
}

export function normalizeRemappingPreferences(value: unknown): RemappingPreferences | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const raw = value as Record<string, unknown>;
	if (typeof raw.split !== 'boolean') return undefined;
	const normalized = defaultRemappingPreferences();
	normalized.split = raw.split;
	for (const type of REMAPPING_TYPES) {
		const weight = raw[type];
		if (type === 'repeat' && weight === undefined) continue;
		if (typeof weight !== 'number' || !Number.isFinite(weight)) return undefined;
		normalized[type] = Math.min(100, Math.max(0, Math.round(weight)));
	}
	return normalized;
}

export function encodeRemappingPreferences(value: RemappingPreferences): string {
	const types = value.repeat === DEFAULT_REPEAT_WEIGHT ? LEGACY_REMAPPING_TYPES : REMAPPING_TYPES;
	return `${value.split ? '' : 'off,'}${types.map((type) => value[type]).join(',')}`;
}

export function parseRemappingPreferences(value: string): RemappingPreferences | undefined {
	const parts = value.split(',');
	const split = parts[0] !== 'off';
	if (!split) parts.shift();
	if ((parts.length !== 3 && parts.length !== 4) || parts.some((part) => !/^\d{1,3}$/.test(part)))
		return undefined;
	return normalizeRemappingPreferences({
		split,
		magic: Number(parts[0]),
		adaptive: Number(parts[1]),
		chiral: Number(parts[2]),
		repeat: parts[3] === undefined ? undefined : Number(parts[3])
	});
}

export function remappingPreferencesSignature(value?: RemappingPreferences): string {
	return value?.split ? encodeRemappingPreferences(value) : '';
}
