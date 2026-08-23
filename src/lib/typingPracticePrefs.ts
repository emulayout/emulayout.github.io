export const TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY = 'typingPracticeDisplayOptions';

const TYPING_PRACTICE_DISPLAY_OPTIONS_VERSION = 2;

export type TypingPracticeTestStyle = 'colemak-club' | 'monkeytype';

export const DEFAULT_TYPING_PRACTICE_TEST_STYLE: TypingPracticeTestStyle = 'monkeytype';

export interface TypingPracticeDisplayOptions {
	/** Typing practice only: Colemak Club's queue or Monkeytype's full-lesson presentation. */
	testStyle: TypingPracticeTestStyle;
	highlightNextKey: boolean;
	colorHomeKeys: boolean;
	simulateThumbKeys: boolean;
	showSpecialKeys: boolean;
	underlineMagicGroups: boolean;
	underlineAdaptiveGroups: boolean;
	showAdaptiveSwaps: boolean;
	onlyRelevantAdaptiveSwaps: boolean;
	showSwapPaths: boolean;
	/** Layout feel only: discard keystrokes that would introduce an input error. */
	ignoreWrongKeyPresses: boolean;
}

export function createDefaultTypingPracticeDisplayOptions(): TypingPracticeDisplayOptions {
	return {
		testStyle: DEFAULT_TYPING_PRACTICE_TEST_STYLE,
		highlightNextKey: false,
		colorHomeKeys: true,
		simulateThumbKeys: false,
		showSpecialKeys: true,
		underlineMagicGroups: true,
		underlineAdaptiveGroups: false,
		showAdaptiveSwaps: true,
		onlyRelevantAdaptiveSwaps: false,
		showSwapPaths: false,
		ignoreWrongKeyPresses: true
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTypingPracticeTestStyle(
	value: Record<string, unknown>,
	fallback: TypingPracticeTestStyle
): TypingPracticeTestStyle {
	if (value.testStyle === 'colemak-club' || value.testStyle === 'monkeytype') {
		return value.testStyle;
	}
	return fallback;
}

function normalizeTypingPracticeDisplayOptions(value: unknown): TypingPracticeDisplayOptions {
	const defaults = createDefaultTypingPracticeDisplayOptions();
	if (!isRecord(value)) return defaults;

	const options: TypingPracticeDisplayOptions = {
		testStyle: normalizeTypingPracticeTestStyle(value, defaults.testStyle),
		highlightNextKey:
			typeof value.highlightNextKey === 'boolean'
				? value.highlightNextKey
				: defaults.highlightNextKey,
		colorHomeKeys:
			typeof value.colorHomeKeys === 'boolean' ? value.colorHomeKeys : defaults.colorHomeKeys,
		simulateThumbKeys:
			typeof value.simulateThumbKeys === 'boolean'
				? value.simulateThumbKeys
				: defaults.simulateThumbKeys,
		showSpecialKeys:
			typeof value.showSpecialKeys === 'boolean' ? value.showSpecialKeys : defaults.showSpecialKeys,
		underlineMagicGroups:
			typeof value.underlineMagicGroups === 'boolean'
				? value.underlineMagicGroups
				: defaults.underlineMagicGroups,
		underlineAdaptiveGroups:
			typeof value.underlineAdaptiveGroups === 'boolean'
				? value.underlineAdaptiveGroups
				: defaults.underlineAdaptiveGroups,
		showAdaptiveSwaps:
			typeof value.showAdaptiveSwaps === 'boolean'
				? value.showAdaptiveSwaps
				: defaults.showAdaptiveSwaps,
		onlyRelevantAdaptiveSwaps:
			typeof value.onlyRelevantAdaptiveSwaps === 'boolean'
				? value.onlyRelevantAdaptiveSwaps
				: defaults.onlyRelevantAdaptiveSwaps,
		showSwapPaths:
			typeof value.showSwapPaths === 'boolean' ? value.showSwapPaths : defaults.showSwapPaths,
		ignoreWrongKeyPresses:
			typeof value.ignoreWrongKeyPresses === 'boolean'
				? value.ignoreWrongKeyPresses
				: defaults.ignoreWrongKeyPresses
	};

	return options;
}

export function parseTypingPracticeDisplayOptions(
	storedValue: string | null
): TypingPracticeDisplayOptions {
	if (storedValue === null) return createDefaultTypingPracticeDisplayOptions();
	try {
		const document: unknown = JSON.parse(storedValue);
		if (
			!isRecord(document) ||
			(document.version !== 1 && document.version !== TYPING_PRACTICE_DISPLAY_OPTIONS_VERSION)
		) {
			return createDefaultTypingPracticeDisplayOptions();
		}
		return normalizeTypingPracticeDisplayOptions(document.options);
	} catch {
		return createDefaultTypingPracticeDisplayOptions();
	}
}

export function serializeTypingPracticeDisplayOptions(
	options: TypingPracticeDisplayOptions
): string {
	return JSON.stringify({
		version: TYPING_PRACTICE_DISPLAY_OPTIONS_VERSION,
		options: normalizeTypingPracticeDisplayOptions(options)
	});
}
