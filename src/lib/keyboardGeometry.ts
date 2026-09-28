export const KEYBOARD_GEOMETRY_STORAGE_KEY = 'keyboardGeometry';

export const KEYBOARD_GEOMETRIES = ['row-stagger', 'column-stagger'] as const;

export type KeyboardGeometry = (typeof KEYBOARD_GEOMETRIES)[number];

/** AKLDB stores positions, not a physical board; row stagger is the default view. */
export const DEFAULT_KEYBOARD_GEOMETRY: KeyboardGeometry = 'row-stagger';

export function parseKeyboardGeometry(value: string | null | undefined): KeyboardGeometry {
	return value === 'row-stagger' || value === 'column-stagger' ? value : DEFAULT_KEYBOARD_GEOMETRY;
}

export function geometryLabel(geometry: KeyboardGeometry): string {
	return geometry === 'row-stagger' ? 'Row stagger' : 'Column stagger';
}
