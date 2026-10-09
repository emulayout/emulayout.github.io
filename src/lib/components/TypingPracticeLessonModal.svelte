<script lang="ts">
	import { untrack } from 'svelte';
	import {
		defaultRemappingPreferences,
		REMAPPING_TYPES,
		type RemappingType
	} from '$lib/typingPracticeRemappingPreferences';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import type { TabOption } from '$lib/tabs';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import type { SegmentedOption } from '$lib/segmentedControl';
	import {
		DEFAULT_TYPING_PRACTICE_TEST_STYLE,
		type TypingPracticeTestStyle
	} from '$lib/typingPracticePrefs';
	import {
		DEFAULT_TYPING_PRACTICE_WORD_COUNT,
		isDefaultTypingPracticeLessonSettings,
		normalizeTypingPracticeLessonSettings,
		normalizeTypingPracticeText,
		TYPING_PRACTICE_WORD_COUNTS,
		type TypingPracticeLessonSettings,
		type TypingPracticeWordBank,
		type TypingPracticeWordCount
	} from '$lib/typingPracticeText';

	const wordCountOptions: readonly SegmentedOption<`${TypingPracticeWordCount}`>[] =
		TYPING_PRACTICE_WORD_COUNTS.map((count) => ({
			value: String(count) as `${TypingPracticeWordCount}`,
			label: String(count)
		}));
	const testStyleOptions: readonly SegmentedOption<TypingPracticeTestStyle>[] = [
		{ value: 'monkeytype', label: 'Monkeytype' },
		{ value: 'colemak-club', label: 'Colemak Club' }
	];

	type LessonTab = 'source' | 'remappings' | 'style';
	let activeTab = $state<LessonTab>('source');

	type LessonSource = 'random-words' | 'custom-text';

	interface Props {
		open: boolean;
		focusWordBank?: boolean;
		lesson: TypingPracticeLessonSettings;
		/** Prefill for the custom text field, usually the current lesson words. */
		initialText: string;
		/** Whether the layout has Magic or Adaptive mappings to balance toward. */
		specialWordsAvailable: boolean;
		/** Words in the pool that match the currently enabled special keys. */
		specialWordCount: number;
		remappingCounts?: Record<RemappingType, number>;
		/** Total words in the random word pool. */
		wordCount: number;
		/** Typing-practice-only display option. Omit for Layout feel. */
		testStyle?: TypingPracticeTestStyle;
		onTestStyleChange?: (value: TypingPracticeTestStyle) => void;
		onClose: () => void;
		onSave: (lesson: TypingPracticeLessonSettings) => void;
	}

	let {
		open,
		focusWordBank = false,
		lesson,
		initialText,
		specialWordsAvailable,
		specialWordCount,
		remappingCounts = { magic: 0, adaptive: 0, chiral: 0 },
		wordCount,
		testStyle = DEFAULT_TYPING_PRACTICE_TEST_STYLE,
		onTestStyleChange,
		onClose,
		onSave
	}: Props = $props();

	let wordBank = $state<TypingPracticeWordBank>('english1k');
	let source = $state<LessonSource>('random-words');
	let text = $state('');
	let specialWordsPercent = $state(0);
	let remappingPreferences = $state(defaultRemappingPreferences());
	let preferencesCustomized = $state(false);
	const preferencePanelId = $props.id();
	const tabOptions = $derived<TabOption<LessonTab>[]>(
		[
			{ value: 'source' as const, label: 'Test source' },
			{ value: 'remappings' as const, label: 'Special mappings' },
			...(onTestStyleChange ? [{ value: 'style' as const, label: 'Test style' }] : [])
		].map((option) => ({
			...option,
			id: `${preferencePanelId}-${option.value}-tab`,
			controls: `${preferencePanelId}-${option.value}-panel`
		}))
	);
	const typeLabels = { magic: 'Magic', adaptive: 'Adaptive', chiral: 'Chiral' };
	let lessonWordCount = $state<TypingPracticeWordCount>(DEFAULT_TYPING_PRACTICE_WORD_COUNT);
	let draftTestStyle = $state<TypingPracticeTestStyle>(DEFAULT_TYPING_PRACTICE_TEST_STYLE);
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
	const settingsAreDefault = $derived(
		isDefaultTypingPracticeLessonSettings(lesson) &&
			(!onTestStyleChange || draftTestStyle === DEFAULT_TYPING_PRACTICE_TEST_STYLE)
	);
	const selectedWordCount = $derived(String(lessonWordCount) as `${TypingPracticeWordCount}`);

	$effect(() => {
		if (!open) return;
		// Snapshot each opening; incoming lesson data must not overwrite an unsaved dialog draft.
		untrack(() => {
			activeTab = 'source';
			source = lesson.customText ? 'custom-text' : 'random-words';
			text = initialText;
			specialWordsPercent = lesson.specialWordsPercent;
			remappingPreferences = { ...(lesson.remappingPreferences ?? defaultRemappingPreferences()) };
			preferencesCustomized = Boolean(lesson.remappingPreferences);
			lessonWordCount = lesson.wordCount;
			wordBank = lesson.wordBank ?? 'english1k';
			draftTestStyle = testStyle;
		});
	});

	$effect(() => {
		if (!open || activeTab !== 'source' || source !== 'custom-text' || !textField) return;
		const field = textField;
		const previous = document.activeElement;
		const frame = requestAnimationFrame(() => {
			if (!field.isConnected || document.activeElement !== previous) return;
			field.focus();
			field.select();
		});
		return () => cancelAnimationFrame(frame);
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (source === 'custom-text') {
			if (!normalizedText) return;
			commitTestStyle(draftTestStyle);
			onSave(
				normalizeTypingPracticeLessonSettings({
					customText: normalizedText,
					wordCount: lessonWordCount
				})
			);
			return;
		}
		commitTestStyle(draftTestStyle);
		onSave(
			normalizeTypingPracticeLessonSettings({
				...(wordBank === 'english10k' || lesson.wordBank ? { wordBank } : {}),
				customText: null,
				...(preferencesCustomized ? { remappingPreferences } : {}),
				specialWordsPercent: specialWordsAvailable
					? specialWordsPercent
					: lesson.specialWordsPercent,
				wordCount: lessonWordCount
			})
		);
	}

	function reset() {
		commitTestStyle(DEFAULT_TYPING_PRACTICE_TEST_STYLE);
		onSave(
			normalizeTypingPracticeLessonSettings(lesson.wordBank ? { wordBank: 'english1k' } : null)
		);
	}

	function commitTestStyle(value: TypingPracticeTestStyle) {
		if (value !== testStyle) onTestStyleChange?.(value);
	}

	function setLessonWordCount(value: `${TypingPracticeWordCount}`) {
		lessonWordCount = Number(value) as TypingPracticeWordCount;
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="typing-practice-lesson-title"
	panelClass="max-w-xl max-h-[calc(100dvh-2rem)] overflow-hidden"
	initialFocusSelector={focusWordBank
		? '.typing-practice-word-bank-select'
		: lesson.customText
			? '.typing-practice-lesson-text-field'
			: null}
>
	<ModalHeader titleId="typing-practice-lesson-title" title="Practice lesson" {onClose} />

	<div class="lesson-tabs shrink-0 border-b px-5" style="border-color: var(--border);">
		<Tabs
			value={activeTab}
			onChange={(value) => (activeTab = value)}
			options={tabOptions}
			ariaLabel="Practice lesson sections"
			class="lesson-tab-list"
			buttonClass="lesson-tab"
			selectedClass="lesson-tab--selected"
		/>
	</div>
	<form onsubmit={submit} class="flex min-h-0 flex-col">
		<div class="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">
			{#each tabOptions as option (option.value)}
				<div
					id={option.controls}
					role="tabpanel"
					aria-labelledby={option.id}
					hidden={activeTab !== option.value}
				>
					{#if activeTab === option.value}
						{#if option.value === 'source'}
							<div class="flex flex-col gap-4">
								<fieldset class="typing-practice-lesson-source">
									<legend>Test source</legend>
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
									<label class="flex flex-col gap-1.5">
										<span class="typing-practice-lesson-label">Word bank</span>
										<span class="word-bank-select-wrapper">
											<select
												bind:value={wordBank}
												class="typing-practice-word-bank-select rounded-lg border p-2"
												style="background: var(--input-bg); color: var(--text-primary); border-color: var(--border);"
											>
												<option value="english1k">English 1k</option>
												<option value="english10k">English 10k</option>
											</select>
											<svg
												class="word-bank-chevron"
												aria-hidden="true"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"><path d="m6 9 6 6 6-6" /></svg
											>
										</span>
									</label>
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
						{:else if option.value === 'remappings'}
							{#if source === 'custom-text'}
								<p class="typing-practice-lesson-hint">
									Remapping preferences apply to random words. Choose Random words in Test source to
									adjust them.
								</p>
							{:else if !specialWordsAvailable}
								<p class="typing-practice-lesson-hint">
									This layout has no Magic, Adaptive, or Chiral mappings.
								</p>
							{:else}
								{#if specialWordsAvailable}
									<div class="typing-practice-lesson-balance">
										<label class="typing-practice-lesson-balance-control">
											<span class="typing-practice-lesson-label"> Words with remappings </span>
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
											Fills this share of the lesson with words the enabled remappings can help
											type. Disabled mappings don't count. If no selected type has matching words,
											ordinary random words are used.
										</p>
										<button
											type="button"
											class="filter-reset-button remapping-preferences-button"
											aria-expanded={remappingPreferences.split}
											aria-controls={preferencePanelId}
											onclick={() => {
												preferencesCustomized = true;
												remappingPreferences = {
													...remappingPreferences,
													split: !remappingPreferences.split
												};
											}}
										>
											{remappingPreferences.split ? 'Use combined selection' : 'Adjust by type'}
										</button>
										{#if remappingPreferences.split}
											<div id={preferencePanelId} class="remapping-preferences">
												<p class="typing-practice-lesson-hint">
													Relative preferences, not percentages. Equal values favor types equally; 0
													stops selecting for that type. A word may still use more than one type.
												</p>
												{#each REMAPPING_TYPES as type (type)}
													<label class="typing-practice-lesson-balance-control">
														<span class="typing-practice-lesson-label"
															>{typeLabels[type]} preference</span
														>
														<span class="typing-practice-lesson-balance-row">
															<input
																type="range"
																min="0"
																max="100"
																step="10"
																value={remappingPreferences[type]}
																style:accent-color={`var(--${type}-key)`}
																aria-valuetext={remappingPreferences[type] === 0
																	? 'Off'
																	: `${remappingPreferences[type]} relative weight`}
																oninput={(event) => {
																	preferencesCustomized = true;
																	remappingPreferences = {
																		...remappingPreferences,
																		[type]: Number(event.currentTarget.value)
																	};
																}}
															/>
															<span class="typing-practice-lesson-balance-value" aria-hidden="true"
																>{remappingPreferences[type] || 'Off'}</span
															>
														</span>
													</label>
													{#if wordCount > 0 && remappingCounts[type] === 0}<p
															class="typing-practice-lesson-hint"
														>
															No matching {typeLabels[type]} words; this preference is skipped.
														</p>{/if}
												{/each}
												{#if REMAPPING_TYPES.every((type) => remappingPreferences[type] === 0)}<p
														class="typing-practice-lesson-hint"
														role="status"
													>
														All preferences are off; ordinary random words will be used.
													</p>{/if}
											</div>
										{/if}
										{#if wordCount > 0}
											{#if specialWordCount === 0 && specialWordsPercent > 0}
												<p class="typing-practice-lesson-hint" role="status">
													No words match the active remappings, so ordinary random words will be
													used.
												</p>
											{:else}
												<p class="typing-practice-lesson-hint">
													{specialWordCount} of {wordCount} words match the active remappings.
												</p>
											{/if}
										{/if}
									</div>
								{/if}
							{/if}
						{:else}
							{#if onTestStyleChange}
								<div class="typing-practice-lesson-test-style">
									<span class="typing-practice-lesson-label">Test style</span>
									<SegmentedControl
										value={draftTestStyle}
										onChange={(value) => (draftTestStyle = value)}
										options={testStyleOptions}
										ariaLabel="Test style"
										class="typing-practice-lesson-test-style-control"
										buttonClass="typing-practice-lesson-test-style-option"
										selectedClass="typing-practice-lesson-test-style-option--selected"
									/>
									<p class="typing-practice-lesson-hint typing-practice-lesson-description">
										Monkeytype shows the full test, wraps when needed, and keeps completed words
										visible. Colemak Club uses a large, single-line queue that advances as words are
										completed.
									</p>
								</div>
							{/if}
						{/if}
					{/if}
				</div>
			{/each}
		</div>

		<div
			class="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-4"
			style="border-color: var(--border);"
		>
			<button
				type="button"
				class="filter-reset-button typing-practice-lesson-button"
				disabled={settingsAreDefault}
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
	.word-bank-select-wrapper {
		position: relative;
		display: block;
	}
	.typing-practice-word-bank-select {
		width: 100%;
		appearance: none;
		padding-right: 2.5rem;
	}
	.typing-practice-word-bank-select:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.word-bank-chevron {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: var(--text-secondary);
	}

	.lesson-tabs :global(.lesson-tab-list) {
		display: flex;
	}
	.lesson-tabs :global(.lesson-tab) {
		flex: 1;
		padding: 0.75rem 0.25rem;
		border-bottom: 2px solid transparent;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}
	.lesson-tabs :global(.lesson-tab--selected) {
		border-color: var(--accent);
		color: var(--text-primary);
	}
	.lesson-tabs :global(.lesson-tab:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.remapping-preferences-button {
		align-self: flex-start;
	}
	.remapping-preferences {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
	}
	.typing-practice-lesson-source {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.typing-practice-lesson-test-style {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.typing-practice-lesson-test-style :global(.typing-practice-lesson-test-style-control) {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.375rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.typing-practice-lesson-test-style :global(.typing-practice-lesson-test-style-option) {
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

	.typing-practice-lesson-test-style :global(.typing-practice-lesson-test-style-option:hover) {
		color: var(--text-primary);
	}

	.typing-practice-lesson-test-style
		:global(.typing-practice-lesson-test-style-option:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.typing-practice-lesson-test-style :global(.typing-practice-lesson-test-style-option--selected) {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
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
		gap: 0.375rem;
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
