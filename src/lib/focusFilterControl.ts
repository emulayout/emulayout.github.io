import { filterStore } from '$lib/filterStore.svelte';
import type { FilterFocusRequest } from '$lib/filterSummaries';

const TARGET_CLASS = 'filter-field-targeted';
const TARGET_MS = 1600;

/** Focus a control, scroll it into view, and briefly highlight it. */
export function focusFilterControl(el: HTMLElement | null | undefined): void {
	if (!el) return;
	el.focus({ preventScroll: true });
	el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	el.classList.add(TARGET_CLASS);
	window.setTimeout(() => el.classList.remove(TARGET_CLASS), TARGET_MS);
}

/** Run after the next paint so modal/DOM content is mounted. */
export function afterPaint(fn: () => void): void {
	requestAnimationFrame(() => {
		requestAnimationFrame(fn);
	});
}

type FocusRequestFor<T extends FilterFocusRequest['target']> = Extract<
	FilterFocusRequest,
	{ target: T }
> & { seq: number };

/**
 * Read the current filter-focus request when it targets `target`.
 * Use inside `$effect` so `filterFocusRequestSeq` is tracked.
 */
export function takeFilterFocusRequest<T extends FilterFocusRequest['target']>(
	target: T
): FocusRequestFor<T> | null {
	const seq = filterStore.filterFocusRequestSeq;
	const req = filterStore.filterFocusRequest;
	if (!seq || !req || req.target !== target) return null;
	return { ...req, seq } as FocusRequestFor<T>;
}
