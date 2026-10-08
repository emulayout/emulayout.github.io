import type { LayoutData } from '$lib/layout';
import { creatorSparkKeys, createLayoutFromSparkKeys } from '$lib/creatorGeometry';
import {
	createDefaultKeyboardInputConfig,
	normalizeKeyboardInputValue,
	parseKeyboardInputSlot,
	type KeyboardInputConfig
} from '$lib/keyboardInputConfig';
import { DEFAULT_REPEAT_KEY } from '$lib/repeatKeys';

export const LAYOUT_CREATOR_NEW_TAB = 'new';
export const LAYOUT_CREATOR_NEW_LAYOUT_NAME = 'New layout';
export const CREATOR_MAGIC_KEY = '*';
const TRAILING_COPY_NUMBER = /^(.*)\s(\d+)$/;

function incrementDuplicatedLayoutName(name: string): string {
	const trimmed = name.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME;
	const match = trimmed.match(TRAILING_COPY_NUMBER);
	if (!match) return `${trimmed} 2`;
	return `${match[1]} ${BigInt(match[2]) + 1n}`;
}

/** First unused duplicate name: increment a trailing copy number, or append 2. */
export function nextDuplicatedLayoutName(
	name: string,
	existingNames: readonly string[] = []
): string {
	const usedNames = new Set(existingNames.map((candidate) => candidate.trim().toLowerCase()));
	let candidate = incrementDuplicatedLayoutName(name);
	while (usedNames.has(candidate.toLowerCase())) {
		candidate = incrementDuplicatedLayoutName(candidate);
	}
	return candidate;
}
/** Summary-card subtitle when a local draft has no analyzer stats. */
export const LOCAL_LAYOUT_STATS_UNAVAILABLE_DETAIL = 'Local layouts have no analyzer stats.';

export type LayoutCreatorTabValue = typeof LAYOUT_CREATOR_NEW_TAB | `saved:${string}`;

export function savedCreatorTabValue(id: string): LayoutCreatorTabValue {
	return `saved:${id}`;
}

export function savedCreatorTabId(id: string): string {
	return `layout-creator-tab-saved-${id}`;
}

export type CreatorSpecialKeys = {
	magicKey?: boolean;
	adaptiveKey?: boolean;
};

export type CreateLayoutFromKeyConfigOptions = CreatorSpecialKeys & {
	name?: string;
};

/** Row-stagger QWERTY grid used for every new creator canvas. */
export function createDefaultCreatorKeyConfig(): KeyboardInputConfig {
	return createDefaultKeyboardInputConfig();
}

/** Build the in-memory starter layout for a new creation. */
export function createDefaultCreatorLayout(name = LAYOUT_CREATOR_NEW_LAYOUT_NAME): LayoutData {
	return createLayoutFromKeyConfig(createDefaultCreatorKeyConfig(), { name });
}

export function keyboardConfigHasMagicTrigger(config: KeyboardInputConfig): boolean {
	return config.keys.some((key) => {
		const value = normalizeKeyboardInputValue(key.value);
		return value === CREATOR_MAGIC_KEY || value === DEFAULT_REPEAT_KEY;
	});
}

/** Triggers newly assigned on a slot. Clearing a slot never appears here. */
export function keyboardConfigGainedMagicTriggers(
	previous: KeyboardInputConfig,
	next: KeyboardInputConfig
): string[] {
	const previousBySlot = new Map(
		previous.keys.map((key) => [key.slot, normalizeKeyboardInputValue(key.value)])
	);
	const gained: string[] = [];
	for (const key of next.keys) {
		const value = normalizeKeyboardInputValue(key.value);
		if (value !== CREATOR_MAGIC_KEY && value !== DEFAULT_REPEAT_KEY) continue;
		if (previousBySlot.get(key.slot) === value) continue;
		if (!gained.includes(value)) gained.push(value);
	}
	return gained;
}

function extraMagicKeySlot(assigned: readonly { row: number; column: number }[]): {
	row: number;
	column: number;
} {
	const row = 1;
	let maxColumn = -1;
	for (const key of assigned) {
		if (key.row === row) maxColumn = Math.max(maxColumn, key.column);
	}
	return { row, column: maxColumn + 1 };
}

/** Add an editable `*` key after the home row unless the board already has a Magic trigger. */
export function addMagicKeyToConfig(config: KeyboardInputConfig): KeyboardInputConfig {
	if (keyboardConfigHasMagicTrigger(config)) return config;
	const assigned = config.keys.flatMap((key) => {
		const position = parseKeyboardInputSlot(key.slot);
		return position ? [position] : [];
	});
	const slot = extraMagicKeySlot(assigned);
	return {
		...config,
		baseLayoutModified: config.baseLayoutName ? true : config.baseLayoutModified,
		keys: [...config.keys, { slot: `${slot.row},${slot.column}`, value: CREATOR_MAGIC_KEY }]
	};
}

/** Build a draft layout from the creator key editor. Empty slots are omitted. */
export function createLayoutFromKeyConfig(
	config: KeyboardInputConfig,
	options: CreateLayoutFromKeyConfigOptions = {}
): LayoutData {
	const layout = createLayoutFromSparkKeys(creatorSparkKeys(config), options);
	// Preserve the adapter's optional hand contract for older input-layout consumers.
	for (const info of Object.values(layout.keys)) {
		if (!config.keys.find((key) => key.slot === `${info.row},${info.col}`)?.hand) delete info.hand;
	}
	return layout;
}
