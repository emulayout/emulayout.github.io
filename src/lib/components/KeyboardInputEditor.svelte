<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import LayoutInputFeatureIcon from '$lib/components/LayoutInputFeatureIcon.svelte';
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
	import {
		ansiThumbDisplayColumn,
		ansiThumbOffsetCss,
		thumbTargetColumns
	} from '$lib/layoutDisplay';
	import type {
		LayoutKeyboardFeedback,
		LayoutKeyboardKeyFeedback,
		LayoutKeyboardSwapPath
	} from '$lib/layoutKeyboardFeedback';
	import { unreachableLayoutKeyTitle } from '$lib/layoutKeyReachability';
	import {
		EMPTY_KEYBOARD_SWAP_PATH_LAYER,
		measureKeyboardSwapPaths,
		type KeyboardSwapPathLayer
	} from '$lib/layoutKeyboardSwapPathLayer';

	const EMPTY_FEEDBACK: LayoutKeyboardFeedback = new Map();

	interface Props {
		config: KeyboardInputConfig;
		invalidSlots?: readonly string[];
		onConfigChange: (config: KeyboardInputConfig) => void;
		/** When false, empty keys stay blank instead of showing QWERTY fallbacks. */
		showPlaceholders?: boolean;
		ariaLabel?: string;
		feedback?: LayoutKeyboardFeedback;
		swapPaths?: readonly LayoutKeyboardSwapPath[];
		highlightedKeys?: readonly string[];
		unreachableKeys?: readonly string[];
		highlightHomeKeys?: boolean;
	}

	let {
		config,
		invalidSlots = [],
		onConfigChange,
		showPlaceholders = true,
		ariaLabel = 'Input keyboard mapping',
		feedback = EMPTY_FEEDBACK,
		swapPaths = [],
		highlightedKeys = [],
		unreachableKeys = [],
		highlightHomeKeys = false
	}: Props = $props();
	const rows = $derived(keyboardInputRows(config));
	const inputBySlot = new SvelteMap<string, HTMLInputElement>();
	const orthoGeometry = $derived(config.keyboardType === 'ortho');
	const highlightedKeySet = $derived(new Set(highlightedKeys.map((key) => key.toLowerCase())));
	const unreachableKeySet = $derived(new Set(unreachableKeys.map((key) => key.toLowerCase())));
	const rightSlotCount = $derived.by(() => {
		let max = 9;
		for (const key of config.keys) {
			const position = parseKeyboardInputSlot(key.slot);
			if (position && position.row < 3) max = Math.max(max, position.column);
		}
		return Math.max(5, max - 4);
	});
	let keysElement: HTMLDivElement | null = $state(null);
	let focusedSlot = $state<string | null>(null);
	let swapPathLayer = $state<KeyboardSwapPathLayer>(EMPTY_KEYBOARD_SWAP_PATH_LAYER);

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

	function orthoThumbSlots(
		keys: readonly KeyboardInputKey[],
		hand: 'left' | 'right',
		keyIndexOffset: number,
		slotCount: number
	) {
		const startColumn = hand === 'left' ? 0 : 5;
		const keyByColumn = new Map(
			thumbTargetColumns(hand, keys.length).map(
				(column, index) => [column, { key: keys[index], keyIndex: keyIndexOffset + index }] as const
			)
		);
		return Array.from({ length: slotCount }, (_, index) => {
			const column = startColumn + index;
			const placed = keyByColumn.get(column);
			return { column, key: placed?.key, keyIndex: placed?.keyIndex ?? keyIndexOffset };
		});
	}

	function ansiThumbKeys(left: readonly KeyboardInputKey[], right: readonly KeyboardInputKey[]) {
		return [
			...thumbTargetColumns('left', left.length).map((column, index) => ({
				column: ansiThumbDisplayColumn(column),
				key: left[index],
				keyIndex: index
			})),
			...thumbTargetColumns('right', right.length).map((column, index) => ({
				column: ansiThumbDisplayColumn(column),
				key: right[index],
				keyIndex: left.length + index
			}))
		];
	}

	function ansiThumbOffset(column: number): string {
		return ansiThumbOffsetCss(column, 'var(--editor-key-size)', 'var(--editor-key-gap)');
	}

	function isHomeKey(key: KeyboardInputKey): boolean {
		const position = parseKeyboardInputSlot(key.slot);
		return Boolean(position && isKeyboardInputHomeKeySlot(position.row, position.column));
	}

	function isHighlightedKey(value: string): boolean {
		return Boolean(value) && highlightedKeySet.has(value.toLowerCase());
	}

	function isUnreachableKey(value: string): boolean {
		return Boolean(value) && unreachableKeySet.has(value.toLowerCase());
	}

	function keyFeedback(key: KeyboardInputKey): LayoutKeyboardKeyFeedback | undefined {
		if (!key.value) return undefined;
		return feedback.get(key.value);
	}

	function keyTitle(
		key: KeyboardInputKey,
		rowNumber: number,
		state: LayoutKeyboardKeyFeedback | undefined
	): string | undefined {
		if (isUnreachableKey(key.value)) {
			return unreachableLayoutKeyTitle({ isThumb: rowNumber >= 3 });
		}
		if (state?.value) return `${key.value} emits ${state.value}`;
		return undefined;
	}

	function keyLabel(row: number, index: number): string {
		return row >= 3 ? `Thumb key ${index + 1}` : `Row ${row + 1}, key ${index + 1}`;
	}

	function keyOverlay(
		key: KeyboardInputKey,
		state: LayoutKeyboardKeyFeedback | undefined
	): 'icon' | 'value' | null {
		if (focusedSlot === key.slot || !state) return null;
		if (state.kind === 'magic' && !state.value) return 'icon';
		if (state.value) return 'value';
		return null;
	}

	$effect(() => {
		const container = keysElement;
		const paths = swapPaths;
		void rows;
		if (!container || paths.length === 0) {
			swapPathLayer = EMPTY_KEYBOARD_SWAP_PATH_LAYER;
			return;
		}

		let disposed = false;
		const update = () => {
			if (!disposed) swapPathLayer = measureKeyboardSwapPaths(container, paths);
		};
		void tick().then(update);
		const resizeObserver = new ResizeObserver(update);
		resizeObserver.observe(container);
		window.addEventListener('resize', update);

		return () => {
			disposed = true;
			resizeObserver.disconnect();
			window.removeEventListener('resize', update);
		};
	});
