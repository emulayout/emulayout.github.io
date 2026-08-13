<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { SPLIT_COL } from '$lib/cmini/keyboard';
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
		/** When false, empty keys stay blank instead of showing QWERTY fallbacks. */
		showPlaceholders?: boolean;
		ariaLabel?: string;
	}

	let {
		config,
		invalidSlots = [],
		onConfigChange,
		showPlaceholders = true,
		ariaLabel = 'Input keyboard mapping'
	}: Props = $props();
	const rows = $derived(keyboardInputRows(config));
	const inputBySlot = new SvelteMap<string, HTMLInputElement>();
	const orthoGeometry = $derived(config.keyboardType === 'ortho');

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

	function orthoHalves(keys: readonly KeyboardInputKey[], row: number) {
		if (row >= 3) {
			return {
				left: keys.filter((key) => key.thumbHand !== 'r'),
				right: keys.filter((key) => key.thumbHand === 'r')
			};
		}
		const left: KeyboardInputKey[] = [];
		const right: KeyboardInputKey[] = [];
		for (const key of keys) {
			const position = parseKeyboardInputSlot(key.slot);
			if (position && position.column >= SPLIT_COL) right.push(key);
			else left.push(key);
		}
		return { left, right };
	}

	function isHomeKey(key: KeyboardInputKey): boolean {
		const position = parseKeyboardInputSlot(key.slot);
		return Boolean(position && isKeyboardInputHomeKeySlot(position.row, position.column));
	}

	function keyLabel(row: number, index: number): string {
		return row >= 3 ? `Thumb key ${index + 1}` : `Row ${row + 1}, key ${index + 1}`;
	}
</script>

{#snippet keyField(key: KeyboardInputKey, rowNumber: number, keyIndex: number)}
	<input
		use:registerInput={key.slot}
		type="text"
		value={key.value}
		placeholder={showPlaceholders && !key.inert ? keyboardInputPlaceholderValue(key.slot) : ''}
		aria-label={keyLabel(rowNumber, keyIndex)}
		aria-invalid={invalidSlots.includes(key.slot) || undefined}
		data-keyboard-input-slot={key.slot}
		data-keyboard-input-inert={key.inert ? 'true' : undefined}
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
{/snippet}

<div class="keyboard-input-editor" role="group" aria-label={ariaLabel}>
	<div class="keyboard-input-editor__rows" data-keyboard-type={config.keyboardType}>
		{#each rows as row (row.row)}
			{#if orthoGeometry}
				{@const halves = orthoHalves(row.keys, row.row)}
				<div
					class="keyboard-input-editor__row keyboard-input-editor__row--ortho"
					class:keyboard-input-editor__row--thumbs={row.row >= 3}
					data-keyboard-input-row={row.row}
				>
					<div class="keyboard-input-editor__half keyboard-input-editor__half--left">
						{#each halves.left as key, keyIndex (key.slot)}
							{@render keyField(key, row.row, keyIndex)}
						{/each}
					</div>
					<span class="keyboard-input-editor__hand-gap" aria-hidden="true"></span>
					<div class="keyboard-input-editor__half keyboard-input-editor__half--right">
						{#each halves.right as key, keyIndex (key.slot)}
							{@render keyField(key, row.row, halves.left.length + keyIndex)}
						{/each}
					</div>
				</div>
			{:else}
				<div
					class="keyboard-input-editor__row"
					class:keyboard-input-editor__row--thumbs={row.row >= 3}
					class:keyboard-input-editor__row--stagger-home={row.row === 1}
					class:keyboard-input-editor__row--stagger-bottom={row.row === 2}
					data-keyboard-input-row={row.row}
				>
					{#each row.keys as key, keyIndex (key.slot)}
						{@render keyField(key, row.row, keyIndex)}
					{/each}
				</div>
			{/if}
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
		--editor-key-size: var(--keyboard-preview-key-size, clamp(2.25rem, 5vw, 3.25rem));
		--editor-key-gap: var(--keyboard-preview-key-gap, clamp(0.25rem, 0.7vw, 0.5rem));
		width: max-content;
		min-width: 100%;
	}

	.keyboard-input-editor__rows[data-keyboard-type='ortho'] {
		min-width: 0;
		margin-inline: auto;
	}

	.keyboard-input-editor__row {
		display: flex;
		justify-content: center;
		gap: var(--editor-key-gap);
		width: max-content;
		min-width: 100%;
	}

	.keyboard-input-editor__row--ortho {
		justify-content: flex-start;
		min-width: 0;
		gap: 0;
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

	.keyboard-input-editor__half {
		display: flex;
		gap: var(--editor-key-gap);
		min-width: calc(var(--editor-key-size) * 5 + var(--editor-key-gap) * 4);
	}

	.keyboard-input-editor__half--left {
		justify-content: flex-end;
	}

	.keyboard-input-editor__half--right {
		justify-content: flex-start;
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
