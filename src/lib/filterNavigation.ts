export type FilterHistoryMode = 'replace' | 'push';

export interface HistoryLocationParts {
	pathname: string;
	search: string;
	hash: string;
}

export function createHistoryTarget({ pathname, search, hash }: HistoryLocationParts): string {
	return `${pathname}${search}${hash}`;
}

/** Replace always writes; push skips a duplicate entry for the current target. */
export function shouldWriteHistory(
	mode: FilterHistoryMode,
	nextTarget: string,
	currentTarget: string
): boolean {
	return mode === 'replace' || nextTarget !== currentTarget;
}

/** SvelteKit dev mode throws this while first-paint effects race router startup. */
export function isRouterNotReadyError(error: unknown): boolean {
	return error instanceof Error && error.message.includes('before router is initialized');
}
