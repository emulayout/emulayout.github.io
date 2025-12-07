/**
 * Transforms layout data by adding computed properties.
 * This allows us to pre-compute values that would otherwise be calculated on the client.
 */

/**
 * Transforms a layout object by adding computed properties.
 * @param {Object} layout - The raw layout object from the repo
 * @returns {Object} - The transformed layout with computed properties
 */
export function transformLayout(layout) {
	const transformed = { ...layout };

	// Add computed properties
	transformed.hasThumbKeys = computeHasThumbKeys(layout);
	transformed.displayValue = computeDisplayValue(layout);

	return transformed;
}

/**
 * Computes whether a layout has thumb keys (row 3 or higher).
 * A layout has thumb keys if it has keys in more than 3 rows (rows 0, 1, 2, 3+).
 */
function computeHasThumbKeys(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	const rows = new Set();
	for (const info of Object.values(layout.keys)) {
		if (info && typeof info.row === 'number') {
			rows.add(info.row);
		}
	}

	// Has thumb keys if there are more than 3 unique rows (0, 1, 2, 3+)
	return rows.size > 3;
}

/**
 * Computes the displayValue string representation of a layout.
 */
function computeDisplayValue(layout, splitCol = 5) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return '';
	}

	const rows = {};
	Object.entries(layout.keys).forEach(([key, info]) => {
		if (!rows[info.row]) rows[info.row] = [];
		rows[info.row][info.col] = key;
	});

	const out = Object.keys(rows)
		.sort((a, b) => Number(a) - Number(b))
		.map((row) => {
			const r = rows[Number(row)];
			// Find the max column that has a key
			const maxCol = r.reduce((max, _, i) => (r[i] !== undefined ? i : max), 0);
			// Fill gaps with space, up to maxCol
			const filled = Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? ' ');
			return (
				filled.slice(0, splitCol).join(' ') +
				'  ' + // extra gap between hands
				filled.slice(splitCol).join(' ')
			);
		})
		.join('\n');

	return out.trim();
}
