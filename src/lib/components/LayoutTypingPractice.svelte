<script lang="ts">
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import KeyboardInputConfigControl from '$lib/components/KeyboardInputConfigControl.svelte';
	import LayoutKeyboardWorkspace from '$lib/components/LayoutKeyboardWorkspace.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import TypingPracticeLessonModal from '$lib/components/TypingPracticeLessonModal.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { DisplayCell } from '$lib/layoutDisplay';
	import {
		resolveLayoutInput,
		type LayoutInputProfile,
		type LayoutInputResult
	} from '$lib/layoutInputBehaviors';
	import {
		buildAdaptiveKeyboardSwapPathsFromFeedback,
		buildLayoutKeyboardFeedback,
		filterAdaptiveKeyboardFeedbackByKeys
	} from '$lib/layoutKeyboardFeedback';
	import { withKeyboardInputConfig, type LayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import {
		collectReachableTargetCharacters,
		typingPracticeWordsForReachability,
		unreachableTargetLayoutKeys
	} from '$lib/layoutKeyReachability';
	import { keyboardInputStore } from '$lib/keyboardInputStore.svelte';
	import {
		calculateTypingPracticeResults,
		countTypingPracticeInputAttempts,
		countTypingPracticeTestCharacters,
		formatTypingPracticeElapsed
	} from '$lib/typingPracticeMetrics';
	import {
		advanceTypingPracticeWord,
		buildTypingPracticePrompt,
		createTypingPracticeSession,
		hasTypingPracticeInputError,
		isTypingPracticeWordComplete,
		updateTypingPracticeInput,
		type TypingPracticeSession
	} from '$lib/typingPractice';
	import {
		resolveNextTypingPracticeKeys,
		resolveSimulatedTypingPracticeThumbInput
	} from '$lib/typingPracticeKeyboard';
	import { buildTypingPracticeMagicGroupIndexes } from '$lib/typingPracticeMagicGroups';
	import {
		filterTypingPracticeSpecialWords,
		selectTypingPracticeLessonWords
	} from '$lib/typingPracticeSpecialWords';
	import {
		typingPracticeWordsFromText,
		type TypingPracticeLessonSettings
	} from '$lib/typingPracticeText';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import { buildTypingPracticeAdaptiveGroupIndexes } from '$lib/typingPracticeAdaptiveGroups';
	import { ENGLISH_1K_WORD_POOL_URL, loadTypingPracticeWords } from '$lib/typingPracticeWords';
	import { trackGoatCounterEvent } from '$lib/goatcounter';
	import { untrack, type Snippet } from 'svelte';

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
		keyboardHeaderEnd?: Snippet;
		keyboard?: Snippet;
		/** Sits beside the keyboard in the same centered cluster as mappings. */
		keyboardAside?: Snippet;
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
		keyboardHeaderEnd,
		keyboard,
		keyboardAside
	}: Props = $props();

	const PRACTICE_WORD_COUNT = 10;
	type WordPoolStatus = 'loading' | 'ready' | 'error';
	let wordPool = $state<string[]>([]);
	let wordPoolStatus = $state<WordPoolStatus>('loading');

	const customPracticeText = $derived(practiceLesson?.customText ?? null);
	const specialWordsPercent = $derived(practiceLesson?.specialWordsPercent ?? 0);
	const displayOptions = $derived(uiPrefs.typingPracticeDisplayOptions);
	const simulateThumbKeys = $derived(layout.hasThumbKeys && displayOptions.simulateThumbKeys);
	const reachableTargetCharacters = $derived(
		collectReachableTargetCharacters(keyMaps, layout, keyboardInputStore.config, {
			simulateThumbKeys
		})
	);
	const unreachableKeys = $derived([
		...unreachableTargetLayoutKeys(layout, reachableTargetCharacters)
	]);
	const unreachableKeySet = $derived(new Set(unreachableKeys));

	function createPracticeSession(excludedWords: readonly string[] = []) {
		if (customPracticeText) {
			return createTypingPracticeSession(typingPracticeWordsFromText(customPracticeText));
		}
		return createTypingPracticeSession(
			selectTypingPracticeLessonWords({
				words: typingPracticeWordsForReachability(wordPool, unreachableKeySet),
				count: PRACTICE_WORD_COUNT,
				specialWordsPercent,
				profile: inputProfile,
				disabledMappingIds,
				excludedWords
			})
		);
	}

	let session = $state<TypingPracticeSession>(createPracticeSession());
	let lessonWords = $state<string[]>([]);
	let lessonModalOpen = $state(false);
	let testCharacterCount = $state(0);
	let inputHistory = $state('');
	let correctAttemptCount = $state(0);
	let incorrectAttemptCount = $state(0);
	let startedAtMilliseconds = $state<number | null>(null);
	let endedAtMilliseconds = $state<number | null>(null);
	let currentTimeMilliseconds = $state(0);

	const hasSpecialKeys = $derived(
		layout.hasMagicKey ||
			layout.hasAdaptiveSwap ||
			Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps)
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
	const practiceKeyMaps = $derived(
		withKeyboardInputConfig(keyMaps, layout, keyboardInputStore.config, {
			includeThumbKeys: !simulateThumbKeys
		})
	);
	const thumbKeys = $derived([
		...layout.thumbKeysByHand.l.map(({ key }) => key),
		...layout.thumbKeysByHand.r.map(({ key }) => key)
	]);
	const prompt = $derived(buildTypingPracticePrompt(session));
	const magicGroupIndexes = $derived(
		new Map(
			prompt.map((word) => [
				word.id,
				displayOptions.underlineMagicGroups
					? buildTypingPracticeMagicGroupIndexes(
							word.word,
							inputProfile?.magicKeys,
							disabledMappingIds
						)
					: new Set<number>()
			])
		)
	);
	const adaptiveGroupIndexes = $derived(
		new Map(
			prompt.map((word) => [
				word.id,
				displayOptions.underlineAdaptiveGroups
					? buildTypingPracticeAdaptiveGroupIndexes(word.word, inputProfile, disabledMappingIds)
					: new Set<number>()
			])
		)
	);
	const inputHasError = $derived(hasTypingPracticeInputError(session));
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
	const validNextPracticeKeys = $derived(
		resolveNextTypingPracticeKeys(
			session,
			Object.keys(layout.keys),
			inputProfile,
			inputHistory,
			disabledMappingIds
		)
	);
	const keyboardFeedback = $derived(
		filterAdaptiveKeyboardFeedbackByKeys(
			buildLayoutKeyboardFeedback({
				magicKeys: displayOptions.showSpecialKeys ? inputProfile?.magicKeys : undefined,
				adaptiveSwaps:
					displayOptions.showSpecialKeys && displayOptions.showAdaptiveSwaps
						? inputProfile?.adaptiveSwaps
						: undefined,
				inputHistory,
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

	$effect(() => {
		if (startedAtMilliseconds === null || endedAtMilliseconds !== null) return;
		const interval = window.setInterval(() => {
			currentTimeMilliseconds = Date.now();
		}, 250);
		return () => window.clearInterval(interval);
	});

	$effect(() => {
		// Lesson-source settings always rebuild the lesson; mapping toggles are
		// handled separately so they cannot reset a lesson mid-typing.
		void specialWordsPercent;

		if (customPracticeText) {
			wordPoolStatus = 'ready';
			setPracticeSession(untrack(() => createPracticeSession()));
			return;
		}

		if (wordPool.length > 0) {
			wordPoolStatus = 'ready';
			setPracticeSession(untrack(() => createPracticeSession()));
			return;
		}

		wordPoolStatus = 'loading';
		const controller = new AbortController();
		void loadTypingPracticeWords(fetch, ENGLISH_1K_WORD_POOL_URL, controller.signal)
			.then((words) => {
				if (controller.signal.aborted) return;
				wordPool = words;
			})
			.catch(() => {
				if (!controller.signal.aborted) wordPoolStatus = 'error';
			});
		return () => controller.abort();
	});

	$effect(() => {
		// While the lesson balances toward special-key words, mapping toggles
		// refresh an untouched lesson so its words match the enabled mappings.
		// Once typing starts, the next restart picks up the change instead.
		if (customPracticeText || specialWordsPercent <= 0) return;
		void specialCandidateWords;
		if (untrack(() => startedAtMilliseconds) !== null) return;
		setPracticeSession(untrack(() => createPracticeSession()));
	});

	$effect(() => {
		// Input-layout / Simulate thumb changes refresh an untouched random lesson so
		// unreachable letters stay out of the word pool. In-progress lessons wait for restart.
		if (customPracticeText) return;
		void unreachableKeySet;
		if (untrack(() => startedAtMilliseconds) !== null) return;
		if (untrack(() => wordPool).length === 0) return;
		setPracticeSession(untrack(() => createPracticeSession()));
	});

	function recordAttempts(correct: number, incorrect: number, now: number) {
		if (correct + incorrect === 0) return;
		if (startedAtMilliseconds === null) {
			startedAtMilliseconds = now;
			currentTimeMilliseconds = now;
		}
		correctAttemptCount += correct;
		incorrectAttemptCount += incorrect;
	}

	function setPracticeSession(nextSession: TypingPracticeSession) {
		const nextLessonWords = nextSession.remainingWords.map(({ text }) => text);
		session = nextSession;
		lessonWords = nextLessonWords;
		testCharacterCount = countTypingPracticeTestCharacters(nextLessonWords);
		correctAttemptCount = 0;
		incorrectAttemptCount = 0;
		startedAtMilliseconds = null;
		endedAtMilliseconds = null;
		currentTimeMilliseconds = 0;
		inputHistory = '';
	}

	function restartPractice(): string {
		setPracticeSession(createPracticeSession(customPracticeText ? [] : lessonWords));
		return session.input;
	}

	function savePracticeLesson(lesson: TypingPracticeLessonSettings) {
		lessonModalOpen = false;
		onPracticeLessonChange?.(lesson);
	}

	function markPracticeComplete(now: number) {
		endedAtMilliseconds = now;
		currentTimeMilliseconds = now;
		trackGoatCounterEvent('practice-complete');
	}

	function handleValueChange(input: string): string | undefined {
		if (practiceComplete) return session.input;
		const activeWord = session.remainingWords[0];
		const now = Date.now();
		if (activeWord) {
			const attempts = countTypingPracticeInputAttempts(session.input, input, activeWord.text);
			recordAttempts(attempts.correct, attempts.incorrect, now);
		}
		const completedWordCount = session.completedWordCount;
		session = updateTypingPracticeInput(session, input);
		if (session.completedWordCount === session.totalWordCount) {
			markPracticeComplete(now);
		}
		return session.completedWordCount > completedWordCount ? session.input : undefined;
	}

	function handleResolvedInput(result: LayoutInputResult): string | undefined {
		if (result.text !== ' ' || !isTypingPracticeWordComplete(session)) return undefined;
		const now = Date.now();
		recordAttempts(1, 0, now);
		session = advanceTypingPracticeWord(session);
		if (session.completedWordCount === session.totalWordCount) {
			markPracticeComplete(now);
		}
		return session.input;
	}

	function resolvePracticeInput(history: string, inputText: string): LayoutInputResult {
		if (inputText === ' ') {
			const simulatedThumb = resolveSimulatedTypingPracticeThumbInput(
				session,
				thumbKeys,
				inputProfile,
				history,
				disabledMappingIds
			);
			if (simulatedThumb) return simulatedThumb;
		}
		return resolveLayoutInput(inputProfile, history, inputText, new Set(disabledMappingIds));
	}
</script>

{#if wordPoolStatus === 'loading' && !customPracticeText}
	<p class="typing-practice-load-status" aria-live="polite">Loading...</p>
{:else if wordPoolStatus === 'error'}
	<p class="typing-practice-load-status" role="alert">Unable to load practice words.</p>
{:else}
	<div class="typing-practice-prompt-row">
		<div class="typing-practice-copy" aria-label="Practice words">
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
				aria-label="Practice lesson settings"
				title="Practice lesson settings"
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

	<div class="typing-practice-input">
		<LayoutTestArea
			keyMaps={practiceKeyMaps}
			{inputProfile}
			{disabledMappingIds}
			variant="practice"
			placeholder=""
			ariaLabel="Typing practice input"
			focusOnMount
			invalid={inputHasError}
			value={session.input}
			onValueChange={handleValueChange}
			resolveInput={simulateThumbKeys ? resolvePracticeInput : undefined}
			onResolvedInput={handleResolvedInput}
			onInputHistoryChange={(history) => (inputHistory = history)}
			onEscape={restartPractice}
		/>
		<div class="typing-practice-status" aria-label="Typing practice status">
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
			aria-label={practiceComplete ? 'Typing practice results' : undefined}
			aria-hidden={!practiceComplete}
		>
			<span>Accuracy: {results.accuracyPercent.toFixed(2)}%</span>
			<span>WPM: {results.wordsPerMinute.toFixed(2)}</span>
		</div>
	</div>

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
		showMappings={showSpecialMappings}
		{keyboard}
		aside={keyboardAside}
	>
		{#snippet header()}
			<KeyboardInputConfigControl />
			{#if keyboardHeaderEnd}
				{@render keyboardHeaderEnd()}
			{/if}
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
						text="When enabled, Space simulates whichever thumb key produces the next required character, including Magic or Repeat. Between words, it types a normal space. Configured thumb mappings are ignored."
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
		{/snippet}
	</LayoutKeyboardWorkspace>
{/if}

{#if onPracticeLessonChange}
	<TypingPracticeLessonModal
		open={lessonModalOpen}
		lesson={{ customText: customPracticeText, specialWordsPercent }}
		initialText={lessonWords.join(' ')}
		specialWordsAvailable={hasSpecialMappings}
		specialWordCount={specialCandidateWords.length}
		wordCount={wordPool.length}
		onClose={() => (lessonModalOpen = false)}
		onSave={savePracticeLesson}
	/>
{/if}

<style>
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

	.typing-practice-copy {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.55em;
		width: 100%;
		min-width: 0;
		flex: 1 1 auto;
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

	.typing-practice-character--magic-group,
	.typing-practice-character--adaptive-group {
		text-decoration-line: underline;
		text-decoration-thickness: 0.08em;
		text-underline-offset: 0.12em;
	}

	.typing-practice-character--magic-group {
		text-decoration-color: var(--magic-key);
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
</style>
