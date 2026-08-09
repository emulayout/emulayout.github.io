<script lang="ts">
	import LayoutKeyboardPreview from '$lib/components/LayoutKeyboardPreview.svelte';
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import InputMappingsPanel from '$lib/components/InputMappingsPanel.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { DisplayCell } from '$lib/layoutDisplay';
	import type { LayoutInputProfile, LayoutInputResult } from '$lib/layoutInputBehaviors';
	import {
		buildAdaptiveKeyboardSwapPaths,
		buildLayoutKeyboardFeedback
	} from '$lib/layoutKeyboardFeedback';
	import type { LayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import {
		calculateTypingPracticeResults,
		countTypingPracticeInputAttempts,
		countTypingPracticeTestCharacters,
		formatTypingPracticeElapsed
	} from '$lib/typingPracticeMetrics';
	import {
		advanceTypingPracticeWord,
		buildTypingPracticePrompt,
		createRandomTypingPracticeSession,
		createTypingPracticeSession,
		hasTypingPracticeInputError,
		isTypingPracticeWordComplete,
		updateTypingPracticeInput
	} from '$lib/typingPractice';
	import { resolveNextTypingPracticeKeys } from '$lib/typingPracticeKeyboard';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import { ENGLISH_1K_WORD_POOL_URL, loadTypingPracticeWords } from '$lib/typingPracticeWords';

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		keyMaps: LayoutTestKeyMaps;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		knownMagicTriggers?: readonly string[];
	}

	const {
		layout,
		rows,
		keyMaps,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		knownMagicTriggers = []
	}: Props = $props();

	const PRACTICE_WORD_COUNT = 10;
	type WordPoolStatus = 'loading' | 'ready' | 'error';
	let wordPool = $state<string[]>([]);
	let wordPoolStatus = $state<WordPoolStatus>('loading');

	function createPracticeSession(excludedWords: readonly string[] = []) {
		const excluded = new Set(excludedWords);
		return createRandomTypingPracticeSession(
			wordPool.filter((word) => !excluded.has(word)),
			PRACTICE_WORD_COUNT
		);
	}

	let session = $state(createTypingPracticeSession([]));
	let lessonWords = $state<string[]>([]);
	let testCharacterCount = $state(0);
	let inputHistory = $state('');
	let correctAttemptCount = $state(0);
	let incorrectAttemptCount = $state(0);
	let startedAtMilliseconds = $state<number | null>(null);
	let endedAtMilliseconds = $state<number | null>(null);
	let currentTimeMilliseconds = $state(0);
	const displayOptions = $derived(uiPrefs.typingPracticeDisplayOptions);
	const hasSpecialKeys = $derived(
		layout.hasMagicKey ||
			layout.hasAdaptiveSwap ||
			Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps)
	);
	const hasSpecialMappings = $derived(
		Boolean(inputProfile?.magicKeys || inputProfile?.adaptiveSwaps)
	);
	const hasAdaptiveSwapPreview = $derived(Boolean(inputProfile?.adaptiveSwaps));
	const showSpecialMappings = $derived(hasSpecialMappings && displayOptions.showSpecialKeys);
	const prompt = $derived(buildTypingPracticePrompt(session));
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
	const keyboardFeedback = $derived(
		buildLayoutKeyboardFeedback({
			magicKeys: displayOptions.showSpecialKeys ? inputProfile?.magicKeys : undefined,
			adaptiveSwaps:
				displayOptions.showSpecialKeys && displayOptions.showAdaptiveSwaps
					? inputProfile?.adaptiveSwaps
					: undefined,
			inputHistory,
			disabledMappingIds,
			knownMagicTriggers: displayOptions.showSpecialKeys ? knownMagicTriggers : []
		})
	);
	const keyboardSwapPaths = $derived(
		displayOptions.showSpecialKeys &&
			displayOptions.showAdaptiveSwaps &&
			displayOptions.showSwapPaths
			? buildAdaptiveKeyboardSwapPaths(
					inputProfile?.adaptiveSwaps,
					inputHistory,
					disabledMappingIds
				)
			: []
	);
	const nextPracticeKeys = $derived(
		displayOptions.highlightNextKey
			? resolveNextTypingPracticeKeys(
					session,
					Object.keys(layout.keys),
					inputProfile,
					inputHistory,
					disabledMappingIds
				)
			: []
	);

	$effect(() => {
		if (startedAtMilliseconds === null || endedAtMilliseconds !== null) return;
		const interval = window.setInterval(() => {
			currentTimeMilliseconds = Date.now();
		}, 250);
		return () => window.clearInterval(interval);
	});

	$effect(() => {
		const controller = new AbortController();
		void loadTypingPracticeWords(fetch, ENGLISH_1K_WORD_POOL_URL, controller.signal)
			.then((words) => {
				if (controller.signal.aborted) return;
				wordPool = words;
				setPracticeSession(createPracticeSession());
				wordPoolStatus = 'ready';
			})
			.catch(() => {
				if (!controller.signal.aborted) wordPoolStatus = 'error';
			});
		return () => controller.abort();
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

	function setPracticeSession(nextSession: ReturnType<typeof createPracticeSession>) {
		session = nextSession;
		lessonWords = nextSession.remainingWords.map(({ text }) => text);
		testCharacterCount = countTypingPracticeTestCharacters(lessonWords);
		correctAttemptCount = 0;
		incorrectAttemptCount = 0;
		startedAtMilliseconds = null;
		endedAtMilliseconds = null;
		currentTimeMilliseconds = 0;
		inputHistory = '';
	}

	function restartPractice(): string {
		setPracticeSession(createPracticeSession(lessonWords));
		return session.input;
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
			endedAtMilliseconds = now;
			currentTimeMilliseconds = now;
		}
		return session.completedWordCount > completedWordCount ? session.input : undefined;
	}

	function handleResolvedInput(result: LayoutInputResult): string | undefined {
		if (result.text !== ' ' || !isTypingPracticeWordComplete(session)) return undefined;
		const now = Date.now();
		recordAttempts(1, 0, now);
		session = advanceTypingPracticeWord(session);
		if (session.completedWordCount === session.totalWordCount) {
			endedAtMilliseconds = now;
			currentTimeMilliseconds = now;
		}
		return session.input;
	}
</script>

{#if wordPoolStatus === 'loading'}
	<p class="typing-practice-load-status" aria-live="polite">Loading...</p>
{:else if wordPoolStatus === 'error'}
	<p class="typing-practice-load-status" role="alert">Unable to load practice words.</p>
{:else}
	<div class="typing-practice-copy" aria-label="Practice words">
		{#if prompt.length > 0}
			{#each prompt as word (word.id)}
				<span data-practice-word={word.word} data-current-word={word.current ? 'true' : undefined}>
					{#each word.characters as character, characterIndex (characterIndex)}
						<span
							class:typing-practice-character--correct={character.status === 'correct'}
							class:typing-practice-character--incorrect={character.status === 'incorrect'}
							data-character-status={character.status}>{character.character}</span
						>
					{/each}
				</span>
			{/each}
		{:else}
			<span>Press esc to restart</span>
		{/if}
	</div>

	<div class="typing-practice-input">
		<LayoutTestArea
			{layout}
			{keyMaps}
			{inputProfile}
			{disabledMappingIds}
			variant="practice"
			placeholder=""
			ariaLabel="Typing practice input"
			focusOnMount
			invalid={inputHasError}
			value={session.input}
			onValueChange={handleValueChange}
			onResolvedInput={handleResolvedInput}
			onInputHistoryChange={(history) => (inputHistory = history)}
			onEscape={restartPractice}
		/>
		<div class="typing-practice-status" aria-label="Typing practice status">
			<span aria-label={`${session.completedWordCount} of ${session.totalWordCount} words complete`}
				>{session.completedWordCount}/{session.totalWordCount}</span
			>
			<span aria-label={`Elapsed time: ${elapsedTime}`}>{elapsedTime}</span>
		</div>
		{#if practiceComplete}
			<div class="typing-practice-results" aria-label="Typing practice results">
				<span>Accuracy: {results.accuracyPercent.toFixed(2)}%</span>
				<span>WPM: {results.wordsPerMinute.toFixed(2)}</span>
			</div>
		{/if}
	</div>

	<div
		class="typing-practice-keyboard-layout"
		class:typing-practice-keyboard-layout--with-mappings={showSpecialMappings}
	>
		<div class="typing-practice-keyboard-main">
			<LayoutKeyboardPreview
				{layout}
				{rows}
				feedback={keyboardFeedback}
				swapPaths={keyboardSwapPaths}
				highlightedKeys={nextPracticeKeys}
				highlightHomeKeys={displayOptions.colorHomeKeys}
				horizontalAlignment="start"
			/>
			<div class="typing-practice-keyboard-options" role="group" aria-label="Keyboard options">
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
				{#if hasSpecialKeys}
					<ToggleSwitch
						checked={displayOptions.showSpecialKeys}
						label="Show special keys"
						onCheckedChange={(checked) =>
							uiPrefs.setTypingPracticeDisplayOption('showSpecialKeys', checked)}
					/>
				{/if}
				{#if hasAdaptiveSwapPreview}
					<ToggleSwitch
						checked={displayOptions.showAdaptiveSwaps}
						label="Show Adaptive swaps"
						onCheckedChange={(checked) =>
							uiPrefs.setTypingPracticeDisplayOption('showAdaptiveSwaps', checked)}
					/>
					{#if displayOptions.showAdaptiveSwaps}
						<ToggleSwitch
							checked={displayOptions.showSwapPaths}
							label="Show swap paths"
							onCheckedChange={(checked) =>
								uiPrefs.setTypingPracticeDisplayOption('showSwapPaths', checked)}
						/>
					{/if}
				{/if}
			</div>
		</div>
		{#if showSpecialMappings && inputProfile}
			<div class="typing-practice-mappings">
				<InputMappingsPanel
					profile={inputProfile}
					{disabledMappingIds}
					{onDisabledMappingIdsChange}
				/>
			</div>
		{/if}
	</div>
{/if}

<style>
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

	.typing-practice-character--correct {
		color: var(--typing-practice-correct);
	}

	.typing-practice-character--incorrect {
		color: var(--typing-practice-incorrect);
	}

	.typing-practice-input {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: clamp(0.75rem, 2vh, 1.5rem);
		min-width: 0;
	}

	.typing-practice-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	.typing-practice-keyboard-layout {
		display: block;
		gap: clamp(0.75rem, 2vw, 1.5rem);
		min-width: 0;
		margin-top: clamp(2.5rem, 8vh, 5rem);
	}

	.typing-practice-keyboard-main,
	.typing-practice-mappings {
		min-width: 0;
	}

	.typing-practice-mappings {
		width: 100%;
		max-width: 19.6875rem;
		margin-top: 1.25rem;
	}

	.typing-practice-keyboard-options {
		display: flex;
		min-width: 0;
		flex-flow: row wrap;
		justify-content: flex-start;
		gap: 0.625rem 1rem;
		margin-top: 0.75rem;
	}

	@media (min-width: 48rem) {
		.typing-practice-keyboard-layout--with-mappings {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 19.6875rem);
			align-items: start;
		}

		.typing-practice-keyboard-layout--with-mappings .typing-practice-mappings {
			margin-top: 0;
		}
	}
</style>
