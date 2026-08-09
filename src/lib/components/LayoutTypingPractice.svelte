<script lang="ts">
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import KeyboardInputConfigControl from '$lib/components/KeyboardInputConfigControl.svelte';
	import LayoutKeyboardWorkspace from '$lib/components/LayoutKeyboardWorkspace.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import TypingPracticeTextModal from '$lib/components/TypingPracticeTextModal.svelte';
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
		createRandomTypingPracticeSession,
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
	import { typingPracticeWordsFromText } from '$lib/typingPracticeText';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import { buildTypingPracticeAdaptiveGroupIndexes } from '$lib/typingPracticeAdaptiveGroups';
	import { ENGLISH_1K_WORD_POOL_URL, loadTypingPracticeWords } from '$lib/typingPracticeWords';

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		keyMaps: LayoutTestKeyMaps;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		knownMagicTriggers?: readonly string[];
		customPracticeText?: string | null;
		onCustomPracticeTextChange?: (text: string | null) => void;
	}

	const {
		layout,
		rows,
		keyMaps,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		knownMagicTriggers = [],
		customPracticeText = null,
		onCustomPracticeTextChange
	}: Props = $props();

	const PRACTICE_WORD_COUNT = 10;
	type WordPoolStatus = 'loading' | 'ready' | 'error';
	let wordPool = $state<string[]>([]);
	let wordPoolStatus = $state<WordPoolStatus>('loading');

	function createPracticeSession(excludedWords: readonly string[] = []) {
		if (customPracticeText) {
			return createTypingPracticeSession(typingPracticeWordsFromText(customPracticeText));
		}
		const excluded = new Set(excludedWords);
		return createRandomTypingPracticeSession(
			wordPool.filter((word) => !excluded.has(word)),
			PRACTICE_WORD_COUNT
		);
	}

	let session = $state<TypingPracticeSession>(createPracticeSession());
	let lessonWords = $state<string[]>([]);
	let textModalOpen = $state(false);
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
	const hasMagicGroupPreview = $derived(Boolean(inputProfile?.magicKeys));
	const showSpecialMappings = $derived(hasSpecialMappings && displayOptions.showSpecialKeys);
	const simulateThumbKeys = $derived(layout.hasThumbKeys && displayOptions.simulateThumbKeys);
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
		if (customPracticeText) {
			wordPoolStatus = 'ready';
			setPracticeSession(createPracticeSession());
			return;
		}

		if (wordPool.length > 0) {
			wordPoolStatus = 'ready';
			setPracticeSession(createPracticeSession());
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

	function saveCustomPracticeText(text: string) {
		textModalOpen = false;
		onCustomPracticeTextChange?.(text);
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
		{#if onCustomPracticeTextChange}
			{#if customPracticeText}
				<button
					type="button"
					class="typing-practice-text-action"
					aria-label="Clear custom practice text"
					title="Clear custom practice text"
					onclick={() => onCustomPracticeTextChange(null)}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			{:else}
				<button
					type="button"
					class="typing-practice-text-action"
					aria-label="Edit practice text"
					title="Edit practice text"
					onclick={() => (textModalOpen = true)}
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
						<path d="M12 20h9" />
						<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
					</svg>
				</button>
			{/if}
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
			<span aria-label={`${session.completedWordCount} of ${session.totalWordCount} words complete`}
				>{session.completedWordCount}/{session.totalWordCount}</span
			>
			<span aria-label={`Elapsed time: ${elapsedTime}`}>{elapsedTime}</span>
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
		highlightHomeKeys={displayOptions.colorHomeKeys}
		{inputProfile}
		{disabledMappingIds}
		{onDisabledMappingIdsChange}
		showMappings={showSpecialMappings}
	>
		{#snippet header()}
			<KeyboardInputConfigControl />
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

{#if onCustomPracticeTextChange}
	<TypingPracticeTextModal
		open={textModalOpen}
		initialText={lessonWords.join(' ')}
		onClose={() => (textModalOpen = false)}
		onSave={saveCustomPracticeText}
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

	.typing-practice-text-action {
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

	.typing-practice-text-action:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.typing-practice-text-action:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.typing-practice-text-action svg {
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

	.typing-practice-results--hidden {
		visibility: hidden;
	}
</style>
