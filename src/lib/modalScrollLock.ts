let scrollLockCount = 0;
let savedHtmlOverflow = '';
let savedBodyOverflow = '';

/** Lock page scroll without resetting window.scrollY (safe for window-based virtualizers). */
export function lockPageScroll(): () => void {
	const html = document.documentElement;
	const body = document.body;
	if (scrollLockCount === 0) {
		savedHtmlOverflow = html.style.overflow;
		savedBodyOverflow = body.style.overflow;
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
	}
	scrollLockCount += 1;

	let released = false;
	return () => {
		if (released) return;
		released = true;
		scrollLockCount = Math.max(0, scrollLockCount - 1);
		if (scrollLockCount === 0) {
			html.style.overflow = savedHtmlOverflow;
			body.style.overflow = savedBodyOverflow;
			requestAnimationFrame(() => {
				window.dispatchEvent(new Event('scroll'));
			});
		}
	};
}

const openModalStack: symbol[] = [];

/** Track an open modal; call the returned function when it closes. */
export function trackOpenModal(token: symbol = Symbol('modal')): () => void {
	openModalStack.push(token);
	return () => {
		const index = openModalStack.lastIndexOf(token);
		if (index >= 0) openModalStack.splice(index, 1);
	};
}

export function isTopOpenModal(token: symbol): boolean {
	return openModalStack.length > 0 && openModalStack[openModalStack.length - 1] === token;
}

export function hasOpenModal(): boolean {
	return openModalStack.length > 0;
}
