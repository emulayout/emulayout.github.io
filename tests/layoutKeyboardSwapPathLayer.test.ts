import { describe, expect, test } from 'bun:test';
import { measureKeyboardSwapPaths } from '../src/lib/layoutKeyboardSwapPathLayer';

function rect(left: number, top: number, width = 10, height = 10): DOMRect {
	return {
		x: left,
		y: top,
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		toJSON: () => ({})
	} as DOMRect;
}

function key(character: string, bounds: DOMRect): HTMLElement {
	return {
		dataset: { keyChar: character },
		getBoundingClientRect: () => bounds
	} as unknown as HTMLElement;
}

describe('measureKeyboardSwapPaths', () => {
	test('renders connectors for every matching duplicate keycap', () => {
		const keys = [key('a', rect(10, 10)), key('a', rect(30, 10)), key('b', rect(70, 10))];
		const container = {
			getBoundingClientRect: () => rect(0, 0, 100, 30),
			querySelectorAll: () => keys
		} as unknown as HTMLElement;

		const layer = measureKeyboardSwapPaths(container, [{ from: 'a', to: 'b' }]);

		expect(layer.paths.map((path) => path.id)).toEqual(['a:b:0:0', 'a:b:1:0']);
		expect(layer.paths).toHaveLength(2);
	});
});
