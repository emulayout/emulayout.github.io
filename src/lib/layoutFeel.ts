import { shiftedKeyCharacter, type KeyMap } from '$lib/cmini/keyboard';
import {
	keyboardInputEffectiveValue,
	parseKeyboardInputSlot,
	type KeyboardInputConfig
} from '$lib/keyboardInputConfig';
import type { LayoutData } from '$lib/layout';
import {
	resolveLayoutInput,
	type AppliedLayoutInputBehavior,
	type LayoutInputProfile
} from '$lib/layoutInputBehaviors';
import {
	withKeyboardInputConfig,
	type KeyboardInputTranslationOptions,
	type LayoutTestKeyMaps
} from '$lib/layoutTestEmulator';
import { buildTypingPracticeAdaptiveGroupIndexes } from '$lib/typingPracticeAdaptiveGroups';
import { buildTypingPracticeMagicGroupIndexes } from '$lib/typingPracticeMagicGroups';
import {
	type TypingPracticeCharacterFeedback,
	type TypingPracticeSession,
	type TypingPracticeWordFeedback
} from '$lib/typingPractice';
import type { TypingPracticeAttemptCounts } from '$lib/typingPracticeMetrics';

export type FeelKeystroke = {
	/** Physical key pressed on the practiced layout (base, shifted, Magic trigger, …). */
	targetKey: string;
	/** Text emitted by the practiced layout after Adaptive / Magic / Repeat. */
	emitted: string;
	applied: readonly AppliedLayoutInputBehavior[];
	/** Known-layout label for the preferred keystroke. */
	feel: string;
	/**
	 * Known-layout label for typing a single-character Magic emit literally instead of the
	 * preferred Magic trigger. Omitted for Adaptive and multi-character Magic emits.
	 */
	alternateFeel?: string;
};

export type FeelWordPlan = {
	sourceWord: string;
	keystrokes: readonly FeelKeystroke[];
	/** Preferred known-layout labels for each planned keystroke. */
	feelWord: string;
	magicIndexes: ReadonlySet<number>;
	adaptiveIndexes: ReadonlySet<number>;
};

/**
 * Map each practiced-layout (target) character to the known input-layout label on the same
 * physical slot. Layout feel shows these known labels so a familiar keyboard can rehearse
 * unfamiliar finger paths.
 */
export function buildFeelCharMap(
	targetKeyMaps: LayoutTestKeyMaps,
	knownConfig: KeyboardInputConfig,
	targetLayout: LayoutData,
	options: KeyboardInputTranslationOptions = {}
): KeyMap {
	const knownToTarget =
		withKeyboardInputConfig(targetKeyMaps, targetLayout, knownConfig, options).inputKeyMap ?? {};
	const targetToKnown: KeyMap = {};

	for (const [known, target] of Object.entries(knownToTarget)) {
		if (!target || targetToKnown[target] !== undefined) continue;
		targetToKnown[target] = known;
	}

	return targetToKnown;
}

/** Rewrite one source word into known-layout labels for the target layout's physical keys. */
export function translateFeelWord(word: string, targetToKnown: KeyMap): string {
	return Array.from(word, (character) => targetToKnown[character] ?? character).join('');
}

export function translateFeelWords(words: readonly string[], targetToKnown: KeyMap): string[] {
	return words.map((word) => translateFeelWord(word, targetToKnown));
}

function inputValuesForKey(key: string): string[] {
	return Array.from(
		new Set(
			[key, shiftedKeyCharacter(key)].filter(
				(value): value is string => value !== undefined && value.length > 0
			)
		)
	);
}

function keystrokeRank(keystroke: Omit<FeelKeystroke, 'feel' | 'alternateFeel'>): number {
	let rank = Array.from(keystroke.emitted).length * 100;
	if (keystroke.applied.includes('magic-key')) rank += 3;
	if (keystroke.applied.includes('adaptive-swap')) rank += 2;
	if (keystroke.applied.includes('repeat-key')) rank += 1;
	return rank;
}

function pickNextFeelKeystroke(
	remaining: string,
	history: string,
	availableKeys: readonly string[],
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: ReadonlySet<string>
): Omit<FeelKeystroke, 'feel' | 'alternateFeel'> | null {
	let best: Omit<FeelKeystroke, 'feel' | 'alternateFeel'> | null = null;

	for (const key of availableKeys) {
		for (const inputValue of inputValuesForKey(key)) {
			const result = resolveLayoutInput(profile, history, inputValue, disabledMappingIds);
			if (!result.text || !remaining.startsWith(result.text)) continue;

			const candidate: Omit<FeelKeystroke, 'feel' | 'alternateFeel'> = {
				targetKey: inputValue,
				emitted: result.text,
				applied: result.applied
			};
			if (!best || keystrokeRank(candidate) > keystrokeRank(best)) best = candidate;
		}
	}

	return best;
}

