import { describe, expect, test } from 'bun:test';
import {
	createDefaultLayoutTestAreaDisplayOptions,
	parseLayoutTestAreaDisplayOptions,
	serializeLayoutTestAreaDisplayOptions
} from '$lib/layoutTestAreaPrefs';

describe('layout test area display preferences', () => {
	test('uses safe defaults with home-key coloring enabled', () => {
		const defaults = createDefaultLayoutTestAreaDisplayOptions();
		expect(defaults.colorHomeKeys).toBe(true);
		expect(parseLayoutTestAreaDisplayOptions(null)).toEqual(defaults);
		expect(parseLayoutTestAreaDisplayOptions('{')).toEqual(defaults);
		expect(parseLayoutTestAreaDisplayOptions('{"version":2,"options":{}}')).toEqual(defaults);
	});

	test('round-trips options and fills missing fields', () => {
		const options = {
			...createDefaultLayoutTestAreaDisplayOptions(),
			colorHomeKeys: false,
			showSpecialKeys: false,
			previewContextualKeyOutput: false,
			showAdaptiveSwapPaths: true
		};
		expect(
			parseLayoutTestAreaDisplayOptions(serializeLayoutTestAreaDisplayOptions(options))
		).toEqual(options);
		expect(
			parseLayoutTestAreaDisplayOptions('{"version":1,"options":{"showSpecialKeys":false}}')
		).toEqual({ ...createDefaultLayoutTestAreaDisplayOptions(), showSpecialKeys: false });
	});
});
