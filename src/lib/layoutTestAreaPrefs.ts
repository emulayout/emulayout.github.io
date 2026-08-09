export const LAYOUT_TEST_AREA_DISPLAY_OPTIONS_STORAGE_KEY = 'layoutTestAreaDisplayOptions';

const LAYOUT_TEST_AREA_DISPLAY_OPTIONS_VERSION = 1;

export interface LayoutTestAreaDisplayOptions {
	colorHomeKeys: boolean;
	showSpecialKeys: boolean;
	previewContextualKeyOutput: boolean;
	showAdaptiveSwapPaths: boolean;
}

export function createDefaultLayoutTestAreaDisplayOptions(): LayoutTestAreaDisplayOptions {
	return {
		colorHomeKeys: true,
		showSpecialKeys: true,
		previewContextualKeyOutput: true,
		showAdaptiveSwapPaths: false
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLayoutTestAreaDisplayOptions(value: unknown): LayoutTestAreaDisplayOptions {
	const defaults = createDefaultLayoutTestAreaDisplayOptions();
	if (!isRecord(value)) return defaults;

	return {
		colorHomeKeys:
			typeof value.colorHomeKeys === 'boolean' ? value.colorHomeKeys : defaults.colorHomeKeys,
		showSpecialKeys:
			typeof value.showSpecialKeys === 'boolean' ? value.showSpecialKeys : defaults.showSpecialKeys,
		previewContextualKeyOutput:
			typeof value.previewContextualKeyOutput === 'boolean'
				? value.previewContextualKeyOutput
				: defaults.previewContextualKeyOutput,
		showAdaptiveSwapPaths:
			typeof value.showAdaptiveSwapPaths === 'boolean'
				? value.showAdaptiveSwapPaths
				: defaults.showAdaptiveSwapPaths
	};
}

export function parseLayoutTestAreaDisplayOptions(
	storedValue: string | null
): LayoutTestAreaDisplayOptions {
	if (storedValue === null) return createDefaultLayoutTestAreaDisplayOptions();
	try {
		const document: unknown = JSON.parse(storedValue);
		if (!isRecord(document) || document.version !== LAYOUT_TEST_AREA_DISPLAY_OPTIONS_VERSION) {
			return createDefaultLayoutTestAreaDisplayOptions();
		}
		return normalizeLayoutTestAreaDisplayOptions(document.options);
	} catch {
		return createDefaultLayoutTestAreaDisplayOptions();
	}
}

export function serializeLayoutTestAreaDisplayOptions(
	options: LayoutTestAreaDisplayOptions
): string {
	return JSON.stringify({
		version: LAYOUT_TEST_AREA_DISPLAY_OPTIONS_VERSION,
		options: normalizeLayoutTestAreaDisplayOptions(options)
	});
}
