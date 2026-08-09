import {
	buildKeyMap,
	buildShiftKeyMap,
	QWERTY_KEY_MAP,
	shiftedKeyCharacter,
	type KeyMap
} from './cmini/keyboard';
import type { ThumbKeyEntry } from './layout';
import type { LayoutData } from '$lib/layout';
import type { DisplayCell } from '$lib/layoutDisplay';
import {
	keyboardInputEffectiveValue,
	parseKeyboardInputSlot,
	type KeyboardInputConfig
} from '$lib/keyboardInputConfig';

export interface LayoutTestKeyMaps {
	keyMap: KeyMap;
	shiftKeyMap: KeyMap;
	/** Visible target character keyed by stable main-grid `row,column` slot. */
	slotKeyMap?: KeyMap;
	/** Browser-emitted key value → practiced-layout output for a configured input keyboard. */
	inputKeyMap?: KeyMap;
}

export interface LayoutTestDisplayGeometry {
	layout: LayoutData;
	rows: readonly (readonly DisplayCell[])[];
}

export interface LayoutTestKeyInput {
	key: string;
	code: string;
	shiftKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	metaKey: boolean;
}

export interface LayoutTestKeyOptions {
	hasThumbKeys: boolean;
	thumbKeysByHand: { l: ThumbKeyEntry[]; r: ThumbKeyEntry[] };
	keyMaps: LayoutTestKeyMaps;
	metaThumbKeys: boolean;
}

export type LayoutTestEdit = { type: 'clear' } | { type: 'insert'; text: string };

export interface LayoutTestKeyDecision {
	preventDefault: boolean;
	stopPropagation: boolean;
	edit?: LayoutTestEdit;
}

export interface TextSelectionEdit {
	value: string;
	cursor: number;
}

const PASS_THROUGH: LayoutTestKeyDecision = {
	preventDefault: false,
	stopPropagation: false
};

function buildSlotKeyMap({ layout, rows }: LayoutTestDisplayGeometry): KeyMap {
	const slotKeyMap: KeyMap = {};

	for (const row of rows) {
		const visibleKeys = row.filter(
			(cell): cell is DisplayCell & { slot: string } => cell.slot !== null
		);
		if (visibleKeys.length === 0) continue;

		const rowNumber = parseKeyboardInputSlot(visibleKeys[0].slot)?.row;
		if (rowNumber === undefined || rowNumber >= 3) continue;

		const columns = Array.from(layout.positionBySlot.keys())
			.map(parseKeyboardInputSlot)
			.filter(
				(position): position is { row: number; column: number } => position?.row === rowNumber
			)
			.map(({ column }) => column)
			.toSorted((a, b) => a - b);

		for (let index = 0; index < columns.length; index += 1) {
			const visibleKey = visibleKeys[index];
			if (visibleKey) slotKeyMap[`${rowNumber},${columns[index]}`] = visibleKey.char;
		}
	}

	return slotKeyMap;
}

export function createLayoutTestKeyMaps(
	displayValue: string,
	displayGeometry?: LayoutTestDisplayGeometry
): LayoutTestKeyMaps {
	const keyMap = buildKeyMap(displayValue);
	return {
		keyMap,
		shiftKeyMap: buildShiftKeyMap(keyMap),
		...(displayGeometry ? { slotKeyMap: buildSlotKeyMap(displayGeometry) } : {})
	};
}

const codeBySlot = new Map(
	Object.entries(QWERTY_KEY_MAP).map(([code, position]) => [
		`${position.row},${position.col}`,
		code
	])
);

/**
 * Add event.key-based translation for a configured input layout while retaining the legacy
 * event.code maps as a fallback contract for consumers that have not opted in yet.
 */
export function withKeyboardInputConfig(
	keyMaps: LayoutTestKeyMaps,
	targetLayout: LayoutData,
	inputConfig: KeyboardInputConfig
): LayoutTestKeyMaps {
	const inputKeyMap: KeyMap = {};
	const thumbKeysByHand = { l: [] as typeof inputConfig.keys, r: [] as typeof inputConfig.keys };

	for (const inputKey of inputConfig.keys) {
		const position = parseKeyboardInputSlot(inputKey.slot);
		if (!position || position.row < 3) continue;
		const hand = inputKey.thumbHand ?? (position.column < 5 ? 'l' : 'r');
		thumbKeysByHand[hand].push(inputKey);
	}
	for (const hand of ['l', 'r'] as const) {
		thumbKeysByHand[hand].sort((a, b) => {
			const aPosition = parseKeyboardInputSlot(a.slot);
			const bPosition = parseKeyboardInputSlot(b.slot);
			return (aPosition?.column ?? 0) - (bPosition?.column ?? 0);
		});
	}

	for (const inputKey of inputConfig.keys) {
		const source = keyboardInputEffectiveValue(inputKey);
		const position = parseKeyboardInputSlot(inputKey.slot);
		if (!source || !position) continue;

		let target: string;
		let shiftedTarget: string | undefined;
		if (position.row < 3) {
			const code = codeBySlot.get(inputKey.slot);
			target = keyMaps.slotKeyMap
				? (keyMaps.slotKeyMap[inputKey.slot] ?? '')
				: code
					? (keyMaps.keyMap[code] ?? '')
					: '';
			shiftedTarget = shiftedKeyCharacter(target);
		} else {
			const hand = inputKey.thumbHand ?? (position.column < 5 ? 'l' : 'r');
			const inputThumbIndex = thumbKeysByHand[hand].findIndex(
				(candidate) => candidate.slot === inputKey.slot
			);
			target = targetLayout.thumbKeysByHand[hand][inputThumbIndex]?.key ?? '';
			shiftedTarget = shiftedKeyCharacter(target);
		}

		inputKeyMap[source] = target;
		const shiftedSource = shiftedKeyCharacter(source);
		if (shiftedSource) inputKeyMap[shiftedSource] = shiftedTarget ?? '';
	}

	return { ...keyMaps, inputKeyMap };
}

