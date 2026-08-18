<script lang="ts">
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import KeyboardInputConfigControl from '$lib/components/KeyboardInputConfigControl.svelte';
	import LayoutKeyboardWorkspace from '$lib/components/LayoutKeyboardWorkspace.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import TypingPracticeLessonModal from '$lib/components/TypingPracticeLessonModal.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { DisplayCell } from '$lib/layoutDisplay';
	import { type LayoutInputProfile, type LayoutInputResult } from '$lib/layoutInputBehaviors';
	import {
		buildAdaptiveKeyboardSwapPathsFromFeedback,
		buildLayoutKeyboardFeedback,
		filterAdaptiveKeyboardFeedbackByKeys,
		type LayoutKeyboardPresentation
	} from '$lib/layoutKeyboardFeedback';
	import { type LayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import {
		buildFeelCharMap,
		buildFeelInputKeyMaps,
		buildFeelPrompt,
		advanceFeelPracticeWord,
		countFeelInputAttempts,
		feelEmitHistory,
		feelNextTargetKeys,
		feelCorrectPrefixLength,
		feelCorrectInputPrefix,
		feelSourceCorrectCharacterCount,
		FEEL_SIMULATED_THUMB_MARKER,
		hasFeelInputError,
		isFeelWordComplete,
		planFeelWords,
		shouldIgnoreFeelWrongKeyPress,
		updateFeelPracticeInput,
		withSimulatedThumbFeelMarkers,
		type FeelWordPlan
	} from '$lib/layoutFeel';
	import {
		collectReachableTargetCharacters,
		typingPracticeWordsForReachability,
		unreachableKeysKey,
		unreachableTargetLayoutKeys
	} from '$lib/layoutKeyReachability';
	import type { KeyboardWidthTerms } from '$lib/keyboardInputConfig';
	import { keyboardInputStore } from '$lib/keyboardInputStore.svelte';
	import {
		calculateTypingPracticeResults,
		countTypingPracticeTestCharacters,
		formatTypingPracticeElapsed
	} from '$lib/typingPracticeMetrics';
	import {
		filterTypingPracticeSpecialWords,
		selectTypingPracticeLessonWords
	} from '$lib/typingPracticeSpecialWords';
	import {
		TYPING_PRACTICE_LESSON_WORD_COUNT,
		type SharedTypingPracticeLessonSource
	} from '$lib/typingPracticeLesson';
	import type { SharedTypingPracticeLesson } from '$lib/typingPracticeLesson.svelte';
	import {
		typingPracticeWordsFromText,
		type TypingPracticeLessonSettings
	} from '$lib/typingPracticeText';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import { trackGoatCounterEvent } from '$lib/goatcounter';
	import { onDestroy, untrack, type Snippet } from 'svelte';

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		keyMaps: LayoutTestKeyMaps;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		knownMagicTriggers?: readonly string[];
		practiceLesson?: TypingPracticeLessonSettings;
		onPracticeLessonChange?: (lesson: TypingPracticeLessonSettings) => void;
		sharedLesson: SharedTypingPracticeLesson;
		keyboardHeaderStart?: Snippet;
		keyboard?: Snippet<[LayoutKeyboardPresentation]>;
		keyboardLead?: Snippet;
		keyboardWidthTerms?: KeyboardWidthTerms;
		keyboardAside?: Snippet;
		keyboardBelow?: Snippet;
		keyboardMappings?: Snippet;
		showKeyboardMappings?: boolean;
		onWorkspaceWidthChange?: (width: number | null) => void;
		/** Smaller prompt, field, and stats for the layout-creator Edit workspace. */
		compact?: boolean;
	}

	const {
		layout,
		rows,
		keyMaps,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		knownMagicTriggers = [],
		practiceLesson,
		onPracticeLessonChange,
		sharedLesson,
		keyboardHeaderStart,
		keyboard,
		keyboardLead,
		keyboardWidthTerms,
		keyboardAside,
		keyboardBelow,
		keyboardMappings,
		showKeyboardMappings = false,
		onWorkspaceWidthChange,
		compact = false
	}: Props = $props();

	const customPracticeText = $derived(practiceLesson?.customText ?? null);
	const specialWordsPercent = $derived(practiceLesson?.specialWordsPercent ?? 0);
	const wordPool = $derived(sharedLesson.wordPool);
	const wordPoolStatus = $derived(sharedLesson.wordPoolStatus);
	const showFeelLesson = $derived(Boolean(customPracticeText) || wordPoolStatus === 'ready');
	const sourceLessonWords = $derived(sharedLesson.sourceWords);

	let lessonPlans = $state<FeelWordPlan[]>([]);
	const session = $derived(sharedLesson.toFeelSession(lessonPlans));
	let lessonModalOpen = $state(false);
	const testCharacterCount = $derived(
		countTypingPracticeTestCharacters(lessonPlans.map((plan) => plan.feelWord))
	);
	const correctAttemptCount = $derived(sharedLesson.correctAttemptCount);
	const incorrectAttemptCount = $derived(sharedLesson.incorrectAttemptCount);
	const startedAtMilliseconds = $derived(sharedLesson.startedAtMilliseconds);
	const endedAtMilliseconds = $derived(sharedLesson.endedAtMilliseconds);
	const currentTimeMilliseconds = $derived(sharedLesson.currentTimeMilliseconds);
	let incorrectFlashIndex = $state<number | null>(null);
	let incorrectFlashGeneration = $state(0);
	let incorrectFlashTimeout: ReturnType<typeof setTimeout> | undefined;

	const displayOptions = $derived(uiPrefs.typingPracticeDisplayOptions);
	const hasSpecialKeys = $derived(
		layout.hasMagicKey ||
			layout.hasAdaptiveSwap ||
			layout.hasRepeatKey ||
			Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps || inputProfile?.repeatKey)
	);
	const hasSpecialMappings = $derived(
		Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps)
	);
	const specialCandidateWords = $derived(
		hasSpecialMappings
			? filterTypingPracticeSpecialWords(wordPool, inputProfile, disabledMappingIds)
			: []
	);
	const hasAdaptiveSwapPreview = $derived(Boolean(inputProfile?.adaptiveSwaps));
	const hasMagicGroupPreview = $derived(Boolean(inputProfile?.magicKeys));
	const showSpecialMappings = $derived(hasSpecialMappings && displayOptions.showSpecialKeys);
	const simulateThumbKeys = $derived(layout.hasThumbKeys && displayOptions.simulateThumbKeys);
	const thumbKeys = $derived([
		...layout.thumbKeysByHand.l.map(({ key }) => key),
		...layout.thumbKeysByHand.r.map(({ key }) => key)
	]);
	const reachableTargetCharacters = $derived(
		collectReachableTargetCharacters(keyMaps, layout, keyboardInputStore.config, {
			simulateThumbKeys
		})
	);
	const unreachableKeys = $derived([
		...unreachableTargetLayoutKeys(layout, reachableTargetCharacters)
	]);
	const unreachableKeySet = $derived(new Set(unreachableKeys));
	const unreachableKeysSignature = $derived(unreachableKeysKey(unreachableKeys));
	const feelCharMap = $derived.by(() => {
		const map = buildFeelCharMap(keyMaps, keyboardInputStore.config, layout, {
			includeThumbKeys: !simulateThumbKeys
		});
		return simulateThumbKeys ? withSimulatedThumbFeelMarkers(map, thumbKeys) : map;
	});
	const practiceKeyMaps = $derived(
		buildFeelInputKeyMaps(keyMaps, keyboardInputStore.config, {
			includeThumbKeys: !simulateThumbKeys
		})
	);
	const availableTargetKeys = $derived.by(() => {
		const keys = [...Object.keys(layout.keys)];
		for (const trigger of Object.keys(inputProfile?.magicKeys?.triggers ?? {})) {
			if (!keys.includes(trigger)) keys.push(trigger);
		}
		for (const trigger of knownMagicTriggers) {
			if (!keys.includes(trigger)) keys.push(trigger);
		}
		return keys;
	});
	const remainingPlans = $derived(lessonPlans.slice(session.completedWordCount));
	const activePlan = $derived(remainingPlans[0]);
	const prompt = $derived(buildFeelPrompt(session, remainingPlans));
	const magicGroupIndexes = $derived(
		new Map(
			prompt.map((word, wordIndex) => [
				word.id,
				displayOptions.underlineMagicGroups
					? (remainingPlans[wordIndex]?.magicIndexes ?? new Set<number>())
					: new Set<number>()
			])
		)
	);
	const adaptiveGroupIndexes = $derived(
		new Map(
			prompt.map((word, wordIndex) => [
				word.id,
				displayOptions.underlineAdaptiveGroups
					? (remainingPlans[wordIndex]?.adaptiveIndexes ?? new Set<number>())
					: new Set<number>()
			])
		)
	);
	const inputHasError = $derived(activePlan ? hasFeelInputError(activePlan, session.input) : false);
	const sourceCorrectCharacterCount = $derived(
		feelSourceCorrectCharacterCount(activePlan, session.input)
	);
	const practiceComplete = $derived(
		session.totalWordCount > 0 && session.completedWordCount === session.totalWordCount
	);
	const elapsedMilliseconds = $derived(
		startedAtMilliseconds === null
			? 0
			: Math.max((endedAtMilliseconds ?? currentTimeMilliseconds) - startedAtMilliseconds, 0)
	);
	const elapsedTime = $derived(formatTypingPracticeElapsed(elapsedMilliseconds));
	const results = $derived(
		calculateTypingPracticeResults(
			{ correct: correctAttemptCount, incorrect: incorrectAttemptCount },
			testCharacterCount,
			elapsedMilliseconds
		)
	);
	const correctFeelPrefixLength = $derived(
		activePlan ? feelCorrectPrefixLength(activePlan, session.input) : 0
	);
	const emitHistory = $derived(
		feelEmitHistory(activePlan, session.input, inputProfile, disabledMappingIds)
	);
	const validNextPracticeKeys = $derived(
		inputHasError ? [] : feelNextTargetKeys(activePlan, correctFeelPrefixLength)
	);
	const keyboardFeedback = $derived(
		filterAdaptiveKeyboardFeedbackByKeys(
			buildLayoutKeyboardFeedback({
				magicKeys: displayOptions.showSpecialKeys ? inputProfile?.magicKeys : undefined,
				adaptiveSwaps:
					displayOptions.showSpecialKeys && displayOptions.showAdaptiveSwaps
						? inputProfile?.adaptiveSwaps
						: undefined,
				repeatKey: displayOptions.showSpecialKeys ? inputProfile?.repeatKey : undefined,
				inputHistory: emitHistory,
				disabledMappingIds,
				knownMagicTriggers: displayOptions.showSpecialKeys ? knownMagicTriggers : []
			}),
			displayOptions.onlyRelevantAdaptiveSwaps ? validNextPracticeKeys : undefined
		)
	);
	const keyboardSwapPaths = $derived(
		displayOptions.showSpecialKeys &&
			displayOptions.showAdaptiveSwaps &&
			displayOptions.showSwapPaths
			? buildAdaptiveKeyboardSwapPathsFromFeedback(keyboardFeedback)
			: []
	);
	const nextPracticeKeys = $derived(displayOptions.highlightNextKey ? validNextPracticeKeys : []);
	const activeSourceWord = $derived(sourceLessonWords[session.completedWordCount] ?? '');
	const nextSourceWord = $derived(sourceLessonWords[session.completedWordCount + 1] ?? '');
	const showSourceWordsRow = $derived(sourceLessonWords.length > 0);

	function selectSourceLessonWords(excludedWords: readonly string[] = []) {
		if (customPracticeText) {
			return typingPracticeWordsFromText(customPracticeText);
		}
		return selectTypingPracticeLessonWords({
			words: typingPracticeWordsForReachability(wordPool, unreachableKeySet),
			count: TYPING_PRACTICE_LESSON_WORD_COUNT,
			specialWordsPercent,
			profile: inputProfile,
			disabledMappingIds,
			excludedWords
		});
	}

	function buildLessonPlans(
		sourceWords: readonly string[],
		targetToKnown: typeof feelCharMap = feelCharMap
	): FeelWordPlan[] {
		return planFeelWords(
			sourceWords,
			availableTargetKeys,
			inputProfile,
			disabledMappingIds,
			targetToKnown,
			unreachableKeySet
		);
	}

	$effect(() => {
		return () => {
			if (incorrectFlashTimeout !== undefined) clearTimeout(incorrectFlashTimeout);
		};
	});

	$effect(() => {
		if (startedAtMilliseconds === null || endedAtMilliseconds !== null) return;
		const interval = window.setInterval(() => {
			sharedLesson.currentTimeMilliseconds = Date.now();
		}, 250);
		return () => window.clearInterval(interval);
	});

	function currentLessonSource(customText: string | null): SharedTypingPracticeLessonSource {
		return {
			customText,
			specialWordsPercent,
			specialCandidateSignature: specialCandidateWords.join('\0'),
			unreachableKeysSignature
		};
	}

	function replacePracticeLesson(excludedWords: readonly string[] = []) {
		const sourceWords = selectSourceLessonWords(excludedWords);
		sharedLesson.replaceLesson(
			sourceWords,
			untrack(() => currentLessonSource(customPracticeText))
		);
		lessonPlans = buildLessonPlans(sourceWords);
	}

	function selectAdditionalLessonWords(count: number, excludedWords: readonly string[]) {
		return selectTypingPracticeLessonWords({
			words: typingPracticeWordsForReachability(wordPool, unreachableKeySet),
			count,
			specialWordsPercent,
			profile: inputProfile,
			disabledMappingIds,
			excludedWords
		});
	}

	onDestroy(() => {
		sharedLesson.prepareForTabChange({
			customText: customPracticeText,
			customWords: customPracticeText ? typingPracticeWordsFromText(customPracticeText) : [],
			source: untrack(() => currentLessonSource(customPracticeText)),
			selectAdditionalWords: selectAdditionalLessonWords
		});
	});

	$effect(() => {
		// Lesson-source settings always rebuild the lesson; mapping toggles are
		// handled separately so they cannot reset a lesson mid-typing.
		void specialWordsPercent;

		if (customPracticeText) {
			if (!untrack(() => sharedLesson.matchesLesson(customPracticeText, specialWordsPercent))) {
				replacePracticeLesson();
			}
			return;
		}

		sharedLesson.ensureWordPool(fetch);
		if (wordPool.length > 0) {
			if (!untrack(() => sharedLesson.matchesLesson(null, specialWordsPercent))) {
				replacePracticeLesson();
			}
		}
	});

	$effect.pre(() => {
		// Re-plan when the known→target map or source words change.
		// Once typing starts, keep the current remapping until restart.
		const sources = sourceLessonWords;
		if (sources.length === 0) {
			if (untrack(() => lessonPlans.length) > 0) lessonPlans = [];
			return;
		}
		if (untrack(() => sharedLesson.hasStarted) && untrack(() => lessonPlans.length) > 0) {
			return;
		}
		lessonPlans = buildLessonPlans(sources, feelCharMap);
	});

	$effect(() => {
		// Input-layout / Simulate thumb changes refresh an untouched random lesson so
		// unreachable letters stay out of the word pool. In-progress lessons wait for restart.
		// Key the set by contents so a new layout object (rename) does not reshuffle words.
		if (customPracticeText) return;
		void unreachableKeysSignature;
		if (untrack(() => sharedLesson.hasStarted)) return;
		if (untrack(() => wordPool).length === 0) return;
		if (
			untrack(() =>
				sharedLesson.matchesUntouchedRandomSignatures(
					specialCandidateWords.join('\0'),
					unreachableKeysSignature
				)
			)
		) {
			return;
		}
		replacePracticeLesson(untrack(() => sourceLessonWords));
	});

	$effect(() => {
		// Mapping enable/disable rewrites an untouched lesson only.
		void inputProfile;
		void disabledMappingIds;
		if (untrack(() => sharedLesson.hasStarted)) return;
		const sources = untrack(() => sourceLessonWords);
		if (sources.length === 0) return;
		lessonPlans = buildLessonPlans(sources);
	});

	$effect(() => {
		// While the lesson balances toward special-key words, mapping toggles
		// refresh an untouched lesson so its words match the enabled mappings.
		// Once typing starts, the next restart picks up the change instead.
		if (customPracticeText || specialWordsPercent <= 0) return;
		if (wordPool.length === 0) return;
		const candidateSignature = specialCandidateWords.join('\0');
		if (untrack(() => sharedLesson.hasStarted)) return;
		if (
			untrack(() =>
				sharedLesson.matchesUntouchedRandomSignatures(candidateSignature, unreachableKeysSignature)
			)
		) {
			return;
		}
		replacePracticeLesson();
	});

	function restartPractice(): string {
		replacePracticeLesson(customPracticeText ? [] : sourceLessonWords);
		return sharedLesson.toFeelSession(lessonPlans).input;
	}

	function saveFeelLesson(lesson: TypingPracticeLessonSettings) {
		lessonModalOpen = false;
		onPracticeLessonChange?.(lesson);
	}

	function triggerIncorrectFlash(characterIndex: number) {
		incorrectFlashIndex = null;
		incorrectFlashGeneration += 1;
		const generation = incorrectFlashGeneration;
		if (incorrectFlashTimeout !== undefined) clearTimeout(incorrectFlashTimeout);
		requestAnimationFrame(() => {
			if (generation !== incorrectFlashGeneration) return;
			incorrectFlashIndex = characterIndex;
			incorrectFlashTimeout = setTimeout(() => {
				if (generation === incorrectFlashGeneration) incorrectFlashIndex = null;
			}, 220);
		});
	}

	function markFeelComplete(now: number) {
		sharedLesson.markComplete(now);
		trackGoatCounterEvent('feel-complete');
	}

	function handleValueChange(input: string): string | undefined {
		if (practiceComplete) return session.input;
		const plan = activePlan;
		if (
			plan &&
			shouldIgnoreFeelWrongKeyPress(
				session.input,
				input,
				plan,
				displayOptions.ignoreWrongKeyPresses
			)
		) {
			if (Array.from(input).length > Array.from(session.input).length) {
				const attempts = countFeelInputAttempts(session.input, input, plan);
				if (attempts.incorrect > 0) {
					const now = Date.now();
					triggerIncorrectFlash(feelCorrectPrefixLength(plan, session.input));
					// Discarded wrong inserts still lower accuracy; correct chars in the
					// rejected change were not applied, so only incorrect attempts count.
					sharedLesson.recordAttempts(0, attempts.incorrect, now);
				}
			}
			return session.input;
		}
		const now = Date.now();
		if (plan) {
			const attempts = countFeelInputAttempts(session.input, input, plan);
			if (attempts.incorrect > 0) {
				triggerIncorrectFlash(feelCorrectPrefixLength(plan, session.input));
			}
			sharedLesson.recordAttempts(attempts.correct, attempts.incorrect, now);
		}
		const completedWordCount = session.completedWordCount;
		const nextSession = updateFeelPracticeInput(session, input, plan);
		sharedLesson.applyFeelProgress(nextSession.completedWordCount, plan, nextSession.input);
		if (nextSession.completedWordCount === nextSession.totalWordCount) {
			markFeelComplete(now);
		}
		return nextSession.completedWordCount > completedWordCount ? nextSession.input : undefined;
	}

	function handleResolvedInput(result: LayoutInputResult): string | undefined {
		if (result.text !== ' ' || !activePlan || !isFeelWordComplete(activePlan, session.input)) {
			return undefined;
		}
		const now = Date.now();
		sharedLesson.recordAttempts(1, 0, now);
		const nextSession = advanceFeelPracticeWord(session, activePlan);
		sharedLesson.applyFeelProgress(nextSession.completedWordCount, undefined, '');
		if (nextSession.completedWordCount === nextSession.totalWordCount) {
			markFeelComplete(now);
		}
		return nextSession.input;
	}

	function setIgnoreWrongKeyPresses(checked: boolean) {
		uiPrefs.setTypingPracticeDisplayOption('ignoreWrongKeyPresses', checked);
		if (!checked || !activePlan || !hasFeelInputError(activePlan, session.input)) return;
		const prefix = feelCorrectInputPrefix(activePlan, session.input);
		sharedLesson.applyFeelProgress(session.completedWordCount, activePlan, prefix);
	}

	function resolveFeelInput(_history: string, inputText: string): LayoutInputResult {
		if (
			simulateThumbKeys &&
			inputText === ' ' &&
			activePlan &&
			!isFeelWordComplete(activePlan, session.input)
		) {
			const next = activePlan.keystrokes[Array.from(session.input).length];
			if (
				next &&
				thumbKeys.some(
					(thumb) =>
						thumb === next.targetKey || thumb.toLowerCase() === next.targetKey.toLowerCase()
				)
			) {
				return {
					text: next.feel || (next.targetKey === ' ' ? ' ' : FEEL_SIMULATED_THUMB_MARKER),
					nextHistory: '',
					applied: []
				};
			}
		}
		return { text: inputText, nextHistory: '', applied: [] };
	}
