const STORAGE_KEY = 'emulayout:compare-view';

export interface CompareViewPair {
	left: string | null;
	right: string | null;
}

export function loadCompareView(): CompareViewPair {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { left: null, right: null };
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return { left: null, right: null };
		const record = parsed as Record<string, unknown>;
		return {
			left: typeof record.left === 'string' ? record.left : null,
			right: typeof record.right === 'string' ? record.right : null
		};
	} catch {
		return { left: null, right: null };
	}
}

export function saveCompareView(left: string | null, right: string | null): void {
	try {
		if (!left && !right) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, right }));
	} catch {
		// ignore quota / private mode
	}
}

export function clearCompareView(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
