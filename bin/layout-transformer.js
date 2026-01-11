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
	transformed.characterSet = computeCharacterSet(layout);
	transformed.hasAllLetters = computeHasAllLetters(layout);
	transformed.hasMagicKey = computeHasMagicKey(layout);

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

	const isStaggered = layout.board === 'stagger';
	const isAngle = layout.board === 'angle';

	const out = Object.keys(rows)
		.sort((a, b) => Number(a) - Number(b))
		.map((row) => {
			const rowNum = Number(row);
			const r = rows[rowNum];
			// Find the max column that has a key
			const maxCol = r.reduce((max, _, i) => (r[i] !== undefined ? i : max), 0);
			// Fill gaps with space, up to maxCol
			const filled = Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? ' ');
			const rowString =
				filled.slice(0, splitCol).join(' ') +
				'  ' + // extra gap between hands
				filled.slice(splitCol).join(' ');

			// Add extra spaces for staggered layouts
			if (isStaggered) {
				if (rowNum === 1) {
					// Row 1: add 1 extra space at the beginning
					return ' ' + rowString;
				} else if (rowNum === 2) {
					// Row 2: add 2 extra spaces at the beginning
					return '  ' + rowString;
				}
			}

			// Add extra spaces for angle layouts
			if (isAngle && rowNum === 1) {
				// Row 1: add 1 extra space at the beginning
				return ' ' + rowString;
			}

			return rowString;
		})
		.join('\n');

	return out.trim();
}

/**
 * Computes the character set of a layout.
 * Returns "english" if all keys are basic ASCII/Latin characters,
 * "international" if any keys contain foreign characters (Extended Latin, Cyrillic, Japanese, Chinese, etc.)
 */
function computeCharacterSet(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return 'english';
	}

	// Check all key characters
	for (const key of Object.keys(layout.keys)) {
		// Skip if key is empty or just whitespace
		if (!key || key.trim() === '') continue;

		// Check each character in the key
		for (let i = 0; i < key.length; i++) {
			const charCode = key.charCodeAt(i);

			// Basic ASCII printable range is 32-126 (space through tilde)
			// This includes: letters (a-z, A-Z), numbers (0-9), and basic punctuation
			// Anything outside this range is considered "international"
			if (charCode < 32 || charCode > 126) {
				return 'international';
			}
		}
	}

	return 'english';
}

/**
 * Computes whether a layout has all letters a-z (case insensitive).
 * Returns true if all 26 letters are present in the layout keys, false otherwise.
 */
function computeHasAllLetters(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	// Set to track which letters we've found
	const foundLetters = new Set();

	// Check all keys
	for (const key of Object.keys(layout.keys)) {
		if (!key || typeof key !== 'string') continue;

		// Convert to lowercase and check each character
		const lowerKey = key.toLowerCase();
		for (let i = 0; i < lowerKey.length; i++) {
			const char = lowerKey[i];
			// Check if it's a letter a-z
			if (char >= 'a' && char <= 'z') {
				foundLetters.add(char);
			}
		}
	}

	// Check if we have all 26 letters
	return foundLetters.size === 26;
}

/**
 * Computes whether a layout has a magic key assigned.
 */
function computeHasMagicKey(layout) {
	if (!layout.keys || typeof layout.keys !== 'object') {
		return false;
	}

	// Check if any key in the keys object is "*" or "@"
	return Object.keys(layout.keys).some((key) => key === '*' || key === '@');
}
