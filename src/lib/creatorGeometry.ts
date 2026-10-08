import type { KeyInfo, LayoutData } from '$lib/layout';
import type { SparkKey } from '$lib/sparkSchema';
import {
	normalizeKeyboardInputValue,
	parseKeyboardInputSlot,
	type KeyboardInputConfig
} from '$lib/keyboardInputConfig';
import { computeCharacterSet } from '$lib/layoutCharacterSet';
import { isChiralCharacter } from '$lib/chiralKeys';

/** Infer unassigned fingers only at the slot-editor boundary. Explicit source fingers stay in Spark. */
export function creatorSparkKeys(
	config: KeyboardInputConfig,
	duplicates: 'first' | 'last' = 'last'
): SparkKey[] {
	const keys: SparkKey[] = config.keys.flatMap((key) => {
		const position = parseKeyboardInputSlot(key.slot);
		if (!position || !Number.isSafeInteger(position.row) || !Number.isSafeInteger(position.column))
			return [];
		const { row, column: col } = position;
		let finger: SparkKey['finger'] =
			row >= 3
				? key.thumbHand === 'r'
					? 'RT'
					: 'LT'
				: ((['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'] as const)[col] ?? 'RP');
		if (key.hand && !finger.startsWith(key.hand.toUpperCase()))
			finger = `${key.hand.toUpperCase()}${finger.slice(1)}` as SparkKey['finger'];
		return [
			{
				row,
				col,
				finger,
				...(Array.from(normalizeKeyboardInputValue(key.value)).length === 1
					? { char: normalizeKeyboardInputValue(key.value) }
					: {})
			}
		];
	});
	// Spark's first occurrence is primary. Move explicit primary duplicates ahead of their peers.
	const primary = new Map<string, (typeof config.keys)[number]>();
	for (const key of config.keys) {
		const value = normalizeKeyboardInputValue(key.value);
		if (!value) continue;
		if (
			!primary.get(value)?.primary &&
			(key.primary || duplicates === 'last' || !primary.has(value))
		)
			primary.set(value, key);
	}
	for (const key of primary.values()) {
		const current = keys.findIndex((entry) => `${entry.row},${entry.col}` === key.slot);
		const first = keys.findIndex((entry) => entry.char === normalizeKeyboardInputValue(key.value));
		if (current > first && first >= 0) keys.splice(first, 0, ...keys.splice(current, 1));
	}
	return keys;
}

/** Build runtime geometry directly. Spark's first occurrence owns each character lookup. */
export function createLayoutFromSparkKeys(
	source: readonly SparkKey[],
	options: { name?: string; magicKey?: boolean; adaptiveKey?: boolean } = {}
): LayoutData {
	const keys: Record<string, KeyInfo> = {};
	const positionBySlot = new Map<string, string>();
	const thumbKeysByHand: LayoutData['thumbKeysByHand'] = { l: [], r: [] };
	for (const key of source) {
		if (key.row < 0 || key.row > 4 || key.col > 12 || !key.char || !isChiralCharacter(key.char))
			continue;
		const char = normalizeKeyboardInputValue(key.char);
		const hand = key.finger.startsWith('L') ? 'l' : 'r';
		const info: KeyInfo = {
			row: key.row,
			col: key.col,
			hand,
			...(key.row >= 3 ? { thumbHand: hand } : {})
		};
		if (!Object.hasOwn(keys, char)) keys[char] = info;
		positionBySlot.set(`${key.row},${key.col}`, char);
		if (key.row >= 3) thumbKeysByHand[hand].push({ key: char.toLowerCase(), col: key.col });
	}
	thumbKeysByHand.l.sort((a, b) => a.col - b.col);
	thumbKeysByHand.r.sort((a, b) => a.col - b.col);
	const chars = [...positionBySlot.values()];
	const letters = new Set(
		chars.flatMap((char) => [...char.toLowerCase()].filter((c) => c >= 'a' && c <= 'z'))
	);
	return {
		name: options.name ?? 'New layout',
		user: '0',
		updatedAt: '',
		keys,
		positionBySlot,
		thumbKeysByHand,
		hasThumbKeys: thumbKeysByHand.l.length + thumbKeysByHand.r.length > 0,
		characterSet: computeCharacterSet(chars),
		hasAllLetters: letters.size === 26,
		hasMagicKey: Boolean(options.magicKey || keys['*']),
		hasRepeatKey: Object.hasOwn(keys, '@'),
		hasMagicKeyMappings: false,
		cyanophageStatsNeedMagicMappings: false,
		hasAdaptiveSwap: options.adaptiveKey ?? false,
		hasAdaptiveSwapMappings: false,
		hasChiralKey: false,
		hasChiralKeyMappings: false,
		cyanophageCompatible: false
	};
}
