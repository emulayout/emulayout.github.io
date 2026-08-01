export interface SegmentedOption<T extends string = string> {
	value: T;
	label: string;
	id?: string;
	/** Extra classes on the option button. */
	class?: string;
	/** Optional indicator (e.g. active-filter dot). */
	indicator?: boolean;
	indicatorSrLabel?: string;
}

export function getRovingSelectionIndex<T extends string>(
	options: readonly Pick<SegmentedOption<T>, 'value'>[],
	value: T
): number {
	const selectedIndex = options.findIndex((option) => option.value === value);
	return selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1;
}
