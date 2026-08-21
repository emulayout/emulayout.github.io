import type { Attachment } from 'svelte/attachments';

/** Largest practice prompt/input size, matching `2.5rem` at a 16px root. */
export const TYPING_PRACTICE_FONT_MAX_PX = 40;
/** Smallest readable practice prompt/input size on the show page. */
export const TYPING_PRACTICE_FONT_MIN_PX = 16;
/** Compact creator practice size, matching `1.375rem` at a 16px root. */
export const TYPING_PRACTICE_COMPACT_FONT_MAX_PX = 22;
export const TYPING_PRACTICE_COMPACT_FONT_MIN_PX = 14;

export const TYPING_PRACTICE_FONT_SIZE_VAR = '--typing-practice-font-size';

const TYPING_PRACTICE_FONT_MEASURE_SELECTOR =
	'.typing-practice-copy, .layout-feel-source-words, .typing-practice-load-status';

/** Largest size in `[minPx, maxPx]` whose `overflowsAt` callback is false. */
export function fitSizeToWidth(
	minPx: number,
	maxPx: number,
	overflowsAt: (px: number) => boolean
): number {
	if (maxPx <= minPx) return minPx;
	if (!overflowsAt(maxPx)) return maxPx;
	if (overflowsAt(minPx)) return minPx;

	let low = minPx;
	let high = maxPx;
	for (let step = 0; step < 16; step += 1) {
		const mid = (low + high) / 2;
		if (overflowsAt(mid)) high = mid;
		else low = mid;
	}
	return Math.floor(low * 10) / 10;
}

export function applyFittedFontSize(
	host: HTMLElement,
	measureEls: readonly HTMLElement[],
	minPx: number,
	maxPx: number
): number {
	const elements = measureEls.filter((element) => element.isConnected);
	const fitted = fitSizeToWidth(minPx, maxPx, (px) => {
		host.style.setProperty(TYPING_PRACTICE_FONT_SIZE_VAR, `${px}px`);
		return elements.some((element) => element.scrollWidth > element.clientWidth + 1);
	});
	host.style.setProperty(TYPING_PRACTICE_FONT_SIZE_VAR, `${fitted}px`);
	return fitted;
}

/** Shrinks practice prompt/input text to the host width. `contentKey` retriggers on lesson changes. */
export function attachFittedTypingPracticeFont(compact: boolean, contentKey: string): Attachment {
	return (element) => {
		void contentKey;
		if (!(element instanceof HTMLElement)) return;

		const minPx = compact ? TYPING_PRACTICE_COMPACT_FONT_MIN_PX : TYPING_PRACTICE_FONT_MIN_PX;
		const maxPx = compact ? TYPING_PRACTICE_COMPACT_FONT_MAX_PX : TYPING_PRACTICE_FONT_MAX_PX;
		let fitting = false;
		let frame: number | null = null;
		const measureEls = () => [
			...element.querySelectorAll<HTMLElement>(TYPING_PRACTICE_FONT_MEASURE_SELECTOR)
		];
		const fit = () => {
			if (fitting) return;
			fitting = true;
			try {
				applyFittedFontSize(element, measureEls(), minPx, maxPx);
			} finally {
				fitting = false;
			}
		};
		const scheduleFit = () => {
			if (frame !== null) return;
			frame = window.requestAnimationFrame(() => {
				frame = null;
				fit();
			});
		};
		const observer = new ResizeObserver(scheduleFit);
		observer.observe(element);
		for (const measured of measureEls()) observer.observe(measured);
		fit();
		return () => {
			if (frame !== null) window.cancelAnimationFrame(frame);
			observer.disconnect();
		};
	};
}
