export const TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY = 'typingPracticeDisplayOptions';

const TYPING_PRACTICE_DISPLAY_OPTIONS_VERSION = 1;

export interface TypingPracticeDisplayOptions {
	highlightNextKey: boolean;
	colorHomeKeys: boolean;
	showSpecialKeys: boolean;
	showAdaptiveSwaps: boolean;
	showSwapPaths: boolean;
}

export function createDefaultTypingPracticeDisplayOptions(): TypingPracticeDisplayOptions {
	return {
		highlightNextKey: false,
		colorHomeKeys: false,
		showSpecialKeys: true,
		showAdaptiveSwaps: true,
		showSwapPaths: false
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTypingPracticeDisplayOptions(value: unknown): TypingPracticeDisplayOptions {
	const defaults = createDefaultTypingPracticeDisplayOptions();
	if (!isRecord(value)) return defaults;

	const options = {
		highlightNextKey:
			typeof value.highlightNextKey === 'boolean'
				? value.highlightNextKey
				: defaults.highlightNextKey,
		colorHomeKeys:
			typeof value.colorHomeKeys === 'boolean' ? value.colorHomeKeys : defaults.colorHomeKeys,
		showSpecialKeys:
			typeof value.showSpecialKeys === 'boolean' ? value.showSpecialKeys : defaults.showSpecialKeys,
		showAdaptiveSwaps:
			typeof value.showAdaptiveSwaps === 'boolean'
				? value.showAdaptiveSwaps
				: defaults.showAdaptiveSwaps,
		showSwapPaths:
			typeof value.showSwapPaths === 'boolean' ? value.showSwapPaths : defaults.showSwapPaths
	};

	if (!options.showAdaptiveSwaps) options.showSwapPaths = false;
	return options;
}

export function parseTypingPracticeDisplayOptions(
	storedValue: string | null
): TypingPracticeDisplayOptions {
	if (storedValue === null) return createDefaultTypingPracticeDisplayOptions();
	try {
		const document: unknown = JSON.parse(storedValue);
		if (!isRecord(document) || document.version !== TYPING_PRACTICE_DISPLAY_OPTIONS_VERSION) {
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
