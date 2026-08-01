/**
 * Arrow/Home/End navigation for listbox-style option lists.
 * Returns the next index, or `null` if the key is not a navigation key.
 */
export function navigateListIndex(
	key: string,
	currentIndex: number,
	count: number,
	options: { homeEnd?: boolean } = {}
): number | null {
	if (count <= 0) return null;
	const { homeEnd = true } = options;

	switch (key) {
		case 'ArrowDown':
			return (currentIndex + 1) % count;
		case 'ArrowUp':
			return (currentIndex - 1 + count) % count;
		case 'Home':
			return homeEnd ? 0 : null;
		case 'End':
			return homeEnd ? count - 1 : null;
		default:
			return null;
	}
}
