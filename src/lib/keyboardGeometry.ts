export const KEYBOARD_GEOMETRY_STORAGE_KEY = 'keyboardGeometry';

export const KEYBOARD_GEOMETRIES = ['column-stagger', 'row-stagger'] as const;

export type KeyboardGeometry = (typeof KEYBOARD_GEOMETRIES)[number];

/** AKLDB stores positions, not a physical board; column stagger is the neutral default view. */
export const DEFAULT_KEYBOARD_GEOMETRY: KeyboardGeometry = 'column-stagger';

export function parseKeyboardGeometry(value: string | null | undefined): KeyboardGeometry {
	return value === 'row-stagger' || value === 'column-stagger' ? value : DEFAULT_KEYBOARD_GEOMETRY;
}

export function geometryLabel(geometry: KeyboardGeometry): string {
	return geometry === 'row-stagger' ? 'Row stagger' : 'Column stagger';
}
