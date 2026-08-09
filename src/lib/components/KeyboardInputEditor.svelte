<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import {
		isKeyboardInputHomeKeySlot,
		keyboardInputPlaceholderValue,
		keyboardInputRows,
		navigateKeyboardInputSlot,
		normalizeKeyboardInputValue,
		parseKeyboardInputSlot,
		updateKeyboardInputKey,
		type KeyboardInputConfig,
		type KeyboardInputKey
	} from '$lib/keyboardInputConfig';

	interface Props {
		config: KeyboardInputConfig;
		invalidSlots?: readonly string[];
		onConfigChange: (config: KeyboardInputConfig) => void;
	}

	let { config, invalidSlots = [], onConfigChange }: Props = $props();
	const rows = $derived(keyboardInputRows(config));
	const inputBySlot = new SvelteMap<string, HTMLInputElement>();

	function registerInput(node: HTMLInputElement, slot: string) {
		inputBySlot.set(slot, node);
		return {
			destroy() {
				if (inputBySlot.get(slot) === node) inputBySlot.delete(slot);
			}
		};
	}

	function focusSlot(slot: string | null) {
		if (!slot) return;
		const input = inputBySlot.get(slot);
		input?.focus();
		input?.select();
	}

	function move(slot: string, direction: 'left' | 'right' | 'up' | 'down') {
		focusSlot(navigateKeyboardInputSlot(rows, slot, direction));
	}

	function setKey(slot: string, value: string, advance: boolean) {
		const normalized = normalizeKeyboardInputValue(value);
		onConfigChange(updateKeyboardInputKey(config, slot, normalized));
		if (advance && normalized) {
			requestAnimationFrame(() => move(slot, 'right'));
		}
	}

	function handleKeyDown(event: KeyboardEvent, key: KeyboardInputKey) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const direction = {
			ArrowLeft: 'left',
			ArrowRight: 'right',
			ArrowUp: 'up',
			ArrowDown: 'down'
		}[event.key] as 'left' | 'right' | 'up' | 'down' | undefined;
		if (direction) {
			event.preventDefault();
			move(key.slot, direction);
			return;
		}

		if (event.key === 'Backspace' || event.key === 'Delete') {
			event.preventDefault();
			setKey(key.slot, '', false);
			return;
		}

		if (Array.from(event.key).length === 1) {
			event.preventDefault();
			setKey(key.slot, event.key, true);
		}
	}

	function handleInput(event: Event, key: KeyboardInputKey) {
		const field = event.currentTarget as HTMLInputElement;
		setKey(key.slot, field.value, Boolean(field.value));
	}

	function startsRightHandGap(keys: readonly KeyboardInputKey[], index: number): boolean {
		if (index === 0) return false;
		const current = keys[index];
		const previous = keys[index - 1];
		const currentPosition = parseKeyboardInputSlot(current.slot);
		const previousPosition = parseKeyboardInputSlot(previous.slot);
		if (!currentPosition || !previousPosition) return false;
		if (currentPosition.row >= 3) {
			return current.thumbHand === 'r' && previous.thumbHand !== 'r';
		}
		if (config.keyboardType === 'staggered') return false;
		return currentPosition.column >= 5 && previousPosition.column < 5;
	}

	function isHomeKey(key: KeyboardInputKey): boolean {
		const position = parseKeyboardInputSlot(key.slot);
		return Boolean(position && isKeyboardInputHomeKeySlot(position.row, position.column));
	}

	function keyLabel(row: number, index: number): string {
		return row >= 3 ? `Thumb key ${index + 1}` : `Row ${row + 1}, key ${index + 1}`;
	}
</script>

