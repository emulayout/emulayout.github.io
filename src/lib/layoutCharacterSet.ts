export type LayoutCharacterSet = 'english' | 'international';

/**
 * Classify a layout from its key labels. Only letters decide the set:
 * basic Latin a-z is English; any other letter is international. Adaptive
 * symbols, modifiers, and typographic punctuation do not change the set.
 */
export function computeCharacterSet(keyCharacters: Iterable<string>): LayoutCharacterSet {
	for (const key of keyCharacters) {
		if (!key || key.trim() === '') continue;

		for (const character of key.normalize('NFC')) {
			if (/\p{L}/u.test(character) && !/[a-zA-Z]/.test(character)) {
				return 'international';
			}
		}
	}

	return 'english';
}
