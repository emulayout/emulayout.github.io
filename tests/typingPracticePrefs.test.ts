import { describe, expect, test } from 'bun:test';
import {
	createDefaultTypingPracticeDisplayOptions,
	parseTypingPracticeDisplayOptions,
	serializeTypingPracticeDisplayOptions
} from '$lib/typingPracticePrefs';

describe('typing practice display preferences', () => {
	test('uses safe defaults for absent, malformed, and unknown documents', () => {
		const defaults = createDefaultTypingPracticeDisplayOptions();
		expect(parseTypingPracticeDisplayOptions(null)).toEqual(defaults);
		expect(parseTypingPracticeDisplayOptions('{')).toEqual(defaults);
		expect(parseTypingPracticeDisplayOptions('{"version":2,"options":{}}')).toEqual(defaults);
	});

	test('round-trips display options and fills missing fields', () => {
		const options = {
			...createDefaultTypingPracticeDisplayOptions(),
			highlightNextKey: true,
			colorHomeKeys: true,
			onlyRelevantAdaptiveSwaps: true,
			showSwapPaths: true
		};
		expect(
			parseTypingPracticeDisplayOptions(serializeTypingPracticeDisplayOptions(options))
		).toEqual(options);
		expect(
			parseTypingPracticeDisplayOptions('{"version":1,"options":{"highlightNextKey":true}}')
		).toEqual({ ...createDefaultTypingPracticeDisplayOptions(), highlightNextKey: true });
	});

	test('turns swap paths off when Adaptive previews are disabled', () => {
		const parsed = parseTypingPracticeDisplayOptions(
			'{"version":1,"options":{"showAdaptiveSwaps":false,"showSwapPaths":true}}'
		);
		expect(parsed.showAdaptiveSwaps).toBe(false);
		expect(parsed.showSwapPaths).toBe(false);
	});
});
