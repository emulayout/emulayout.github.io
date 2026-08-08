<script lang="ts">
	import { LAYOUT_CARD_TEST_AREA_HEIGHT } from '$lib/constants';
	import type { LayoutData } from '$lib/layout';
	import {
		resolveLayoutInput,
		type LayoutInputProfile,
		type LayoutInputResult
	} from '$lib/layoutInputBehaviors';
	import {
		insertTextAtSelection,
		resolveLayoutTestKeyDown,
		shouldCaptureLayoutTestKeyUp,
		usesMetaThumbKeys,
		type LayoutTestKeyMaps
	} from '$lib/layoutTestEmulator';

	interface Props {
		layout: LayoutData;
		keyMaps: LayoutTestKeyMaps;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		variant?: 'card' | 'page' | 'practice';
		placeholder?: string;
		ariaLabel?: string;
		value?: string;
		onValueChange?: (value: string) => void;
		onResolvedInput?: (result: LayoutInputResult) => string | undefined;
		onInputHistoryChange?: (history: string) => void;
	}

	const {
		layout,
		keyMaps,
		inputProfile,
		disabledMappingIds = [],
		variant = 'card',
		placeholder = 'Layout test area',
		ariaLabel = placeholder,
		value,
		onValueChange,
		onResolvedInput,
		onInputHistoryChange
	}: Props = $props();
	let textareaElement: HTMLTextAreaElement | null = $state(null);
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

	function setTextValue(nextValue: string, cursor = nextValue.length, notify = true) {
		if (textareaElement) {
			textareaElement.value = nextValue;
			textareaElement.setSelectionRange(cursor, cursor);
		}
		if (notify) onValueChange?.(nextValue);
	}

	function insertText(text: string) {
		if (!textareaElement || !text) return;
		const edit = insertTextAtSelection(
			textareaElement.value,
			textareaElement.selectionStart,
			textareaElement.selectionEnd,
			text
		);
		setTextValue(edit.value, edit.cursor);
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
		insertText(result.text);
		setInputHistory(result.nextHistory);
	}

	$effect(() => {
		if (value === undefined || !textareaElement || textareaElement.value === value) return;
		setTextValue(value, value.length, false);
	});

	$effect(() => {
		void disabledMappingIds;
		resetInputHistory();
	});

	function handleKeyDown(event: KeyboardEvent) {
		const decision = resolveLayoutTestKeyDown(event, {
			hasThumbKeys: layout.hasThumbKeys,
			thumbKeysByHand: layout.thumbKeysByHand,
			keyMaps,
			metaThumbKeys: usesMetaThumbKeys(navigator.platform, navigator.userAgent)
		});

		if (decision.preventDefault) event.preventDefault();
		if (decision.stopPropagation) event.stopPropagation();
		if (decision.edit?.type === 'clear') {
			setTextValue('');
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

	function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		onValueChange?.(event.currentTarget.value);
		resetInputHistory();
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (
			!shouldCaptureLayoutTestKeyUp(
				event.code,
				layout.hasThumbKeys,
				usesMetaThumbKeys(navigator.platform, navigator.userAgent)
			)
		) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
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
	style="
		height: {variant === 'page'
		? 'clamp(12rem, 32vh, 22rem)'
		: variant === 'practice'
			? 'clamp(4.75rem, 11vh, 6.5rem)'
			: `${LAYOUT_CARD_TEST_AREA_HEIGHT}px`};
		background-color: var(--input-bg);
		border: 1px solid var(--border);
		--tw-ring-color: var(--accent);
	"
>
	<textarea
		bind:this={textareaElement}
		class="layout-test-area-input"
		style="color: var(--text-primary);"
		rows="2"
		{placeholder}
		aria-label={ariaLabel}
		onkeydown={handleKeyDown}
		onkeyup={handleKeyUp}
		oninput={handleInput}
		onpointerdown={resetInputHistory}
		onblur={resetInputHistory}></textarea>
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
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.layout-test-area--page .layout-test-area-input {
		padding: 1rem;
		font-size: 1rem;
		line-height: 1.5;
	}

	.layout-test-area--practice .layout-test-area-input {
		padding: 1rem 1.25rem;
		font-size: clamp(1.35rem, 3vw, 2rem);
		font-weight: 500;
		line-height: 1.35;
	}
</style>