<div class="keyboard-input-editor" aria-label="Input keyboard mapping">
	<div class="keyboard-input-editor__rows" data-keyboard-type={config.keyboardType}>
		{#each rows as row (row.row)}
			<div
				class="keyboard-input-editor__row"
				class:keyboard-input-editor__row--thumbs={row.row >= 3}
				class:keyboard-input-editor__row--stagger-home={config.keyboardType === 'staggered' &&
					row.row === 1}
				class:keyboard-input-editor__row--stagger-bottom={config.keyboardType === 'staggered' &&
					row.row === 2}
				data-keyboard-input-row={row.row}
			>
				{#each row.keys as key, keyIndex (key.slot)}
					{#if startsRightHandGap(row.keys, keyIndex)}
						<span class="keyboard-input-editor__hand-gap" aria-hidden="true"></span>
					{/if}
					<input
						use:registerInput={key.slot}
						type="text"
						value={key.value}
						placeholder={keyboardInputPlaceholderValue(key.slot)}
						aria-label={keyLabel(row.row, keyIndex)}
						aria-invalid={invalidSlots.includes(key.slot) || undefined}
						data-keyboard-input-slot={key.slot}
						class:keyboard-input-editor__key--home={isHomeKey(key)}
						class:keyboard-input-editor__key--invalid={invalidSlots.includes(key.slot)}
						autocomplete="off"
						autocapitalize="off"
						autocorrect="off"
						spellcheck="false"
						onkeydown={(event) => handleKeyDown(event, key)}
						oninput={(event) => handleInput(event, key)}
						onfocus={(event) => event.currentTarget.select()}
						onclick={(event) => event.currentTarget.select()}
					/>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.keyboard-input-editor {
		width: 100%;
		overflow-x: auto;
		padding: 0.25rem 0 0.5rem;
		scrollbar-width: thin;
	}

	.keyboard-input-editor__rows {
		--editor-key-size: clamp(2.25rem, 5vw, 3.25rem);
		--editor-key-gap: clamp(0.25rem, 0.7vw, 0.5rem);
		width: max-content;
		min-width: 100%;
	}

	.keyboard-input-editor__row {
		display: flex;
		justify-content: center;
		gap: var(--editor-key-gap);
		width: max-content;
		min-width: 100%;
	}

	.keyboard-input-editor__row + .keyboard-input-editor__row {
		margin-top: var(--editor-key-gap);
	}

	.keyboard-input-editor__row--stagger-home {
		padding-left: calc(var(--editor-key-size) * 0.28);
	}

	.keyboard-input-editor__row--stagger-bottom {
		padding-left: calc(var(--editor-key-size) * 0.7);
	}

	.keyboard-input-editor__row--thumbs {
		margin-top: calc(var(--editor-key-gap) * 1.8);
	}

	.keyboard-input-editor__hand-gap {
		width: calc(var(--editor-key-size) * 0.48);
		flex: none;
	}

	.keyboard-input-editor input {
		width: var(--editor-key-size);
		height: var(--editor-key-size);
		flex: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 0.45rem;
		outline: none;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: clamp(1rem, 2vw, 1.35rem);
		font-weight: 600;
		line-height: 1;
		text-align: center;
		text-transform: lowercase;
	}

	.keyboard-input-editor input:hover {
		border-color: color-mix(in srgb, var(--text-secondary) 55%, var(--border));
	}
	.keyboard-input-editor input.keyboard-input-editor__key--home {
		border-color: color-mix(in srgb, var(--text-primary) 42%, var(--border));
	}

	.keyboard-input-editor input::placeholder {
		color: var(--text-secondary);
		opacity: 0.58;
	}

	.keyboard-input-editor input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.keyboard-input-editor input.keyboard-input-editor__key--invalid,
	.keyboard-input-editor input.keyboard-input-editor__key--invalid:hover,
	.keyboard-input-editor input.keyboard-input-editor__key--invalid:focus {
		border-color: var(--keyboard-input-validation-error);
	}

	.keyboard-input-editor input.keyboard-input-editor__key--invalid:focus {
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--keyboard-input-validation-error) 35%, transparent);
	}
</style>