export function insertTextAtSelection(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	text: string
): TextSelectionEdit {
	return {
		value: value.slice(0, selectionStart) + text + value.slice(selectionEnd),
		cursor: selectionStart + text.length
	};
}

/** Apple devices use Command as the physical thumb key; other platforms use Alt. */
export function usesMetaThumbKeys(platform: string, userAgent: string): boolean {
	return /Mac|iPhone|iPad|iPod/.test(platform || userAgent);
}

function thumbHandFromCode(code: string): 'l' | 'r' | undefined {
	if (code === 'MetaLeft' || code === 'AltLeft') return 'l';
	if (code === 'MetaRight' || code === 'AltRight') return 'r';
	return undefined;
}

function isThumbKeyCode(code: string, metaThumbKeys: boolean): boolean {
	return metaThumbKeys
		? code === 'MetaLeft' || code === 'MetaRight'
		: code === 'AltLeft' || code === 'AltRight';
}

function primaryThumbCharacter(
	thumbKeysByHand: LayoutTestKeyOptions['thumbKeysByHand'],
	hand: 'l' | 'r'
): string | undefined {
	const entries = thumbKeysByHand[hand];
	if (entries.length === 0) return undefined;
	return hand === 'l' ? entries.at(-1)?.key : entries[0]?.key;
}

function isThumbModifierHeld(input: LayoutTestKeyInput, metaThumbKeys: boolean): boolean {
	return metaThumbKeys ? input.metaKey : input.altKey;
}

function hasBlockingModifier(input: LayoutTestKeyInput, metaThumbKeys: boolean): boolean {
	if (metaThumbKeys) return input.ctrlKey || input.altKey;
	// Alt is the thumb modifier. Allow AltGr (Ctrl+Alt); block Meta and plain Ctrl.
	return input.metaKey || (input.ctrlKey && !input.altKey);
}

export function resolveLayoutTestKeyDown(
	input: LayoutTestKeyInput,
	options: LayoutTestKeyOptions
): LayoutTestKeyDecision {
	if (input.key === 'Escape') {
		return {
			preventDefault: true,
			stopPropagation: false,
			edit: { type: 'clear' }
		};
	}

	if (options.hasThumbKeys && isThumbKeyCode(input.code, options.metaThumbKeys)) {
		const hand = thumbHandFromCode(input.code);
		let mappedCharacter = hand ? primaryThumbCharacter(options.thumbKeysByHand, hand) : undefined;
		if (mappedCharacter && input.shiftKey && /^[a-z]$/i.test(mappedCharacter)) {
			mappedCharacter = mappedCharacter.toUpperCase();
		}
		return {
			preventDefault: true,
			stopPropagation: true,
			...(mappedCharacter ? { edit: { type: 'insert' as const, text: mappedCharacter } } : {})
		};
	}

	if (options.hasThumbKeys) {
		if (hasBlockingModifier(input, options.metaThumbKeys)) return PASS_THROUGH;
	} else if (input.ctrlKey || input.altKey || input.metaKey) {
		return PASS_THROUGH;
	}

	const captureThumbModifier =
		options.hasThumbKeys && isThumbModifierHeld(input, options.metaThumbKeys);
	const usesConfiguredInput = options.keyMaps.inputKeyMap !== undefined;
	const mappedCharacter = usesConfiguredInput
		? options.keyMaps.inputKeyMap?.[input.key]
		: input.shiftKey
			? options.keyMaps.shiftKeyMap[input.code]
			: options.keyMaps.keyMap[input.code];
	const mappedCode = usesConfiguredInput
		? input.key in (options.keyMaps.inputKeyMap ?? {})
		: input.code in options.keyMaps.keyMap;

	if (!mappedCode && !captureThumbModifier) return PASS_THROUGH;
	return {
		preventDefault: true,
		stopPropagation: captureThumbModifier,
		...(mappedCharacter ? { edit: { type: 'insert' as const, text: mappedCharacter } } : {})
	};
}

export function shouldCaptureLayoutTestKeyUp(
	code: string,
	hasThumbKeys: boolean,
	metaThumbKeys: boolean
): boolean {
	return hasThumbKeys && isThumbKeyCode(code, metaThumbKeys);
}
