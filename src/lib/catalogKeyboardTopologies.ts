/** Catalog metadata describes a coordinate convention, not the user's hardware. */
export type CatalogKeyboardTopology = {
	topology: 'ansi' | 'iso';
	coordinates: 'offset-v1';
};

/**
 * AKL's offset convention reserves column 0 for the ISO key and starts the upper
 * rows at 1. Require both a topology marker and this structure: neither alone
 * distinguishes these boards from ordinary or ortholinear grids.
 */
export function inferCatalogKeyboardTopology(
	name: string,
	positions: ReadonlyMap<string, string>
): CatalogKeyboardTopology | undefined {
	const marker = /(?:^|-)(ansi|iso|isomtr)$/i.exec(name)?.[1]?.toLowerCase();
	if (!marker) return undefined;
	const candidate: CatalogKeyboardTopology = {
		topology: marker === 'ansi' ? 'ansi' : 'iso',
		coordinates: 'offset-v1'
	};
	return validateCatalogKeyboardTopology(candidate, positions);
}

/** Validate metadata against the source coordinates, including intentional holes. */
export function validateCatalogKeyboardTopology(
	value: unknown,
	positions: ReadonlyMap<string, string>
): CatalogKeyboardTopology | undefined {
	if (!value || typeof value !== 'object') return undefined;
	if (!('coordinates' in value) || value.coordinates !== 'offset-v1') return undefined;
	if (!('topology' in value) || (value.topology !== 'ansi' && value.topology !== 'iso'))
		return undefined;
	for (const row of [0, 1]) {
		if (positions.has(`${row},0`)) return undefined;
		for (let col = 1; col <= 10; col++) {
			if (!positions.has(`${row},${col}`)) return undefined;
		}
	}
	if (positions.has('2,0') !== (value.topology === 'iso')) return undefined;
	let bottomKeys = 0;
	for (const slot of positions.keys()) {
		const [row, col] = slot.split(',').map(Number);
		if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) return undefined;
		if (row >= 3) continue;
		if (col > [13, 11, 10][row]) return undefined;
		if (row === 2) bottomKeys++;
	}
	if (bottomKeys < 6) return undefined;
	return { topology: value.topology, coordinates: 'offset-v1' };
}
