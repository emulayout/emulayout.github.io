import type { BoardType, LayoutData } from '$lib/layout';
import { isHomeKeySlot, shiftedKeyCharacter } from '$lib/cmini/keyboard';

export const KEYBOARD_INPUT_CONFIG_STORAGE_KEY = 'keyboardInputConfig';

const KEYBOARD_INPUT_CONFIG_VERSION = 3;

export type InputKeyboardType = 'ortho' | 'staggered';

export interface KeyboardInputKey {
	slot: string;
	value: string;
	/** The imported base layout does not assign this physical slot. */
	inert?: boolean;
	thumbHand?: 'l' | 'r';
}

export interface KeyboardInputConfig {
	baseLayoutName: string | null;
	/** At least one key has been edited since the current base was selected. */
	baseLayoutModified: boolean;
	keyboardType: InputKeyboardType;
	keys: KeyboardInputKey[];
}

export interface KeyboardInputRow {
	row: number;
	keys: KeyboardInputKey[];
}

export interface KeyboardInputConfigValidation {
	error: string | null;
	invalidSlots: string[];
}

const DEFAULT_QWERTY_ROWS = [
	['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
	['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
	['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
] as const;

const DEFAULT_QWERTY_MAIN_KEYS: readonly KeyboardInputKey[] = DEFAULT_QWERTY_ROWS.flatMap(
	(row, rowIndex) => row.map((value, column) => ({ slot: `${rowIndex},${column}`, value }))
);

const STANDARD_ANSI_INPUT_VALUES = DEFAULT_QWERTY_MAIN_KEYS.map((key) => key.value);

const DEFAULT_QWERTY_VALUE_BY_SLOT = new Map(
	DEFAULT_QWERTY_MAIN_KEYS.map((key) => [key.slot, key.value])
);

const DEFAULT_THUMB_INPUTS: readonly KeyboardInputKey[] = [
	{ slot: '3,0', value: '', thumbHand: 'l' },
	{ slot: '3,1', value: '', thumbHand: 'r' }
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseKeyboardInputSlot(slot: string): { row: number; column: number } | null {
	const match = /^(\d+),(\d+)$/.exec(slot);
	if (!match) return null;
	return { row: Number(match[1]), column: Number(match[2]) };
}

function compareKeyboardInputKeys(a: KeyboardInputKey, b: KeyboardInputKey): number {
	const aPosition = parseKeyboardInputSlot(a.slot);
	const bPosition = parseKeyboardInputSlot(b.slot);
	if (!aPosition || !bPosition) return a.slot.localeCompare(b.slot);
	if (aPosition.row !== bPosition.row) return aPosition.row - bPosition.row;
	if (aPosition.row >= 3) {
		const handOrder = (a.thumbHand === 'r' ? 1 : 0) - (b.thumbHand === 'r' ? 1 : 0);
		if (handOrder !== 0) return handOrder;
	}
	return aPosition.column - bPosition.column;
}

export function normalizeKeyboardInputValue(value: string): string {
	const character = Array.from(value)[0] ?? '';
	return /^[A-Z]$/u.test(character) ? character.toLowerCase() : character;
}

export function inputKeyboardTypeFromBoard(board: BoardType | string): InputKeyboardType {
	return board === 'stagger' || board === 'angle' ? 'staggered' : 'ortho';
}

function withKeyboardInputThumbPlaceholders(keys: KeyboardInputKey[]): KeyboardInputKey[] {
	const result = keys.map((key) => ({ ...key }));
	const slots = new Set(result.map((key) => key.slot));
	for (const placeholder of DEFAULT_THUMB_INPUTS) {
		if (result.some((key) => key.thumbHand === placeholder.thumbHand)) continue;
		let column = 0;
		while (slots.has(`3,${column}`)) column += 1;
		const key = { ...placeholder, slot: `3,${column}` };
		result.push(key);
		slots.add(key.slot);
	}
	return result.sort(compareKeyboardInputKeys);
}

function withKeyboardInputTopology(
	keys: KeyboardInputKey[],
	missingMainKeysInert = false
): KeyboardInputKey[] {
	const result = keys.map((key) => ({ ...key }));
	const slots = new Set(result.map((key) => key.slot));
	for (const defaultKey of DEFAULT_QWERTY_MAIN_KEYS) {
		if (slots.has(defaultKey.slot)) continue;
		result.push({
			slot: defaultKey.slot,
			value: '',
			...(missingMainKeysInert ? { inert: true } : {})
		});
		slots.add(defaultKey.slot);
	}
	return withKeyboardInputThumbPlaceholders(result);
}

export function keyboardInputPlaceholderValue(slot: string): string {
	return DEFAULT_QWERTY_VALUE_BY_SLOT.get(slot) ?? '';
}

export function keyboardInputEffectiveValue(key: KeyboardInputKey): string {
	if (key.inert) return '';
	return normalizeKeyboardInputValue(key.value) || keyboardInputPlaceholderValue(key.slot);
}

export function keyboardInputConfigLabel(config: KeyboardInputConfig): string {
	if (config.baseLayoutName && !config.baseLayoutModified) return config.baseLayoutName;
	if (config.baseLayoutModified) return 'Custom';
	const hasCustomValue = config.keys.some((key) => {
		const value = normalizeKeyboardInputValue(key.value);
		return Boolean(value && value !== keyboardInputPlaceholderValue(key.slot));
	});
	return hasCustomValue ? 'Custom' : 'QWERTY';
}

export function createDefaultKeyboardInputConfig(): KeyboardInputConfig {
	return {
		baseLayoutName: 'QWERTY',
		baseLayoutModified: false,
		keyboardType: 'staggered',
		keys: withKeyboardInputTopology([...DEFAULT_QWERTY_MAIN_KEYS])
	};
}

/** Rebuild a config and fill any missing main-row or thumb placeholders. */
export function buildKeyboardInputConfig(
	config: Omit<KeyboardInputConfig, 'keys'> & { keys: readonly KeyboardInputKey[] }
): KeyboardInputConfig {
	return {
		baseLayoutName: config.baseLayoutName,
		baseLayoutModified: config.baseLayoutModified,
		keyboardType: config.keyboardType,
		keys: withKeyboardInputTopology(config.keys.map((key) => ({ ...key })))
	};
}

export function createKeyboardInputConfigFromLayout(layout: LayoutData): KeyboardInputConfig {
	const keys = Array.from(layout.positionBySlot, ([slot, value]): KeyboardInputKey => {
		const info = layout.keys[value];
		const thumbHand = info?.row >= 3 ? (info.thumbHand ?? (info.col < 5 ? 'l' : 'r')) : undefined;
		return {
			slot,
			value: normalizeKeyboardInputValue(value),
			...(thumbHand ? { thumbHand } : {})
		};
	});

	return {
		baseLayoutName: layout.name,
		baseLayoutModified: false,
		keyboardType: inputKeyboardTypeFromBoard(layout.board),
		keys: withKeyboardInputTopology(keys, true)
	};
}

export function cloneKeyboardInputConfig(config: KeyboardInputConfig): KeyboardInputConfig {
	return { ...config, keys: config.keys.map((key) => ({ ...key })) };
}

export function validateKeyboardInputConfig(
	config: KeyboardInputConfig
): KeyboardInputConfigValidation {
	const slotsByValue = new Map<string, string[]>();
	for (const key of config.keys) {
		const value = keyboardInputEffectiveValue(key);
		if (!value) continue;
		const emittedValues = new Set(
			[value, shiftedKeyCharacter(value)].filter(
				(emittedValue): emittedValue is string => emittedValue !== undefined
			)
		);
		for (const emittedValue of emittedValues) {
			const slots = slotsByValue.get(emittedValue) ?? [];
			slots.push(key.slot);
			slotsByValue.set(emittedValue, slots);
		}
	}

	const invalidSlotSet = new Set(
		Array.from(slotsByValue.values())
			.filter((slots) => slots.length > 1)
			.flat()
	);
	const invalidSlots = config.keys
		.map(({ slot }) => slot)
		.filter((slot) => invalidSlotSet.has(slot));
	return {
		error: invalidSlots.length > 0 ? 'Each key value must be unique.' : null,
		invalidSlots
	};
}

export function keyboardInputConfigError(config: KeyboardInputConfig): string | null {
	return validateKeyboardInputConfig(config).error;
}

export function keyboardInputMissingAnsiValues(config: KeyboardInputConfig): string[] {
	const configuredValues = new Set(config.keys.map(keyboardInputEffectiveValue).filter(Boolean));
	return STANDARD_ANSI_INPUT_VALUES.filter((value) => !configuredValues.has(value));
}

export function clearKeyboardInputConfig(config: KeyboardInputConfig): KeyboardInputConfig {
	return {
		...config,
		baseLayoutName: null,
		baseLayoutModified: false,
		keys: config.keys.map((key) => ({
			slot: key.slot,
			value: '',
			...(key.thumbHand ? { thumbHand: key.thumbHand } : {})
		}))
	};
}

export function isKeyboardInputHomeKeySlot(row: number, column: number): boolean {
	return isHomeKeySlot(row, column);
}

export type KeyboardWidthTerms = { keyUnits: number; gapCount: number };

const KEYBOARD_WIDTH_KEY_REM = 3.35;
const KEYBOARD_WIDTH_GAP_REM = 0.45;

/**
 * Intrinsic key/gap counts for the editable board, including empty QWERTY
 * topology slots. The presentation preview keeps the three letter rows and gap keys.
 */
export function keyboardInputEditorWidthTerms(config: KeyboardInputConfig): KeyboardWidthTerms {
	if (config.keyboardType === 'ortho') {
		let maxColumn = 9;
		for (const key of config.keys) {
			const position = parseKeyboardInputSlot(key.slot);
			if (position && position.row < 3) maxColumn = Math.max(maxColumn, position.column);
		}
		const rightSlotCount = Math.max(5, maxColumn - 4);
		return {
			keyUnits: 5 + rightSlotCount + 0.48,
			gapCount: rightSlotCount + 3
		};
	}

	const rowTerms = keyboardInputRows(config).flatMap((row) => {
		if (row.row >= 3 || row.keys.length === 0) return [];
		const rowOffset = row.row === 1 ? 0.28 : row.row === 2 ? 0.68 : 0;
		return [
			{
				keyUnits: row.keys.length + rowOffset,
				gapCount: Math.max(row.keys.length - 1, 0)
			}
		];
	});

	return (
		rowTerms.sort(
			(a, b) =>
				b.keyUnits * KEYBOARD_WIDTH_KEY_REM +
				b.gapCount * KEYBOARD_WIDTH_GAP_REM -
				(a.keyUnits * KEYBOARD_WIDTH_KEY_REM + a.gapCount * KEYBOARD_WIDTH_GAP_REM)
		)[0] ?? { keyUnits: 13, gapCount: 12 }
	);
}

export function keyboardInputRows(config: KeyboardInputConfig): KeyboardInputRow[] {
	const rows = new Map<number, KeyboardInputKey[]>();
	for (const key of config.keys) {
		const position = parseKeyboardInputSlot(key.slot);
		if (!position) continue;
		const row = rows.get(position.row) ?? [];
		row.push(key);
		rows.set(position.row, row);
	}
	return Array.from(rows, ([row, keys]) => ({
		row,
		keys: keys.toSorted(compareKeyboardInputKeys)
	})).toSorted((a, b) => a.row - b.row);
}

export function updateKeyboardInputKey(
	config: KeyboardInputConfig,
	slot: string,
	value: string
): KeyboardInputConfig {
	const normalizedValue = normalizeKeyboardInputValue(value);
	const currentKey = config.keys.find((key) => key.slot === slot);
	const keyChanged = Boolean(
		currentKey &&
		(currentKey.value !== normalizedValue ||
			(currentKey.inert === true && Boolean(normalizedValue)))
	);
	return {
		...config,
		baseLayoutModified: config.baseLayoutName ? config.baseLayoutModified || keyChanged : false,
		keys: config.keys.map((key) =>
			key.slot === slot
				? {
						slot: key.slot,
						value: normalizedValue,
						...(!normalizedValue && key.inert ? { inert: true } : {}),
						...(key.thumbHand ? { thumbHand: key.thumbHand } : {})
					}
				: key
		)
	};
}

export function navigateKeyboardInputSlot(
	rows: readonly KeyboardInputRow[],
	currentSlot: string,
	direction: 'left' | 'right' | 'up' | 'down'
): string | null {
	const rowIndex = rows.findIndex((row) => row.keys.some((key) => key.slot === currentSlot));
	if (rowIndex < 0) return null;
	const keyIndex = rows[rowIndex].keys.findIndex((key) => key.slot === currentSlot);

	if (direction === 'left') {
		if (keyIndex > 0) return rows[rowIndex].keys[keyIndex - 1].slot;
		return rows[rowIndex - 1]?.keys.at(-1)?.slot ?? null;
	}
	if (direction === 'right') {
		if (keyIndex < rows[rowIndex].keys.length - 1) {
			return rows[rowIndex].keys[keyIndex + 1].slot;
		}
		return rows[rowIndex + 1]?.keys[0]?.slot ?? null;
	}

	const nextRow = rows[rowIndex + (direction === 'up' ? -1 : 1)];
	if (!nextRow) return null;
	return nextRow.keys[Math.min(keyIndex, nextRow.keys.length - 1)]?.slot ?? null;
}

function normalizeKeyboardInputConfig(value: unknown): KeyboardInputConfig | null {
	if (!isRecord(value)) return null;
	if (value.keyboardType !== 'ortho' && value.keyboardType !== 'staggered') return null;
	if (value.baseLayoutModified !== undefined && typeof value.baseLayoutModified !== 'boolean') {
		return null;
	}
	if (!Array.isArray(value.keys)) return null;

	const keys: KeyboardInputKey[] = [];
	const slots = new Set<string>();
	for (const entry of value.keys) {
		if (!isRecord(entry) || typeof entry.slot !== 'string') {
			return null;
		}
		const position = parseKeyboardInputSlot(entry.slot);
		if (!position) return null;
		if (typeof entry.value !== 'string' || slots.has(entry.slot)) return null;
		if (entry.inert !== undefined && typeof entry.inert !== 'boolean') return null;
		if (entry.thumbHand !== undefined && entry.thumbHand !== 'l' && entry.thumbHand !== 'r') {
			return null;
		}
		const normalizedValue = normalizeKeyboardInputValue(entry.value);
		const thumbHand =
			position.row >= 3 ? (entry.thumbHand ?? (position.column < 5 ? 'l' : 'r')) : undefined;
		slots.add(entry.slot);
		keys.push({
			slot: entry.slot,
			value: normalizedValue,
			...(!normalizedValue && entry.inert === true ? { inert: true } : {}),
			...(thumbHand ? { thumbHand } : {})
		});
	}

	const config: KeyboardInputConfig = {
		baseLayoutName: typeof value.baseLayoutName === 'string' ? value.baseLayoutName : null,
		baseLayoutModified: value.baseLayoutModified === true,
		keyboardType: value.keyboardType,
		keys: withKeyboardInputTopology(keys)
	};
	return keyboardInputConfigError(config) ? null : config;
}

export function parseKeyboardInputConfig(storedValue: string | null): KeyboardInputConfig {
	if (storedValue === null) return createDefaultKeyboardInputConfig();
	try {
		const document: unknown = JSON.parse(storedValue);
		if (
			!isRecord(document) ||
			(document.version !== 1 && document.version !== 2 && document.version !== 3)
		) {
			return createDefaultKeyboardInputConfig();
		}
		return normalizeKeyboardInputConfig(document.config) ?? createDefaultKeyboardInputConfig();
	} catch {
		return createDefaultKeyboardInputConfig();
	}
}

export function serializeKeyboardInputConfig(config: KeyboardInputConfig): string {
	const normalized = normalizeKeyboardInputConfig(config);
	if (!normalized) throw new Error('Cannot persist an invalid keyboard input configuration.');
	return JSON.stringify({ version: KEYBOARD_INPUT_CONFIG_VERSION, config: normalized });
}
