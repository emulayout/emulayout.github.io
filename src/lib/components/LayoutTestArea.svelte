<script lang="ts">
	import { LAYOUT_CARD_TEST_AREA_HEIGHT } from '$lib/constants';
	import type { LayoutData } from '$lib/layout';
	import { resolveMagicKeyInput, type MagicKeyProfile } from '$lib/magicKeys';
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
		magicKeyProfile?: MagicKeyProfile;
	}

	const { layout, keyMaps, magicKeyProfile }: Props = $props();
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let magicKeyHistory = '';

	function resetMagicKeyHistory() {
		magicKeyHistory = '';
	}

	function isModifierKey(key: string) {
		return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta';
	}

	function insertText(text: string) {
		if (!textareaElement || !text) return;
		const edit = insertTextAtSelection(
			textareaElement.value,
			textareaElement.selectionStart,
			textareaElement.selectionEnd,
			text
		);
		textareaElement.value = edit.value;
		textareaElement.setSelectionRange(edit.cursor, edit.cursor);
	}

	function processLayoutText(text: string) {
		const result = resolveMagicKeyInput(magicKeyProfile, magicKeyHistory, text);
		insertText(result.text);
		magicKeyHistory = result.nextHistory;
	}

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
			if (textareaElement) textareaElement.value = '';
			resetMagicKeyHistory();
		} else if (decision.edit?.type === 'insert') {
			processLayoutText(decision.edit.text);
		} else if (!isModifierKey(event.key)) {
			resetMagicKeyHistory();
		}
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
	style="
		height: {LAYOUT_CARD_TEST_AREA_HEIGHT}px;
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
		placeholder="Layout test area"
		onkeydown={handleKeyDown}
		onkeyup={handleKeyUp}
		oninput={resetMagicKeyHistory}
		onpointerdown={resetMagicKeyHistory}
		onblur={resetMagicKeyHistory}></textarea>
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
</style>
