<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import type { SegmentedOption } from '$lib/segmentedControl';
	import {
		DEFAULT_TYPING_PRACTICE_WORD_COUNT,
		isDefaultTypingPracticeLessonSettings,
		normalizeTypingPracticeLessonSettings,
		normalizeTypingPracticeText,
		TYPING_PRACTICE_WORD_COUNTS,
		type TypingPracticeLessonSettings,
		type TypingPracticeWordCount
	} from '$lib/typingPracticeText';

	const wordCountOptions: readonly SegmentedOption<`${TypingPracticeWordCount}`>[] =
		TYPING_PRACTICE_WORD_COUNTS.map((count) => ({
			value: String(count) as `${TypingPracticeWordCount}`,
			label: String(count)
		}));

	type LessonSource = 'random-words' | 'custom-text';

	interface Props {
		open: boolean;
		lesson: TypingPracticeLessonSettings;
		/** Prefill for the custom text field, usually the current lesson words. */
		initialText: string;
		/** Whether the layout has Magic or Adaptive mappings to balance toward. */
		specialWordsAvailable: boolean;
		/** Words in the pool that match the currently enabled special keys. */
		specialWordCount: number;
		/** Total words in the random word pool. */
		wordCount: number;
		onClose: () => void;
		onSave: (lesson: TypingPracticeLessonSettings) => void;
	}

	let {
		open,
		lesson,
		initialText,
		specialWordsAvailable,
		specialWordCount,
		wordCount,
		onClose,
		onSave
	}: Props = $props();

	let source = $state<LessonSource>('random-words');
	let text = $state('');
	let specialWordsPercent = $state(0);
	let lessonWordCount = $state<TypingPracticeWordCount>(DEFAULT_TYPING_PRACTICE_WORD_COUNT);
	let textField = $state<HTMLTextAreaElement | undefined>(undefined);
	const normalizedText = $derived(normalizeTypingPracticeText(text));
	const balanceLabel = $derived(
		specialWordsPercent === 0
			? 'Off'
			: specialWordsPercent === 100
				? 'Only'
				: `${specialWordsPercent}%`
	);
	const balanceValueText = $derived(
		specialWordsPercent === 0
			? 'Off'
			: specialWordsPercent === 100
				? 'Only matching words'
				: `${specialWordsPercent}% matching words`
	);
	const saveDisabled = $derived(source === 'custom-text' && !normalizedText);
	const lessonIsDefault = $derived(isDefaultTypingPracticeLessonSettings(lesson));
	const selectedWordCount = $derived(String(lessonWordCount) as `${TypingPracticeWordCount}`);

	$effect(() => {
		if (!open) return;
		source = lesson.customText ? 'custom-text' : 'random-words';
		text = initialText;
		specialWordsPercent = lesson.specialWordsPercent;
		lessonWordCount = lesson.wordCount;
	});

	function focusTextField() {
		requestAnimationFrame(() => {
			textField?.focus();
			textField?.select();
		});
	}

	$effect(() => {
		if (!open || source !== 'custom-text') return;
		focusTextField();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (source === 'custom-text') {
			if (!normalizedText) return;
			onSave(
				normalizeTypingPracticeLessonSettings({
					customText: normalizedText,
					wordCount: lessonWordCount
				})
			);
			return;
		}
		onSave(
			normalizeTypingPracticeLessonSettings({
				customText: null,
				specialWordsPercent: specialWordsAvailable
					? specialWordsPercent
					: lesson.specialWordsPercent,
				wordCount: lessonWordCount
			})
		);
	}

	function reset() {
		onSave(normalizeTypingPracticeLessonSettings(null));
	}

	function setLessonWordCount(value: `${TypingPracticeWordCount}`) {
		lessonWordCount = Number(value) as TypingPracticeWordCount;
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="typing-practice-lesson-title"
	panelClass="max-w-xl"
	initialFocusSelector={lesson.customText ? '.typing-practice-lesson-text-field' : null}
>
	<ModalHeader titleId="typing-practice-lesson-title" title="Practice lesson" {onClose} />

	<form onsubmit={submit}>
		<div class="flex flex-col gap-4 px-5 py-4">
			<fieldset class="typing-practice-lesson-source">
				<legend>Lesson source</legend>
				<label>
					<input
						type="radio"
						name="typing-practice-lesson-source"
						value="random-words"
						bind:group={source}
					/>
					<span>Random words</span>
				</label>
				<label>
					<input
						type="radio"
						name="typing-practice-lesson-source"
						value="custom-text"
						bind:group={source}
					/>
					<span>Custom text</span>
				</label>
			</fieldset>

			{#if source === 'random-words'}
				<div class="typing-practice-lesson-word-count">
					<span class="typing-practice-lesson-label">Word count</span>
					<SegmentedControl
						value={selectedWordCount}
						onChange={setLessonWordCount}
						options={wordCountOptions}
						ariaLabel="Word count"
						class="typing-practice-lesson-word-count-control"
						buttonClass="typing-practice-lesson-word-count-option"
						selectedClass="typing-practice-lesson-word-count-option--selected"
					/>
				</div>
				{#if specialWordsAvailable}
					<div class="typing-practice-lesson-balance">
						<label class="typing-practice-lesson-balance-control">
							<span class="typing-practice-lesson-label">
								Increase magic/adaptive key occurrences
							</span>
							<span class="typing-practice-lesson-balance-row">
								<input
									type="range"
									min="0"
									max="100"
									step="10"
									bind:value={specialWordsPercent}
									aria-valuetext={balanceValueText}
								/>
								<span class="typing-practice-lesson-balance-value" aria-hidden="true">
									{balanceLabel}
								</span>
							</span>
						</label>
						<p class="typing-practice-lesson-hint typing-practice-lesson-description">
							Fills this share of the lesson with words the enabled magic/adaptive keys can help
							type. Disabled mappings don't count; at Only, every word matches.
						</p>
						{#if wordCount > 0}
							{#if specialWordCount === 0 && specialWordsPercent > 0}
								<p class="typing-practice-lesson-hint" role="status">
									No words match the active magic/adaptive keys, so ordinary random words will be
									used.
								</p>
							{:else}
								<p class="typing-practice-lesson-hint">
									{specialWordCount} of {wordCount} words match the active magic/adaptive keys.
								</p>
							{/if}
						{/if}
					</div>
				{:else}
					<p class="typing-practice-lesson-hint">Lessons use random words from the word bank.</p>
				{/if}
			{:else}
				<label class="flex flex-col gap-1.5">
					<span class="typing-practice-lesson-label">Practice text</span>
					<textarea
						bind:this={textField}
						bind:value={text}
						rows="5"
						class="typing-practice-lesson-text-field w-full resize-y rounded-xl px-4 py-3 outline-none transition-all duration-200 focus:ring-2"
						style="
							background-color: var(--input-bg);
							color: var(--text-primary);
							border: 1px solid var(--border);
							--tw-ring-color: var(--accent);
						"></textarea>
				</label>
			{/if}
		</div>

		<div
			class="flex items-center justify-between gap-2 border-t px-5 py-4"
			style="border-color: var(--border);"
		>
			<button
				type="button"
				class="filter-reset-button typing-practice-lesson-button"
				disabled={lessonIsDefault}
				onclick={reset}
			>
				Reset
			</button>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="filter-reset-button typing-practice-lesson-button"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="filter-reset-button typing-practice-lesson-button typing-practice-lesson-button--primary"
					disabled={saveDisabled}
				>
					Save
				</button>
			</div>
		</div>
	</form>
</ModalShell>

<style>
	.typing-practice-lesson-source {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.typing-practice-lesson-source legend {
		margin-bottom: 0.375rem;
		padding: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.typing-practice-lesson-source label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-primary);
		cursor: pointer;
	}

	.typing-practice-lesson-source input[type='radio'] {
		accent-color: var(--accent);
	}

	.typing-practice-lesson-label {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.typing-practice-lesson-word-count {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.typing-practice-lesson-word-count :global(.typing-practice-lesson-word-count-control) {
		display: inline-grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.typing-practice-lesson-word-count :global(.typing-practice-lesson-word-count-option) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3.5rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.2;
		cursor: pointer;
	}

	.typing-practice-lesson-word-count :global(.typing-practice-lesson-word-count-option:hover) {
		color: var(--text-primary);
	}

	.typing-practice-lesson-word-count
		:global(.typing-practice-lesson-word-count-option:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.typing-practice-lesson-word-count :global(.typing-practice-lesson-word-count-option--selected) {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
	}

	.typing-practice-lesson-balance {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.typing-practice-lesson-balance-control {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.typing-practice-lesson-balance-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.typing-practice-lesson-balance-row input[type='range'] {
		flex: 1 1 auto;
		accent-color: var(--accent);
	}

	.typing-practice-lesson-balance-value {
		min-width: 3rem;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.typing-practice-lesson-hint {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.8125rem;
	}

	.typing-practice-lesson-description {
		color: color-mix(in srgb, var(--text-secondary) 65%, transparent);
	}

	.typing-practice-lesson-text-field {
		min-height: 8rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 1rem;
		line-height: 1.5;
	}

	.typing-practice-lesson-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.typing-practice-lesson-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.typing-practice-lesson-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.typing-practice-lesson-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
