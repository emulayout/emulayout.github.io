<script lang="ts">
	import LayoutKeyboardPreview from '$lib/components/LayoutKeyboardPreview.svelte';
	import LayoutTestArea from '$lib/components/LayoutTestArea.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { DisplayCell } from '$lib/layoutDisplay';
	import type { LayoutInputProfile, LayoutInputResult } from '$lib/layoutInputBehaviors';
	import { buildLayoutKeyboardFeedback } from '$lib/layoutKeyboardFeedback';
	import type { LayoutTestKeyMaps } from '$lib/layoutTestEmulator';
	import {
		advanceTypingPracticeWord,
		buildTypingPracticePrompt,
		createTypingPracticeSession,
		isTypingPracticeWordComplete,
		updateTypingPracticeInput
	} from '$lib/typingPractice';

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		keyMaps: LayoutTestKeyMaps;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		knownMagicTriggers?: readonly string[];
	}

	const {
		layout,
		rows,
		keyMaps,
		inputProfile,
		disabledMappingIds = [],
		knownMagicTriggers = []
	}: Props = $props();

	const practiceWords = [
		'assurance',
		'snapshot',
		'designers',
		'climb',
		'make',
		'gentle',
		'rhythm',
		'bright',
		'window',
		'calm'
	];
	let session = $state(createTypingPracticeSession(practiceWords));
	let inputHistory = $state('');
	const prompt = $derived(buildTypingPracticePrompt(session));
	const keyboardFeedback = $derived(
		buildLayoutKeyboardFeedback({
			magicKeys: inputProfile?.magicKeys,
			adaptiveSwaps: inputProfile?.adaptiveSwaps,
			inputHistory,
			disabledMappingIds,
			knownMagicTriggers
		})
	);

	function handleValueChange(input: string) {
		session = updateTypingPracticeInput(session, input);
	}

	function handleResolvedInput(result: LayoutInputResult): string | undefined {
		if (result.text !== ' ' || !isTypingPracticeWordComplete(session)) return undefined;
		session = advanceTypingPracticeWord(session);
		return session.input;
	}
</script>

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
		<span>Practice complete</span>
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
		value={session.input}
		onValueChange={handleValueChange}
		onResolvedInput={handleResolvedInput}
		onInputHistoryChange={(history) => (inputHistory = history)}
	/>
	<div class="typing-practice-status" aria-label="Typing practice status">
		<span aria-label={`${session.completedWordCount} of ${session.totalWordCount} words complete`}
			>{session.completedWordCount}/{session.totalWordCount}</span
		>
		<span aria-label="Elapsed time: 00:00">00:00</span>
	</div>
</div>

<div class="typing-practice-keyboard">
	<LayoutKeyboardPreview {layout} {rows} feedback={keyboardFeedback} />
</div>

<style>
	.typing-practice-copy {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1em 0.55em;
		min-width: 0;
		color: var(--text-primary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: clamp(1.5rem, 4vw, 3rem);
		font-weight: 600;
		line-height: 1.4;
		letter-spacing: 0.015em;
		overflow-wrap: anywhere;
	}

	.typing-practice-character--correct {
		color: var(--stats-diff-better);
	}

	.typing-practice-character--incorrect {
		color: var(--stats-diff-worse);
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

	.typing-practice-keyboard {
		min-width: 0;
		margin-top: clamp(2.5rem, 8vh, 5rem);
	}
</style>
