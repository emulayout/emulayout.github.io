import { shiftedKeyCharacter } from '$lib/cmini/keyboard';
import type { KeyboardInputConfig } from '$lib/keyboardInputConfig';
import type { LayoutData } from '$lib/layout';
import { withKeyboardInputConfig, type LayoutTestKeyMaps } from '$lib/layoutTestEmulator';

export type LayoutKeyReachabilityOptions = {
	/** When true, practiced-layout thumbs count as reachable via Space simulation. */
	simulateThumbKeys?: boolean;
};

/** Whether a character is covered by a reachable-target set (case-insensitive). */
export function isTargetCharacterReachable(
	character: string,
	reachable: ReadonlySet<string>
): boolean {
	if (!character) return false;
	return (
		reachable.has(character) ||
		reachable.has(character.toLowerCase()) ||
		reachable.has(character.toUpperCase())
	);
}

/**
 * Practiced-layout characters the configured input keyboard can produce.
 * Space is always included. With Simulate thumb keys on, non-space thumbs are included even
 * when input thumb slots are empty.
 */
export function collectReachableTargetCharacters(
	keyMaps: LayoutTestKeyMaps,
	targetLayout: LayoutData,
	inputConfig: KeyboardInputConfig,
	options: LayoutKeyReachabilityOptions = {}
): Set<string> {
	const simulateThumbKeys = Boolean(options.simulateThumbKeys);
	const inputKeyMap =
		withKeyboardInputConfig(keyMaps, targetLayout, inputConfig, {
			includeThumbKeys: !simulateThumbKeys
		}).inputKeyMap ?? {};

	const reachable = new Set<string>();
	for (const target of Object.values(inputKeyMap)) {
		if (target) reachable.add(target);
	}

	if (simulateThumbKeys) {
		for (const hand of ['l', 'r'] as const) {
			for (const { key } of targetLayout.thumbKeysByHand[hand]) {
				if (!key || key === ' ') continue;
				reachable.add(key);
				const shifted = shiftedKeyCharacter(key);
				if (shifted && shifted !== ' ') reachable.add(shifted);
			}
		}
	}

	reachable.add(' ');
	return reachable;
}

/**
 * Layout keycap characters (plus shifted forms) that cannot be produced from the input profile.
 * Space is never listed.
 */
export function unreachableTargetLayoutKeys(
	targetLayout: LayoutData,
	reachable: ReadonlySet<string>
): Set<string> {
	const unreachable = new Set<string>();
	for (const character of Object.keys(targetLayout.keys)) {
		if (!character || character === ' ') continue;
		if (isTargetCharacterReachable(character, reachable)) continue;
		unreachable.add(character);
		const shifted = shiftedKeyCharacter(character);
		if (shifted && shifted !== ' ' && !isTargetCharacterReachable(shifted, reachable)) {
			unreachable.add(shifted);
		}
	}
	return unreachable;
}

export function isUnreachableTargetLayoutKey(
	character: string,
	unreachable: ReadonlySet<string>
): boolean {
	if (!character || character === ' ') return false;
	return (
		unreachable.has(character) ||
		unreachable.has(character.toLowerCase()) ||
		unreachable.has(character.toUpperCase())
	);
}

export function isLayoutThumbKey(layout: LayoutData, character: string): boolean {
	const needle = character.toLowerCase();
	return (
		layout.thumbKeysByHand.l.some(({ key }) => key.toLowerCase() === needle) ||
		layout.thumbKeysByHand.r.some(({ key }) => key.toLowerCase() === needle)
	);
}

/** Native `title` copy for an unreachable practiced-layout keycap. */
export function unreachableLayoutKeyTitle(options: { isThumb: boolean }): string {
	const base =
		'No physical mapping from your input layout. Words with this key are excluded from random lessons.';
	if (!options.isThumb) return base;
	return `${base} Assign this thumb in Input layout, or turn on Simulate thumb keys.`;
}

/** Drop words that require any unreachable practiced-layout character. */
export function filterWordsByReachableCharacters(
	words: readonly string[],
	unreachable: ReadonlySet<string>
): string[] {
	if (unreachable.size === 0) return [...words];
	return words.filter(
		(word) =>
			!Array.from(word).some((character) => isUnreachableTargetLayoutKey(character, unreachable))
	);
}

/**
 * Prefer words that avoid unreachable characters; if that empties the pool, keep the original
 * words so practice can still start.
 */
export function typingPracticeWordsForReachability(
	words: readonly string[],
	unreachable: ReadonlySet<string>
): string[] {
	const filtered = filterWordsByReachableCharacters(words, unreachable);
	return filtered.length > 0 ? filtered : [...words];
}
