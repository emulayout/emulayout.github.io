import type { LayoutKeyboardSwapPath } from '$lib/layoutKeyboardFeedback';

export type RenderedKeyboardSwapPath = LayoutKeyboardSwapPath & {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
};

export type KeyboardSwapPathLayer = {
	width: number;
	height: number;
	paths: RenderedKeyboardSwapPath[];
};

export const EMPTY_KEYBOARD_SWAP_PATH_LAYER: KeyboardSwapPathLayer = {
	width: 0,
	height: 0,
	paths: []
};

function edgeDistance(rect: DOMRect, unitX: number, unitY: number): number {
	const horizontal = unitX === 0 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(unitX);
	const vertical = unitY === 0 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(unitY);
	return Math.min(horizontal, vertical);
}

/** Measure Adaptive swap connectors between `[data-key-char]` keycaps. */
export function measureKeyboardSwapPaths(
	container: HTMLElement,
	paths: readonly LayoutKeyboardSwapPath[]
): KeyboardSwapPathLayer {
	const containerRect = container.getBoundingClientRect();
	const keyByChar = new Map(
		Array.from(container.querySelectorAll<HTMLElement>('[data-key-char]')).map((key) => [
			key.dataset.keyChar ?? '',
			key
		])
	);
	const renderedPaths = paths.flatMap((path): RenderedKeyboardSwapPath[] => {
		const fromKey = keyByChar.get(path.from);
		const toKey = keyByChar.get(path.to);
		if (!fromKey || !toKey) return [];

		const fromRect = fromKey.getBoundingClientRect();
		const toRect = toKey.getBoundingClientRect();
		const fromCenterX = fromRect.left + fromRect.width / 2;
		const fromCenterY = fromRect.top + fromRect.height / 2;
		const toCenterX = toRect.left + toRect.width / 2;
		const toCenterY = toRect.top + toRect.height / 2;
		const deltaX = toCenterX - fromCenterX;
		const deltaY = toCenterY - fromCenterY;
		const distance = Math.hypot(deltaX, deltaY);
		if (distance === 0) return [];

		const unitX = deltaX / distance;
		const unitY = deltaY / distance;
		const fromEdge = edgeDistance(fromRect, unitX, unitY);
		const toEdge = edgeDistance(toRect, unitX, unitY);

		return [
			{
				...path,
				id: `${path.from}:${path.to}`,
				x1: fromCenterX - containerRect.left + unitX * fromEdge,
				y1: fromCenterY - containerRect.top + unitY * fromEdge,
				x2: toCenterX - containerRect.left - unitX * toEdge,
				y2: toCenterY - containerRect.top - unitY * toEdge
			}
		];
	});

	return {
		width: containerRect.width,
		height: containerRect.height,
		paths: renderedPaths
	};
}
