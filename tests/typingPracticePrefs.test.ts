import { describe, expect, test } from 'bun:test';
import {
	createDefaultTypingPracticeDisplayOptions,
	parseTypingPracticeDisplayOptions,
	serializeTypingPracticeDisplayOptions
} from '$lib/typingPracticePrefs';

describe('typing practice display preferences', () => {
	test('uses safe defaults for absent, malformed, and unknown documents', () => {
		const defaults = createDefaultTypingPracticeDisplayOptions();
		expect(defaults.colorHomeKeys).toBe(true);
		expect(defaults.testStyle).toBe('monkeytype');
		expect(defaults.underlineMagicGroups).toBe(true);
		expect(defaults.simulateThumbKeys).toBe(false);
		expect(defaults.ignoreWrongKeyPresses).toBe(true);
		expect(parseTypingPracticeDisplayOptions(null)).toEqual(defaults);
		expect(parseTypingPracticeDisplayOptions('{')).toEqual(defaults);
		expect(parseTypingPracticeDisplayOptions('{"version":3,"options":{}}')).toEqual(defaults);
	});

	test('round-trips display options and fills missing fields', () => {
		const options = {
			...createDefaultTypingPracticeDisplayOptions(),
			testStyle: 'monkeytype' as const,
			highlightNextKey: true,
			colorHomeKeys: true,
			simulateThumbKeys: true,
			underlineMagicGroups: true,
			underlineAdaptiveGroups: true,
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

	test('falls back from unknown test styles', () => {
		expect(
			parseTypingPracticeDisplayOptions('{"version":1,"options":{"testStyle":"unknown"}}').testStyle
		).toBe('monkeytype');
	});

	test('preserves swap paths while Adaptive previews are disabled', () => {
		const parsed = parseTypingPracticeDisplayOptions(
			'{"version":1,"options":{"showAdaptiveSwaps":false,"showSwapPaths":true}}'
		);
		expect(parsed.showAdaptiveSwaps).toBe(false);
		expect(parsed.showSwapPaths).toBe(true);
	});
});
