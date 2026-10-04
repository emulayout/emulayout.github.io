let sequence = 0;

/** Persisted editor rows need identities that cannot collide after a reload or import. */
export function createCreatorDraftId(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
		return `${prefix}-${crypto.randomUUID()}`;
	return `${prefix}-${Date.now()}-${++sequence}`;
}
