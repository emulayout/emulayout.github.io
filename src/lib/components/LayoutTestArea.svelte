<script lang="ts">
	import { LAYOUT_CARD_TEST_AREA_HEIGHT } from '$lib/constants';
	import {
		resolveLayoutInput,
		type LayoutInputProfile,
		type LayoutInputResult
	} from '$lib/layoutInputBehaviors';
	import {
		insertTextAtSelection,
		resolveLayoutTestKeyDown,
		type LayoutTestKeyMaps
	} from '$lib/layoutTestEmulator';

	interface Props {
		keyMaps: LayoutTestKeyMaps;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		variant?: 'card' | 'page' | 'practice';
		placeholder?: string;
		ariaLabel?: string;
		focusOnMount?: boolean;
		invalid?: boolean;
		value?: string;
		onValueChange?: (value: string) => string | undefined;
		onResolvedInput?: (result: LayoutInputResult) => string | undefined;
		onInputHistoryChange?: (history: string) => void;
		onEscape?: () => string;
	}

	const {
		keyMaps,
		inputProfile,
		disabledMappingIds = [],
		variant = 'card',
		placeholder = 'Layout test area',
		ariaLabel = placeholder,
		focusOnMount = false,
		invalid = false,
		value,
		onValueChange,
		onResolvedInput,
		onInputHistoryChange,
		onEscape
	}: Props = $props();
	let inputElement: HTMLInputElement | HTMLTextAreaElement | null = $state(null);
	let inputHistory = '';
	const disabledMappings = $derived(new Set(disabledMappingIds));

	function setInputHistory(history: string) {
		inputHistory = history;
		onInputHistoryChange?.(history);
	}

	function resetInputHistory() {
		setInputHistory('');
	}

	function isModifierKey(key: string) {
		return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta';
	}

	function setTextValue(nextValue: string, cursor = nextValue.length, notify = true): boolean {
		if (inputElement) {
			inputElement.value = nextValue;
			inputElement.setSelectionRange(cursor, cursor);
		}
		if (!notify) return false;
		const replacementValue = onValueChange?.(nextValue);
		if (replacementValue === undefined) return false;
		if (inputElement) {
			inputElement.value = replacementValue;
			inputElement.setSelectionRange(replacementValue.length, replacementValue.length);
		}
		return true;
	}

	function insertText(text: string): boolean {
		if (!inputElement || !text) return false;
		const edit = insertTextAtSelection(
			inputElement.value,
			inputElement.selectionStart ?? inputElement.value.length,
			inputElement.selectionEnd ?? inputElement.value.length,
			text
		);
		return setTextValue(edit.value, edit.cursor);
	}

	function applyResolvedReplacement(result: LayoutInputResult): boolean {
		const replacementValue = onResolvedInput?.(result);
		if (replacementValue === undefined) return false;
		setTextValue(replacementValue);
		resetInputHistory();
		return true;
	}

	function processLayoutText(text: string) {
		const result = resolveLayoutInput(inputProfile, inputHistory, text, disabledMappings);
		if (applyResolvedReplacement(result)) return;
		if (insertText(result.text)) {
			resetInputHistory();
		} else {
			setInputHistory(result.nextHistory);
		}
	}

	$effect(() => {
		if (value === undefined || !inputElement || inputElement.value === value) return;
		setTextValue(value, value.length, false);
	});

	$effect(() => {
		void disabledMappingIds;
		resetInputHistory();
	});

	$effect(() => {
		if (!focusOnMount || !inputElement) return;
		const element = inputElement;
		const frame = window.requestAnimationFrame(() => element.focus({ preventScroll: true }));
		return () => window.cancelAnimationFrame(frame);
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (variant === 'practice' && event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			resetInputHistory();
			return;
		}

		const decision = resolveLayoutTestKeyDown(event, { keyMaps });

		if (decision.preventDefault) event.preventDefault();
		if (decision.stopPropagation) event.stopPropagation();
		if (decision.edit?.type === 'clear') {
			if (onEscape) {
				const replacementValue = onEscape();
				setTextValue(replacementValue, replacementValue.length, false);
			} else {
				setTextValue('');
			}
			resetInputHistory();
		} else if (decision.edit?.type === 'insert') {
			processLayoutText(decision.edit.text);
		} else if (
			!decision.preventDefault &&
			onResolvedInput &&
			event.key === ' ' &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.metaKey
		) {
			const result = resolveLayoutInput(inputProfile, inputHistory, event.key, disabledMappings);
			if (applyResolvedReplacement(result)) event.preventDefault();
		} else if (!isModifierKey(event.key)) {
			resetInputHistory();
		}
	}

	function handleInput(event: Event & { currentTarget: HTMLInputElement | HTMLTextAreaElement }) {
		const replacementValue = onValueChange?.(event.currentTarget.value);
		if (replacementValue !== undefined) {
			setTextValue(replacementValue, replacementValue.length, false);
		}
		resetInputHistory();
	}

	function handleBeforeInput(event: InputEvent) {
		if (
			variant === 'practice' &&
			(event.inputType === 'insertFromPaste' ||
				event.inputType === 'insertLineBreak' ||
				event.inputType === 'insertParagraph')
		) {
			event.preventDefault();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		if (variant === 'practice') event.preventDefault();
	}
</script>

<!--
	Wrapper paints the background: iOS Safari often under-paints textarea
	backgrounds inside virtua-transformed rows until focus.
-->
<div
	class="layout-test-area"
	class:layout-test-area--page={variant === 'page'}
	class:layout-test-area--practice={variant === 'practice'}
	class:layout-test-area--invalid={variant === 'practice' && invalid}
	style="
		height: {variant === 'page'
		? 'clamp(12rem, 32vh, 22rem)'
		: variant === 'practice'
			? '4.5rem'
			: `${LAYOUT_CARD_TEST_AREA_HEIGHT}px`};
		background-color: var(--input-bg);
		border: 1px solid var(--border);
		--tw-ring-color: var(--accent);
	"
>
	{#if variant === 'practice'}
		<input
			bind:this={inputElement}
			type="text"
			class="layout-test-area-input"
			{placeholder}
			aria-label={ariaLabel}
			aria-invalid={invalid || undefined}
			onkeydown={handleKeyDown}
			onbeforeinput={handleBeforeInput}
			oninput={handleInput}
			onpaste={handlePaste}
			onpointerdown={resetInputHistory}
			onblur={resetInputHistory}
		/>
		<span class="layout-test-area-error" role="status" aria-live="polite">
			{invalid ? 'Typing input does not match the current word.' : ''}
		</span>
	{:else}
		<textarea
			bind:this={inputElement}
			class="layout-test-area-input"
			rows="2"
			{placeholder}
			aria-label={ariaLabel}
			onkeydown={handleKeyDown}
			oninput={handleInput}
			onpointerdown={resetInputHistory}
			onblur={resetInputHistory}></textarea>
	{/if}
</div>

<style>
	.layout-test-area {
		width: 100%;
		border-radius: 0.5rem;
		overflow: hidden;
		transform: translateZ(0);
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}

	.layout-test-area:focus-within {
		outline: 2px solid var(--tw-ring-color, var(--accent));
		outline-offset: 0;
	}

	.layout-test-area-input {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0.4rem;
		margin: 0;
		border: 0;
		border-radius: 0;
		resize: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.layout-test-area--page .layout-test-area-input {
		padding: 1rem;
		font-size: 1rem;
		line-height: 1.5;
	}

	.layout-test-area--practice .layout-test-area-input {
		padding: 0.75rem 1.25rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 2.5rem;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.015em;
	}

	.layout-test-area--practice.layout-test-area--invalid .layout-test-area-input {
		color: var(--typing-practice-incorrect);
	}

	.layout-test-area-error {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
