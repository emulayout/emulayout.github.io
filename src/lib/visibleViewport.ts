export interface VisibleViewportBounds {
	left: number;
	top: number;
	width: number;
	height: number;
	right: number;
	bottom: number;
}

export function getVisibleViewportBounds(): VisibleViewportBounds {
	if (typeof window === 'undefined') {
		return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
	}

	const viewport = window.visualViewport;
	const left = viewport?.offsetLeft ?? 0;
	const top = viewport?.offsetTop ?? 0;
	const width = viewport?.width ?? window.innerWidth;
	const height = viewport?.height ?? window.innerHeight;

	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height
	};
}

export function listenForVisibleViewportChanges(listener: () => void): () => void {
	if (typeof window === 'undefined') return () => {};

	const viewport = window.visualViewport;
	window.addEventListener('resize', listener);
	viewport?.addEventListener('resize', listener);
	viewport?.addEventListener('scroll', listener);

	return () => {
		window.removeEventListener('resize', listener);
		viewport?.removeEventListener('resize', listener);
		viewport?.removeEventListener('scroll', listener);
	};
}