function mapSourceIndexesToFeel(
	sourceIndexes: ReadonlySet<number>,
	keystrokes: readonly FeelKeystroke[]
): ReadonlySet<number> {
	const sourceToFeel: number[] = [];
	let feelPos = 0;
	for (const keystroke of keystrokes) {
		sourceToFeel.push(...Array.from(keystroke.emitted, () => feelPos));
		feelPos += 1;
	}

	const feelIndexes = new Set<number>();
	for (const sourceIndex of sourceIndexes) {
		const feelIndex = sourceToFeel[sourceIndex];
		if (feelIndex !== undefined) feelIndexes.add(feelIndex);
	}
	return feelIndexes;
}

function feelLabelForTargetKey(targetKey: string, targetToKnown: KeyMap): string {
	return targetToKnown[targetKey] ?? targetKey;
}

function magicAlternateFeel(
	applied: readonly AppliedLayoutInputBehavior[],
	emitted: string,
	preferredFeel: string,
	targetToKnown: KeyMap
): string | undefined {
	if (!applied.includes('magic-key')) return undefined;
	const emittedCharacters = Array.from(emitted);
	if (emittedCharacters.length !== 1) return undefined;
	const literalFeel = feelLabelForTargetKey(emittedCharacters[0]!, targetToKnown);
	return literalFeel === preferredFeel ? undefined : literalFeel;
}

function finalizeFeelKeystroke(
	keystroke: Omit<FeelKeystroke, 'feel' | 'alternateFeel'>,
	targetToKnown: KeyMap
): FeelKeystroke {
	const feel = feelLabelForTargetKey(keystroke.targetKey, targetToKnown);
	const alternateFeel = magicAlternateFeel(
		keystroke.applied,
		keystroke.emitted,
		feel,
		targetToKnown
	);
	return alternateFeel === undefined
		? { ...keystroke, feel }
		: { ...keystroke, feel, alternateFeel };
}

/** Whether a typed feel character matches the preferred keystroke or its Magic literal alternate. */
export function feelKeystrokeAccepts(keystroke: FeelKeystroke, typedCharacter: string): boolean {
	return typedCharacter === keystroke.feel || typedCharacter === keystroke.alternateFeel;
}

/** Length of the leading feel input that matches the plan, allowing Magic literal alternates. */
export function feelCorrectPrefixLength(plan: FeelWordPlan, feelInput: string): number {
	const inputCharacters = Array.from(feelInput);
	let length = 0;
	while (
		length < inputCharacters.length &&
		length < plan.keystrokes.length &&
		feelKeystrokeAccepts(plan.keystrokes[length]!, inputCharacters[length]!)
	) {
		length += 1;
	}
	return length;
}

/** Leading feel input that still matches the plan (preferred or Magic literal alternate). */
export function feelCorrectInputPrefix(plan: FeelWordPlan, feelInput: string): string {
	return Array.from(feelInput).slice(0, feelCorrectPrefixLength(plan, feelInput)).join('');
}

export function hasFeelInputError(plan: FeelWordPlan, feelInput: string): boolean {
	return Array.from(feelInput).length > feelCorrectPrefixLength(plan, feelInput);
}

export function isFeelWordComplete(plan: FeelWordPlan, feelInput: string): boolean {
	return (
		Array.from(feelInput).length === plan.keystrokes.length &&
		feelCorrectPrefixLength(plan, feelInput) === plan.keystrokes.length
	);
}

/**
 * Plan the practiced-layout keystrokes needed for a source word (including enabled Magic and
 * Adaptive shortcuts), then remap those keys onto the known input layout.
 */