</script>

<div class="layout-feel" class:layout-feel--compact={compact}>
	{#if !showFeelLesson}
		<div class="typing-practice-load-state">
			{#if wordPoolStatus === 'error'}
				<p class="typing-practice-load-status" role="alert">Unable to load layout feel words.</p>
				{#if onPracticeLessonChange}
					<button
						type="button"
						class="typing-practice-load-action"
						onclick={() => (lessonModalOpen = true)}>Use custom text</button
					>
				{/if}
			{:else}
				<p class="typing-practice-load-status" aria-live="polite">Loading...</p>
			{/if}
		</div>
	{:else}
		<div class="layout-feel-prompt-stack">
			{#if showSourceWordsRow}
				<div class="layout-feel-source-words" aria-label="Original words">
					{#if activeSourceWord}
						<span data-source-word={activeSourceWord} data-source-word-role="active">
							{#each Array.from(activeSourceWord) as character, characterIndex (characterIndex)}
								<span
									class:layout-feel-source-character--revealed={characterIndex <
										sourceCorrectCharacterCount}>{character}</span
								>
							{/each}
						</span>
						{#if nextSourceWord}
							<span data-source-word={nextSourceWord} data-source-word-role="next"
								>{nextSourceWord}</span
							>
						{/if}
					{:else}
						<span class="layout-feel-source-words__spacer" aria-hidden="true">&nbsp;</span>
					{/if}
				</div>
			{/if}
			<div class="typing-practice-prompt-row">
				<div class="typing-practice-copy" aria-label="Layout feel words">
					{#if prompt.length > 0}
						{#each prompt as word (word.id)}
							<span
								data-practice-word={word.word}
								data-current-word={word.current ? 'true' : undefined}
							>
								{#each word.characters as character, characterIndex (characterIndex)}
									<span
										class:typing-practice-character--correct={character.status === 'correct'}
										class:typing-practice-character--incorrect={character.status === 'incorrect'}
										class:layout-feel-character--incorrect-flash={word.current &&
											incorrectFlashIndex === characterIndex}
										class:typing-practice-character--magic-group={magicGroupIndexes
											.get(word.id)
											?.has(characterIndex)}
										class:typing-practice-character--adaptive-group={adaptiveGroupIndexes
											.get(word.id)
											?.has(characterIndex)}
										data-magic-group={magicGroupIndexes.get(word.id)?.has(characterIndex)
											? 'true'
											: undefined}
										data-adaptive-group={adaptiveGroupIndexes.get(word.id)?.has(characterIndex)
											? 'true'
											: undefined}
										data-character-status={character.status}>{character.character}</span
									>
								{/each}
							</span>
						{/each}
					{:else}
						<span>Press esc to restart</span>
					{/if}
				</div>
				{#if onPracticeLessonChange}
					<button
						type="button"
						class="typing-practice-lesson-action"
						aria-label="Layout feel lesson settings"
						title="Layout feel lesson settings"
						onclick={() => (lessonModalOpen = true)}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="3" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<div class="typing-practice-input">
			<LayoutTestArea
				keyMaps={practiceKeyMaps}
				variant="practice"
				{compact}
				placeholder=""
				ariaLabel="Layout feel input"
				focusOnMount={!keyboard}
				invalid={inputHasError}
				value={session.input}
				onValueChange={handleValueChange}
				resolveInput={resolveFeelInput}
				onResolvedInput={handleResolvedInput}
				onEscape={restartPractice}
			/>
			<div class="typing-practice-status" aria-label="Layout feel status">
				<span
					class="typing-practice-status__count"
					aria-label={`${session.completedWordCount} of ${session.totalWordCount} words complete`}
					>{session.completedWordCount}/{session.totalWordCount}</span
				>
				{#if !customPracticeText}
					<span class="typing-practice-status__credit">
						Word bank source:<br />
						<a href="https://monkeytype.com/" target="_blank" rel="noopener noreferrer">
							monkeytype <span aria-hidden="true">↗</span>
						</a>
						(english_1k)
					</span>
				{/if}
				<span class="typing-practice-status__time" aria-label={`Elapsed time: ${elapsedTime}`}
					>{elapsedTime}</span
				>
			</div>
			<div
				class="typing-practice-results"
				class:typing-practice-results--hidden={!practiceComplete}
				aria-label={practiceComplete ? 'Layout feel results' : undefined}
				aria-hidden={!practiceComplete}
			>
				<span>Accuracy: {results.accuracyPercent.toFixed(2)}%</span>
				<span>WPM: {results.wordsPerMinute.toFixed(2)}</span>
			</div>
		</div>
	{/if}

	{#if showFeelLesson || keyboard}
		<LayoutKeyboardWorkspace
			{layout}
			{rows}
			feedback={keyboardFeedback}
			swapPaths={keyboardSwapPaths}
			highlightedKeys={nextPracticeKeys}
			{unreachableKeys}
			highlightHomeKeys={displayOptions.colorHomeKeys}
			{inputProfile}
			{disabledMappingIds}
			{onDisabledMappingIdsChange}
			showMappings={showKeyboardMappings || showSpecialMappings}
			{keyboard}
			{keyboardLead}
			{keyboardWidthTerms}
			aside={keyboardAside}
			belowKeyboard={keyboardBelow}
			mappings={keyboardMappings}
			onWidthChange={onWorkspaceWidthChange}
		>
			{#snippet header()}
				<div class="layout-feel-header-lead">
					{#if keyboardHeaderStart}
						{@render keyboardHeaderStart()}
					{/if}
					<KeyboardInputConfigControl />
				</div>
			{/snippet}
			{#snippet options()}
				<ToggleSwitch
					checked={displayOptions.highlightNextKey}
					label="Highlight next key"
					onCheckedChange={(checked) =>
						uiPrefs.setTypingPracticeDisplayOption('highlightNextKey', checked)}
				/>
				<ToggleSwitch
					checked={displayOptions.colorHomeKeys}
					label="Color home keys"
					onCheckedChange={(checked) =>
						uiPrefs.setTypingPracticeDisplayOption('colorHomeKeys', checked)}
				/>
				{#if layout.hasThumbKeys}
					<div class="typing-practice-simulate-thumbs-option" data-simulate-thumb-keys-option>
						<ToggleSwitch
							checked={displayOptions.simulateThumbKeys}
							label="Simulate thumb keys"
							onCheckedChange={(checked) =>
								uiPrefs.setTypingPracticeDisplayOption('simulateThumbKeys', checked)}
						/>
						<Tooltip
							alwaysVisible
							text="When enabled, thumb letters in the remapped prompt become _. Space types that marker for the next thumb keystroke, including Magic or Repeat. Between words, Space is a normal word separator. Configured thumb mappings are ignored."
						/>
					</div>
				{/if}
				{#if hasSpecialKeys}
					<ToggleSwitch
						checked={displayOptions.showSpecialKeys}
						label="Show special keys"
						onCheckedChange={(checked) =>
							uiPrefs.setTypingPracticeDisplayOption('showSpecialKeys', checked)}
					/>
				{/if}
				{#if hasMagicGroupPreview}
					<ToggleSwitch
						checked={displayOptions.underlineMagicGroups}
						label="Underline magic group"
						onCheckedChange={(checked) =>
							uiPrefs.setTypingPracticeDisplayOption('underlineMagicGroups', checked)}
					/>
				{/if}
				{#if hasAdaptiveSwapPreview}
					<ToggleSwitch
						checked={displayOptions.showAdaptiveSwaps}
						label="Show adaptive swaps"
						onCheckedChange={(checked) =>
							uiPrefs.setTypingPracticeDisplayOption('showAdaptiveSwaps', checked)}
					/>
					<ToggleSwitch
						checked={displayOptions.underlineAdaptiveGroups}
						label="Underline adaptive group"
						onCheckedChange={(checked) =>
							uiPrefs.setTypingPracticeDisplayOption('underlineAdaptiveGroups', checked)}
					/>
					{#if displayOptions.showAdaptiveSwaps}
						<ToggleSwitch
							checked={displayOptions.onlyRelevantAdaptiveSwaps}
							label="Only show relevant swaps"
							onCheckedChange={(checked) =>
								uiPrefs.setTypingPracticeDisplayOption('onlyRelevantAdaptiveSwaps', checked)}
						/>
						<ToggleSwitch
							checked={displayOptions.showSwapPaths}
							label="Show swap paths"
							onCheckedChange={(checked) =>
								uiPrefs.setTypingPracticeDisplayOption('showSwapPaths', checked)}
						/>
					{/if}
				{/if}
				<ToggleSwitch
					checked={displayOptions.ignoreWrongKeyPresses}
					label="Ignore wrong key presses"
					onCheckedChange={setIgnoreWrongKeyPresses}
				/>
			{/snippet}
		</LayoutKeyboardWorkspace>
	{/if}
</div>

{#if onPracticeLessonChange}
	<TypingPracticeLessonModal
		open={lessonModalOpen}
		lesson={{ customText: customPracticeText, specialWordsPercent }}
		initialText={sourceLessonWords.join(' ')}
		specialWordsAvailable={hasSpecialMappings}
		specialWordCount={specialCandidateWords.length}
		wordCount={wordPool.length}
		onClose={() => (lessonModalOpen = false)}
		onSave={saveFeelLesson}
	/>
{/if}

<style>
	.layout-feel-header-lead {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
	}

	.typing-practice-simulate-thumbs-option {
		display: flex;
		width: max-content;
		max-width: 100%;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}

	.typing-practice-simulate-thumbs-option :global(.toggle-switch) {
		width: auto;
		flex: 0 1 auto;
	}

	.typing-practice-load-state {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.typing-practice-load-action {
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.45rem 0.7rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font: inherit;
		cursor: pointer;
	}

	.typing-practice-load-action:hover {
		border-color: var(--accent);
	}

	.typing-practice-load-status {
		margin: 0;
		color: var(--text-secondary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 2.5rem;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.015em;
		white-space: nowrap;
	}

	.typing-practice-prompt-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.layout-feel-prompt-stack {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		min-width: 0;
	}

	.layout-feel-source-words {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.55em;
		min-width: 0;
		color: color-mix(in srgb, var(--text-secondary) 72%, transparent);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 2.5rem;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.015em;
		overflow: hidden;
		white-space: nowrap;
	}

	.layout-feel-source-words > [data-source-word] {
		flex: none;
	}

	.layout-feel-source-words > [data-source-word-role='next'] {
		color: color-mix(in srgb, var(--text-secondary) 38%, transparent);
	}

	.layout-feel-source-words__spacer {
		visibility: hidden;
	}

	.layout-feel-source-character--revealed {
		color: var(--text-primary);
	}

	.typing-practice-copy {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.55em;
		width: 100%;
		min-width: 0;
		color: var(--text-primary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 2.5rem;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.015em;
		overflow: hidden;
		white-space: nowrap;
	}

	.typing-practice-copy > [data-practice-word] {
		flex: none;
	}

	.typing-practice-lesson-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex: none;
		margin-left: auto;
		padding: 0;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.typing-practice-lesson-action:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.typing-practice-lesson-action:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.typing-practice-lesson-action svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	.typing-practice-character--correct {
		color: var(--typing-practice-correct);
	}

	.typing-practice-character--incorrect {
		color: var(--typing-practice-incorrect);
	}

	.layout-feel-character--incorrect-flash {
		animation: layout-feel-incorrect-flash 0.22s ease-out;
		color: var(--typing-practice-incorrect);
	}

	@keyframes layout-feel-incorrect-flash {
		0% {
			color: var(--typing-practice-incorrect);
			opacity: 1;
		}
		55% {
			color: var(--typing-practice-incorrect);
			opacity: 0.55;
		}
		100% {
			color: inherit;
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layout-feel-character--incorrect-flash {
			animation: none;
		}
	}

	.typing-practice-character--magic-group,
	.typing-practice-character--adaptive-group {
		text-decoration-line: underline;
		text-decoration-thickness: 0.08em;
		text-underline-offset: 0.12em;
	}

	.typing-practice-character--magic-group {
		text-decoration-color: var(--magic-key);
	}

	.typing-practice-character--adaptive-group {
		text-decoration-color: var(--adaptive-key);
	}

	.typing-practice-input {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: clamp(0.75rem, 2vh, 1.5rem);
		min-width: 0;
	}

	.typing-practice-status {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		padding-inline: clamp(1rem, 8%, 4rem);
		color: var(--text-secondary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: clamp(1.25rem, 3vw, 2rem);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.2;
	}

	.typing-practice-status__count {
		grid-column: 1;
		justify-self: start;
	}

	.typing-practice-status__credit {
		grid-column: 2;
		justify-self: center;
		color: color-mix(in srgb, var(--text-secondary) 60%, transparent);
		font-size: clamp(0.625rem, 1.25vw, 0.75rem);
		font-weight: 500;
		text-align: center;
	}

	.typing-practice-status__credit a {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: inherit;
		text-decoration: none;
	}

	.typing-practice-status__credit a:hover {
		color: var(--text-secondary);
		text-decoration: underline;
	}

	.typing-practice-status__credit a:focus-visible {
		border-radius: 0.2rem;
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 0.15rem;
	}

	.typing-practice-status__time {
		grid-column: 3;
		justify-self: end;
	}

	.typing-practice-results {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-inline: clamp(1rem, 8%, 4rem);
		color: var(--text-primary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: clamp(1.25rem, 3vw, 2rem);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.2;
	}

	.typing-practice-results--hidden {
		visibility: hidden;
	}

	.layout-feel--compact .typing-practice-load-status,
	.layout-feel--compact .layout-feel-source-words,
	.layout-feel--compact .typing-practice-copy {
		font-size: 1.375rem;
	}

	.layout-feel--compact .typing-practice-lesson-action {
		width: 1.75rem;
		height: 1.75rem;
	}

	.layout-feel--compact .typing-practice-lesson-action svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.layout-feel--compact .typing-practice-input {
		gap: 0.4rem;
		margin-top: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.layout-feel--compact .typing-practice-status,
	.layout-feel--compact .typing-practice-results {
		gap: 0.5rem;
		padding-inline: 0.5rem;
		font-size: 0.875rem;
	}

	.layout-feel--compact .typing-practice-status__credit {
		font-size: 0.625rem;
	}
</style>
