/** Lock page scroll without resetting window.scrollY (safe for window-based virtualizers). */
export function lockPageScroll(): () => void {
	const html = document.documentElement;
	const body = document.body;
	const previousHtmlOverflow = html.style.overflow;
	const previousBodyOverflow = body.style.overflow;

	html.style.overflow = 'hidden';
	body.style.overflow = 'hidden';

	return () => {
		html.style.overflow = previousHtmlOverflow;
		body.style.overflow = previousBodyOverflow;
		requestAnimationFrame(() => {
			window.dispatchEvent(new Event('scroll'));
		});
	};
}

let openModalCount = 0;

/** Track an open modal; call the returned function when it closes. */
export function trackOpenModal(): () => void {
	openModalCount += 1;
	return () => {
		openModalCount = Math.max(0, openModalCount - 1);
	};
}

export function hasOpenModal(): boolean {
	return openModalCount > 0;
}