export function planFeelWord(
	sourceWord: string,
	availableKeys: readonly string[],
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[],
	targetToKnown: KeyMap
): FeelWordPlan {
	const disabledMappings = new Set(disabledMappingIds);
	const keystrokes: FeelKeystroke[] = [];
	let history = '';
	let remaining = sourceWord;

	while (remaining.length > 0) {
		const next =
			pickNextFeelKeystroke(remaining, history, availableKeys, profile, disabledMappings) ??
			(() => {
				const character = Array.from(remaining)[0] ?? '';
				return character
					? ({ targetKey: character, emitted: character, applied: [] } satisfies Omit<
							FeelKeystroke,
							'feel' | 'alternateFeel'
						>)
					: null;
			})();
		if (!next) break;

		const resolved = resolveLayoutInput(profile, history, next.targetKey, disabledMappings);
		const emitted = resolved.text || next.emitted;
		keystrokes.push(
			finalizeFeelKeystroke(
				{
					targetKey: next.targetKey,
					emitted,
					applied: resolved.applied
				},
				targetToKnown
			)
		);
		history = resolved.nextHistory;
		remaining = Array.from(remaining).slice(Array.from(emitted).length).join('');
	}

	return {
		sourceWord,
		keystrokes,
		feelWord: keystrokes.map((keystroke) => keystroke.feel).join(''),
		magicIndexes: mapSourceIndexesToFeel(
			buildTypingPracticeMagicGroupIndexes(sourceWord, profile?.magicKeys, disabledMappingIds),
			keystrokes
		),
		adaptiveIndexes: mapSourceIndexesToFeel(
			buildTypingPracticeAdaptiveGroupIndexes(sourceWord, profile, disabledMappingIds),
			keystrokes
		)
	};
}

export function planFeelWords(
	sourceWords: readonly string[],
	availableKeys: readonly string[],
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[],
	targetToKnown: KeyMap
): FeelWordPlan[] {
	return sourceWords.map((word) =>
		planFeelWord(word, availableKeys, profile, disabledMappingIds, targetToKnown)
	);
}

/** Reconstruct practiced-layout emit history after a correct feel-input prefix. */
export function feelEmitHistory(
	plan: FeelWordPlan | undefined,
	feelInput: string,
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[] = []
): string {
	if (!plan) return '';
	const disabledMappings = new Set(disabledMappingIds);
	const inputCharacters = Array.from(feelInput);
	const limit = feelCorrectPrefixLength(plan, feelInput);
	let history = '';
	for (let index = 0; index < limit; index += 1) {
		const keystroke = plan.keystrokes[index]!;
		const typed = inputCharacters[index]!;
		const targetKey =
			typed === keystroke.feel
				? keystroke.targetKey
				: (Array.from(keystroke.emitted)[0] ?? keystroke.targetKey);
		history = resolveLayoutInput(profile, history, targetKey, disabledMappings).nextHistory;
	}
	return history;
}

/** Target keycaps to highlight for the next planned feel keystroke. */
export function feelNextTargetKeys(
	plan: FeelWordPlan | undefined,
	typedFeelLength: number
): string[] {
	const next = plan?.keystrokes[typedFeelLength];
	return next ? [next.targetKey] : [];
}

/**
 * Input maps that insert the browser's known-layout `event.key` as-is, so typed characters match
 * the remapped feel prompt rather than the practiced layout's output.
 */
export function buildFeelInputKeyMaps(
	targetKeyMaps: LayoutTestKeyMaps,
	knownConfig: KeyboardInputConfig,
	options: KeyboardInputTranslationOptions = {}
): LayoutTestKeyMaps {
	const inputKeyMap: KeyMap = {};

	for (const inputKey of knownConfig.keys) {
		const position = parseKeyboardInputSlot(inputKey.slot);
		if (!position) continue;
		if (position.row >= 3 && options.includeThumbKeys === false) continue;

		const source = keyboardInputEffectiveValue(inputKey);
		if (!source) continue;

		inputKeyMap[source] = source;
		const shiftedSource = shiftedKeyCharacter(source);
		if (shiftedSource) inputKeyMap[shiftedSource] = shiftedSource;
	}

	return { ...targetKeyMaps, inputKeyMap };
}

/**
 * Convert a remapped feel character back to the practiced-layout keycap that sits on the same
 * physical slot, for next-key highlighting on the target keyboard.
 */
export function feelHighlightKeys(
	nextFeelCharacters: readonly string[],
	knownToTarget: KeyMap
): string[] {
	const highlighted: string[] = [];
	const seen = new Set<string>();

	for (const feelCharacter of nextFeelCharacters) {
		const target = knownToTarget[feelCharacter];
		if (!target || seen.has(target)) continue;
		seen.add(target);
		highlighted.push(target);
	}

	return highlighted;
}

