import { buildKeyMap, buildShiftKeyMap, type KeyMap } from './cmini/keyboard';
import type { ThumbKeyEntry } from './layout';

export interface LayoutTestKeyMaps {
	keyMap: KeyMap;
	shiftKeyMap: KeyMap;
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

export function createLayoutTestKeyMaps(displayValue: string): LayoutTestKeyMaps {
	const keyMap = buildKeyMap(displayValue);
	return {
		keyMap,
		shiftKeyMap: buildShiftKeyMap(keyMap)
	};
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
	const mappedCharacter = input.shiftKey
		? options.keyMaps.shiftKeyMap[input.code]
		: options.keyMaps.keyMap[input.code];
	const mappedCode = input.code in options.keyMaps.keyMap;

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