</script>

{#snippet keyField(
	key: KeyboardInputKey,
	rowNumber: number,
	keyIndex: number,
	attrs: { style?: string; ansiThumb?: boolean; column?: number } = {}
)}
	{@const assigned = Boolean(key.value)}
	{@const state = keyFeedback(key)}
	{@const home = isHomeKey(key)}
	{@const next = assigned && isHighlightedKey(key.value)}
	{@const unreachable = assigned && isUnreachableKey(key.value)}
	{@const overlay = keyOverlay(key, state)}
	<span
		class="keyboard-input-editor__key"
		class:keyboard-input-editor__key--ansi-thumb={Boolean(attrs.ansiThumb)}
		class:keyboard-input-editor__key--home={home}
		class:keyboard-input-editor__key--home-colored={highlightHomeKeys && home}
		class:keyboard-input-editor__key--next={next}
		class:keyboard-input-editor__key--magic={state?.kind === 'magic'}
		class:keyboard-input-editor__key--active={Boolean(state?.active)}
		class:keyboard-input-editor__key--unreachable={unreachable}
		class:keyboard-input-editor__key--overlay={Boolean(overlay)}
		data-key-char={assigned ? key.value : undefined}
		data-key-feedback={state?.kind}
		data-key-feedback-active={state?.active ? 'true' : undefined}
		data-key-home={highlightHomeKeys && home ? 'true' : undefined}
		data-key-next={next ? 'true' : undefined}
		data-key-unreachable={unreachable ? 'true' : undefined}
		data-thumb-column={attrs.ansiThumb ? attrs.column : undefined}
		style={attrs.style}
	>
		<input
			use:registerInput={key.slot}
			type="text"
			value={key.value}
			placeholder={showPlaceholders && !key.inert ? keyboardInputPlaceholderValue(key.slot) : ''}
			aria-label={keyLabel(rowNumber, keyIndex)}
			aria-invalid={invalidSlots.includes(key.slot) || undefined}
			title={assigned ? keyTitle(key, rowNumber, state) : undefined}
			data-keyboard-input-slot={key.slot}
			data-keyboard-input-inert={key.inert ? 'true' : undefined}
			size="1"
			class:keyboard-input-editor__field--invalid={invalidSlots.includes(key.slot)}
			autocomplete="off"
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
			onkeydown={(event) => handleKeyDown(event, key)}
			oninput={(event) => handleInput(event, key)}
			onfocus={(event) => {
				focusedSlot = key.slot;
				event.currentTarget.select();
			}}
			onblur={() => {
				if (focusedSlot === key.slot) focusedSlot = null;
			}}
			onclick={(event) => event.currentTarget.select()}
		/>
		{#if overlay === 'icon'}
			<span class="keyboard-input-editor__key-overlay" aria-hidden="true">
				<span class="keyboard-input-editor__magic-icon">
					<LayoutInputFeatureIcon feature="magic" />
				</span>
			</span>
		{:else if overlay === 'value' && state?.value}
			<span class="keyboard-input-editor__key-overlay" aria-hidden="true">{state.value}</span>
		{/if}
	</span>
{/snippet}

<div class="keyboard-input-editor" role="group" aria-label={ariaLabel}>
	<div
		class="keyboard-input-editor__rows"
		data-keyboard-type={config.keyboardType}
		bind:this={keysElement}
	>
		{#if swapPathLayer.paths.length > 0}
			<svg
				class="keyboard-input-editor__swap-paths"
				viewBox={`0 0 ${swapPathLayer.width} ${swapPathLayer.height}`}
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{#each swapPathLayer.paths as path (path.id)}
					<line
						class="keyboard-input-editor__swap-path"
						data-swap-path={path.id}
						x1={path.x1}
						y1={path.y1}
						x2={path.x2}
						y2={path.y2}
					/>
				{/each}
			</svg>
		{/if}
		{#each rows as row (row.row)}
			{#if orthoGeometry}
				{@const halves = orthoHalves(row.keys, row.row)}
				{@const thumbs = row.row >= 3}
				<div
					class="keyboard-input-editor__row keyboard-input-editor__row--ortho"
					class:keyboard-input-editor__row--thumbs={thumbs}
					data-keyboard-input-row={row.row}
				>
					<div class="keyboard-input-editor__half keyboard-input-editor__half--left">
						{#if thumbs}
							{#each orthoThumbSlots(halves.left, 'left', 0, 5) as slot (slot.column)}
								{#if slot.key}
									{@render keyField(slot.key, row.row, slot.keyIndex)}
								{:else}
									<span class="keyboard-input-editor__key-placeholder" aria-hidden="true"></span>
								{/if}
							{/each}
						{:else}
							{#each halves.left as key, keyIndex (key.slot)}
								{@render keyField(key, row.row, keyIndex)}
							{/each}
						{/if}
					</div>
					<span class="keyboard-input-editor__hand-gap" aria-hidden="true"></span>
					<div class="keyboard-input-editor__half keyboard-input-editor__half--right">
						{#if thumbs}
							{#each orthoThumbSlots(halves.right, 'right', halves.left.length, rightSlotCount) as slot (slot.column)}
								{#if slot.key}
									{@render keyField(slot.key, row.row, slot.keyIndex)}
								{:else}
									<span class="keyboard-input-editor__key-placeholder" aria-hidden="true"></span>
								{/if}
							{/each}
						{:else}
							{#each halves.right as key, keyIndex (key.slot)}
								{@render keyField(key, row.row, halves.left.length + keyIndex)}
							{/each}
						{/if}
					</div>
				</div>
			{:else if row.row >= 3}
				{@const halves = orthoHalves(row.keys, row.row)}
				<div
					class="keyboard-input-editor__row keyboard-input-editor__row--thumbs keyboard-input-editor__row--ansi-thumbs"
					data-keyboard-input-row={row.row}
				>
					{#each ansiThumbKeys(halves.left, halves.right) as thumb (thumb.key.slot)}
						{@render keyField(thumb.key, row.row, thumb.keyIndex, {
							ansiThumb: true,
							column: thumb.column,
							style: `left: ${ansiThumbOffset(thumb.column)};`
						})}
					{/each}
				</div>
			{:else}
				<div
					class="keyboard-input-editor__row"
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
		position: relative;
		width: max-content;
		min-width: 0;
	}

	.keyboard-input-editor__rows[data-keyboard-type='ortho'] {
		margin-inline: auto;
	}

	.keyboard-input-editor__swap-paths {
		position: absolute;
		z-index: 2;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.keyboard-input-editor__swap-path {
		stroke: var(--adaptive-key);
		stroke-width: 3;
		stroke-linecap: round;
		filter: drop-shadow(0 0 0.2rem color-mix(in srgb, var(--adaptive-key) 52%, transparent));
		opacity: 0.82;
		vector-effect: non-scaling-stroke;
	}

	.keyboard-input-editor__row {
		display: flex;
		justify-content: flex-start;
		gap: var(--editor-key-gap);
		width: max-content;
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
		padding-left: calc(var(--editor-key-size) * 0.68);
	}

	.keyboard-input-editor__row--thumbs {
		margin-top: calc(var(--editor-key-gap) * 1.8);
	}

	.keyboard-input-editor__row--ansi-thumbs {
		position: relative;
		width: 100%;
		height: var(--editor-key-size);
	}

	.keyboard-input-editor__key,
	.keyboard-input-editor__key-placeholder {
		width: var(--editor-key-size);
		height: var(--editor-key-size);
		flex: none;
	}

	.keyboard-input-editor__key {
		position: relative;
		display: inline-flex;
	}

	.keyboard-input-editor__key--ansi-thumb {
		position: absolute;
		top: 0;
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
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: 100%;
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

	.keyboard-input-editor__key--home input {
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

	.keyboard-input-editor input.keyboard-input-editor__field--invalid,
	.keyboard-input-editor input.keyboard-input-editor__field--invalid:hover,
	.keyboard-input-editor input.keyboard-input-editor__field--invalid:focus {
		border-color: var(--keyboard-input-validation-error);
	}

	.keyboard-input-editor input.keyboard-input-editor__field--invalid:focus {
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--keyboard-input-validation-error) 35%, transparent);
	}

	.keyboard-input-editor__key--home-colored input {
		border-color: color-mix(in srgb, var(--typing-practice-home-key) 82%, var(--border));
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--typing-practice-home-key) 76%, var(--bg-primary)) 0%,
			color-mix(in srgb, var(--typing-practice-home-key) 52%, var(--bg-primary)) 100%
		);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 22%, transparent),
			0 2px 0 color-mix(in srgb, var(--typing-practice-home-key) 68%, black),
			0 0 0.4rem color-mix(in srgb, var(--typing-practice-home-key) 24%, transparent);
	}

	.keyboard-input-editor__key--active input {
		border-color: color-mix(in srgb, var(--adaptive-key) 70%, var(--border));
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--adaptive-key) 35%, var(--bg-primary)) 0%,
			color-mix(in srgb, var(--adaptive-key) 20%, var(--bg-primary)) 100%
		);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 20%, transparent),
			0 2px 0 color-mix(in srgb, var(--adaptive-key) 42%, black),
			0 0 0.5rem color-mix(in srgb, var(--adaptive-key) 22%, transparent);
		font-size: clamp(0.65rem, 1.45vw, 1rem);
		letter-spacing: -0.02em;
	}

	.keyboard-input-editor__key--magic input {
		border-color: color-mix(in srgb, var(--magic-key) 70%, black);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--magic-key) 82%, white) 0%,
			var(--magic-key) 100%
		);
		color: var(--magic-key-fg);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 22%, transparent),
			0 2px 0 color-mix(in srgb, var(--magic-key) 62%, black),
			0 0 0.4rem color-mix(in srgb, var(--magic-key) 32%, transparent);
	}

	.keyboard-input-editor__key--next {
		z-index: 1;
		filter: drop-shadow(
			0 0 0.35rem color-mix(in srgb, var(--typing-practice-next-key-decoration) 42%, transparent)
		);
	}

	.keyboard-input-editor__key--next input {
		outline: 2px solid var(--typing-practice-next-key-decoration);
		outline-offset: -1px;
	}

	.keyboard-input-editor__key--overlay input {
		color: transparent;
		caret-color: var(--text-primary);
	}

	.keyboard-input-editor__key--overlay.keyboard-input-editor__key--magic input {
		caret-color: var(--magic-key-fg);
	}

	.keyboard-input-editor__key-overlay {
		position: absolute;
		inset: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: clamp(1rem, 2vw, 1.35rem);
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
	}

	.keyboard-input-editor__key--active .keyboard-input-editor__key-overlay {
		font-size: clamp(0.65rem, 1.45vw, 1rem);
		letter-spacing: -0.02em;
	}

	.keyboard-input-editor__key--magic .keyboard-input-editor__key-overlay {
		color: var(--magic-key-fg);
	}

	.keyboard-input-editor__magic-icon {
		display: inline-flex;
		width: clamp(1.05rem, 2.2vw, 1.35rem);
		height: clamp(1.05rem, 2.2vw, 1.35rem);
		align-items: center;
		justify-content: center;
		color: inherit;
	}

	.keyboard-input-editor__magic-icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.keyboard-input-editor__key--unreachable::after {
		content: '';
		position: absolute;
		inset: 12%;
		z-index: 1;
		background: linear-gradient(
			to top right,
			transparent calc(50% - 0.09rem),
			var(--typing-practice-incorrect) calc(50% - 0.09rem),
			var(--typing-practice-incorrect) calc(50% + 0.09rem),
			transparent calc(50% + 0.09rem)
		);
		pointer-events: none;
	}
</style>