/** Whether a feel input change should be discarded when ignoring wrong key presses. */
export function shouldIgnoreFeelWrongKeyPress(
	previousInput: string,
	nextInput: string,
	plan: FeelWordPlan | undefined,
	ignoreWrongKeyPresses: boolean
): boolean {
	if (!ignoreWrongKeyPresses || !plan) return false;
	// Backspace / deletions are blocked along with wrong inserts.
	if (Array.from(nextInput).length < Array.from(previousInput).length) return true;
	return hasFeelInputError(plan, nextInput);
}

export function countFeelInputAttempts(
	previousInput: string,
	nextInput: string,
	plan: FeelWordPlan
): TypingPracticeAttemptCounts {
	const previousCharacters = Array.from(previousInput);
	const nextCharacters = Array.from(nextInput);
	let prefixLength = 0;

	while (
		prefixLength < previousCharacters.length &&
		prefixLength < nextCharacters.length &&
		previousCharacters[prefixLength] === nextCharacters[prefixLength]
	) {
		prefixLength += 1;
	}

	let suffixLength = 0;
	while (
		suffixLength < previousCharacters.length - prefixLength &&
		suffixLength < nextCharacters.length - prefixLength &&
		previousCharacters[previousCharacters.length - 1 - suffixLength] ===
			nextCharacters[nextCharacters.length - 1 - suffixLength]
	) {
		suffixLength += 1;
	}

	const insertedCharacters = nextCharacters.slice(
		prefixLength,
		nextCharacters.length - suffixLength
	);
	return insertedCharacters.reduce<TypingPracticeAttemptCounts>(
		(counts, character, offset) => {
			const keystroke = plan.keystrokes[prefixLength + offset];
			if (keystroke && feelKeystrokeAccepts(keystroke, character)) {
				counts.correct += 1;
			} else {
				counts.incorrect += 1;
			}
			return counts;
		},
		{ correct: 0, incorrect: 0 }
	);
}

export function updateFeelPracticeInput(
	session: TypingPracticeSession,
	input: string,
	plan: FeelWordPlan | undefined
): TypingPracticeSession {
	const updatedSession = { ...session, input };
	if (updatedSession.remainingWords.length === 1 && plan && isFeelWordComplete(plan, input)) {
		return {
			...updatedSession,
			remainingWords: updatedSession.remainingWords.slice(1),
			input: '',
			completedWordCount: updatedSession.completedWordCount + 1
		};
	}
	return updatedSession;
}

export function advanceFeelPracticeWord(
	session: TypingPracticeSession,
	plan: FeelWordPlan | undefined
): TypingPracticeSession {
	if (!plan || !isFeelWordComplete(plan, session.input)) return session;
	return {
		...session,
		remainingWords: session.remainingWords.slice(1),
		input: '',
		completedWordCount: session.completedWordCount + 1
	};
}

function buildFeelCurrentWordFeedback(
	plan: FeelWordPlan,
	input: string
): TypingPracticeCharacterFeedback[] {
	const inputCharacters = Array.from(input);
	return plan.keystrokes.map((keystroke, index) => {
		const inputCharacter = inputCharacters[index];
		if (inputCharacter === undefined) {
			return { character: keystroke.feel, status: 'pending' };
		}
		return {
			character: keystroke.feel,
			status: feelKeystrokeAccepts(keystroke, inputCharacter) ? 'correct' : 'incorrect'
		};
	});
}

/** Prompt feedback that keeps preferred Magic labels while accepting literal alternates as correct. */
export function buildFeelPrompt(
	session: TypingPracticeSession,
	remainingPlans: readonly FeelWordPlan[]
): TypingPracticeWordFeedback[] {
	return session.remainingWords.map((word, index) => {
		const plan = remainingPlans[index];
		return {
			id: word.id,
			word: word.text,
			current: index === 0,
			characters:
				index === 0 && plan
					? buildFeelCurrentWordFeedback(plan, session.input)
					: Array.from(word.text, (character) => ({
							character,
							status: 'pending' as const
						}))
		};
	});
}

/** How many source characters the correct feel-input prefix has produced. */
export function feelSourceCorrectCharacterCount(
	plan: FeelWordPlan | undefined,
	feelInput: string
): number {
	if (!plan) return 0;
	return plan.keystrokes
		.slice(0, feelCorrectPrefixLength(plan, feelInput))
		.reduce((total, keystroke) => total + Array.from(keystroke.emitted).length, 0);
}
