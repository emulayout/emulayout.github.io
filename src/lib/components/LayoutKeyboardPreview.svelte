<script lang="ts">
	import { tick } from 'svelte';
	import LayoutInputFeatureIcon from '$lib/components/LayoutInputFeatureIcon.svelte';
	import type { LayoutData } from '$lib/layout';
	import {
		ansiThumbDisplayColumn,
		ansiThumbOffsetCss,
		layoutMainRowMaxColumn,
		splitThumbDisplayKeys,
		thumbTargetColumns,
		type DisplayCell
	} from '$lib/layoutDisplay';
	import {
		isSpecialTriggerFeedback,
		type LayoutKeyboardFeedback,
		type LayoutKeyboardKeyFeedback,
		type LayoutKeyboardSwapPath
	} from '$lib/layoutKeyboardFeedback';
	import { isLayoutThumbKey, unreachableLayoutKeyTitle } from '$lib/layoutKeyReachability';
	import {
		EMPTY_KEYBOARD_SWAP_PATH_LAYER,
		measureKeyboardSwapPaths,
		type KeyboardSwapPathLayer
	} from '$lib/layoutKeyboardSwapPathLayer';
	import { isTypingPracticeHomeKeySlot } from '$lib/typingPracticeKeyboard';

	const EMPTY_FEEDBACK: LayoutKeyboardFeedback = new Map();

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		feedback?: LayoutKeyboardFeedback;
		swapPaths?: readonly LayoutKeyboardSwapPath[];
		highlightedKeys?: readonly string[];
		/** Practiced-layout characters with no physical mapping from the input keyboard. */
		unreachableKeys?: readonly string[];
		highlightHomeKeys?: boolean;
		horizontalAlignment?: 'start' | 'center';
	}

	type PreviewKey = DisplayCell & { slot: string };
	type PreviewSlot = {
		column: number;
		key?: PreviewKey;
	};
	type PreviewThumbKey = {
		column: number;
		key: PreviewKey;
	};
	type PreviewRow = {
		rowNumber: number;
		keys: PreviewKey[];
		leftKeys: PreviewKey[];
		rightKeys: PreviewKey[];
		leftSlots: PreviewSlot[];
		rightSlots: PreviewSlot[];
		ansiThumbKeys: PreviewThumbKey[];
		thumbs: boolean;
	};
	const {
		layout,
		rows,
		feedback = EMPTY_FEEDBACK,
		swapPaths = [],
		highlightedKeys = [],
		unreachableKeys = [],
		highlightHomeKeys = false,
		horizontalAlignment = 'center'
	}: Props = $props();
	let keysElement: HTMLDivElement | null = $state(null);
	let swapPathLayer = $state<KeyboardSwapPathLayer>(EMPTY_KEYBOARD_SWAP_PATH_LAYER);
	const orthoGeometry = $derived(layout.board === 'ortho' || layout.board === 'mini');
	const highlightedKeySet = $derived(new Set(highlightedKeys.map((key) => key.toLowerCase())));
	const unreachableKeySet = $derived(new Set(unreachableKeys.map((key) => key.toLowerCase())));
	const previewRows = $derived.by((): PreviewRow[] => {
		const mainRowMaxColumn = layoutMainRowMaxColumn(layout);
		const rightSlotCount = Math.max(5, mainRowMaxColumn - 4);

		return rows.flatMap((row) => {
			const slottedCells = row.filter((cell): cell is PreviewKey => cell.slot !== null);
			if (slottedCells.length === 0) return [];

			const rowNumber = Number(slottedCells[0].slot.split(',')[0]);
			const keys = orthoGeometry ? slottedCells.filter((cell) => Boolean(cell.char)) : slottedCells;
			const thumbs = rowNumber >= 3;
			const { left: leftKeys, right: rightKeys } = thumbs
				? splitThumbDisplayKeys(keys, layout.thumbKeysByHand)
				: { left: keys, right: [] };
			const keyByColumn = thumbs
				? new Map([
						...thumbTargetColumns('left', leftKeys.length).map(
							(column, index) => [column, leftKeys[index]] as const
						),
						...thumbTargetColumns('right', rightKeys.length).map(
							(column, index) => [column, rightKeys[index]] as const
						)
					])
				: new Map(keys.map((key) => [Number(key.slot.split(',')[1]), key] as const));
			const leftSlots = Array.from({ length: 5 }, (_, column) => ({
				column,
				key: keyByColumn.get(column)
			}));
			const rightSlots = Array.from({ length: rightSlotCount }, (_, index) => {
				const column = index + 5;
				return { column, key: keyByColumn.get(column) };
			});
			const ansiThumbKeys = [
				...thumbTargetColumns('left', leftKeys.length).map((column, index) => ({
					column: ansiThumbDisplayColumn(column),
					key: leftKeys[index]
				})),
				...thumbTargetColumns('right', rightKeys.length).map((column, index) => ({
					column: ansiThumbDisplayColumn(column),
					key: rightKeys[index]
				}))
			];

			return [
				{ rowNumber, keys, leftKeys, rightKeys, leftSlots, rightSlots, ansiThumbKeys, thumbs }
			];
		});
	});

	function ansiRowOffset(rowNumber: number): string {
		if (rowNumber === 1) return 'calc(var(--preview-key-size) * 0.28)';
		if (rowNumber === 2) return 'calc(var(--preview-key-size) * 0.68)';
		return '0px';
	}

	function ansiThumbOffset(column: number): string {
		return ansiThumbOffsetCss(column, 'var(--preview-key-size)', 'var(--preview-key-gap)');
	}

	function isHighlightedKey(key: string): boolean {
		return highlightedKeySet.has(key.toLowerCase());
	}

	function isUnreachableKey(key: string): boolean {
		return unreachableKeySet.has(key.toLowerCase());
	}

	function isHomeKey(key: PreviewKey): boolean {
		const [row, column] = key.slot.split(',').map(Number);
		return isTypingPracticeHomeKeySlot(row, column);
	}

	function keyTitle(
		key: PreviewKey,
		keyFeedback: LayoutKeyboardKeyFeedback | undefined
	): string | undefined {
		if (isUnreachableKey(key.char)) {
			return unreachableLayoutKeyTitle({ isThumb: isLayoutThumbKey(layout, key.char) });
		}
		if (keyFeedback?.value) return `${key.char} emits ${keyFeedback.value}`;
		return undefined;
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

{#snippet keyContent(key: PreviewKey, keyFeedback: LayoutKeyboardKeyFeedback | undefined)}
	{#if isSpecialTriggerFeedback(keyFeedback?.kind) && !keyFeedback.value}
		<span class="keyboard-preview__magic-icon">
			<LayoutInputFeatureIcon feature={keyFeedback.kind} />
		</span>
	{:else}
		{keyFeedback?.value ?? key.char}
	{/if}
{/snippet}

{#snippet previewKey(
	key: PreviewKey,
	attrs: {
		column?: number;
		ansiThumb?: boolean;
		style?: string;
	} = {}
)}
	{@const assigned = Boolean(key.char)}
	{@const keyFeedback = assigned ? feedback.get(key.char) : undefined}
	{@const unreachable = assigned && isUnreachableKey(key.char)}
	<span
		class="keyboard-preview__key"
		class:keyboard-preview__key--ansi-thumb={Boolean(attrs.ansiThumb)}
		class:keyboard-preview__key--magic={keyFeedback?.kind === 'magic'}
		class:keyboard-preview__key--repeat={keyFeedback?.kind === 'repeat'}
		class:keyboard-preview__key--active={Boolean(keyFeedback?.active)}
		class:keyboard-preview__key--home={highlightHomeKeys && isHomeKey(key)}
		class:keyboard-preview__key--next={assigned && isHighlightedKey(key.char)}
		class:keyboard-preview__key--unreachable={unreachable}
		data-key-char={assigned ? key.char : undefined}
		data-key-column={attrs.column}
		data-thumb-column={attrs.ansiThumb ? attrs.column : undefined}
		data-key-feedback={keyFeedback?.kind}
		data-key-feedback-active={keyFeedback?.active ? 'true' : undefined}
		data-key-home={highlightHomeKeys && isHomeKey(key) ? 'true' : undefined}
		data-key-next={assigned && isHighlightedKey(key.char) ? 'true' : undefined}
		data-key-unreachable={unreachable ? 'true' : undefined}
		title={assigned ? keyTitle(key, keyFeedback) : undefined}
		style={attrs.style}
	>
		{@render keyContent(key, keyFeedback)}
	</span>
{/snippet}

<div
	class="keyboard-preview"
	role="img"
	aria-label={`${layout.name} keyboard preview`}
	data-board={layout.board}
	data-geometry={orthoGeometry ? 'ortho' : 'ansi'}
>
	<div class="keyboard-preview__board" aria-hidden="true">
		<div
			class="keyboard-preview__keys"
			class:keyboard-preview__keys--start={horizontalAlignment === 'start'}
			bind:this={keysElement}
		>
			{#if swapPathLayer.paths.length > 0}
				<svg
					class="keyboard-preview__swap-paths"
					viewBox={`0 0 ${swapPathLayer.width} ${swapPathLayer.height}`}
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					{#each swapPathLayer.paths as path (path.id)}
						<line
							class="keyboard-preview__swap-path"
							data-swap-path={path.id}
							x1={path.x1}
							y1={path.y1}
							x2={path.x2}
							y2={path.y2}
						/>
					{/each}
				</svg>
			{/if}
			{#each previewRows as row (row.rowNumber)}
				{#if orthoGeometry}
					<div
						class="keyboard-preview__row keyboard-preview__row--ortho"
						class:keyboard-preview__row--thumbs={row.thumbs}
						data-keyboard-row={row.rowNumber}
					>
						<div class="keyboard-preview__half keyboard-preview__half--left">
							{#each row.leftSlots as slot (slot.column)}
								{#if slot.key}
									{@render previewKey(slot.key, { column: slot.column })}
								{:else}
									<span class="keyboard-preview__key-placeholder" data-key-column={slot.column}
									></span>
								{/if}
							{/each}
						</div>
						<div class="keyboard-preview__half keyboard-preview__half--right">
							{#each row.rightSlots as slot (slot.column)}
								{#if slot.key}
									{@render previewKey(slot.key, { column: slot.column })}
								{:else}
									<span class="keyboard-preview__key-placeholder" data-key-column={slot.column}
									></span>
								{/if}
							{/each}
						</div>
					</div>
				{:else if row.thumbs}
					<div
						class="keyboard-preview__row keyboard-preview__row--ansi-thumbs"
						data-keyboard-row={row.rowNumber}
					>
						{#each row.ansiThumbKeys as thumb (thumb.key.slot)}
							{@render previewKey(thumb.key, {
								ansiThumb: true,
								column: thumb.column,
								style: `left: ${ansiThumbOffset(thumb.column)};`
							})}
						{/each}
					</div>
				{:else}
					<div
						class="keyboard-preview__row keyboard-preview__row--ansi"
						data-keyboard-row={row.rowNumber}
						style={`--preview-row-offset: ${ansiRowOffset(row.rowNumber)};`}
					>
						{#each row.keys as key (key.slot)}
							{@render previewKey(key)}
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.keyboard-preview {
		--preview-key-size: var(--keyboard-preview-key-size, clamp(2.35rem, 4.7vw, 3.35rem));
		--preview-key-gap: var(--keyboard-preview-key-gap, clamp(0.25rem, 0.65vw, 0.45rem));
		width: 100%;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--text-caption) 70%, transparent) transparent;
	}

	.keyboard-preview__board {
		width: 100%;
		border: none;
		background: transparent;
		box-shadow: none;
	}

	.keyboard-preview__keys {
		position: relative;
		width: max-content;
		margin-inline: auto;
		padding-block: 0.125rem 0.3rem;
	}

	.keyboard-preview__keys--start {
		margin-inline: 0 auto;
	}

	.keyboard-preview__swap-paths {
		position: absolute;
		z-index: 2;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.keyboard-preview__swap-path {
		stroke: var(--adaptive-key);
		stroke-width: 3;
		stroke-linecap: round;
		filter: drop-shadow(0 0 0.2rem color-mix(in srgb, var(--adaptive-key) 52%, transparent));
		opacity: 0.82;
		vector-effect: non-scaling-stroke;
	}

	.keyboard-preview__row,
	.keyboard-preview__half {
		display: flex;
		gap: var(--preview-key-gap);
	}

	.keyboard-preview__row + .keyboard-preview__row {
		margin-top: var(--preview-key-gap);
	}

	.keyboard-preview__row--ortho {
		justify-content: center;
		gap: calc(var(--preview-key-size) * 0.48);
	}

	.keyboard-preview__row--thumbs {
		margin-top: calc(var(--preview-key-gap) * 1.8);
	}

	.keyboard-preview__row--thumbs .keyboard-preview__half--left {
		justify-content: flex-end;
		min-width: calc(var(--preview-key-size) * 5 + var(--preview-key-gap) * 4);
	}

	.keyboard-preview__row--thumbs .keyboard-preview__half--right {
		justify-content: flex-start;
		min-width: calc(var(--preview-key-size) * 5 + var(--preview-key-gap) * 4);
	}

	.keyboard-preview__row--ansi {
		padding-left: var(--preview-row-offset);
	}

	.keyboard-preview__row--ansi-thumbs {
		position: relative;
		width: 100%;
		height: var(--preview-key-size);
	}

	.keyboard-preview__key,
	.keyboard-preview__key-placeholder {
		width: var(--preview-key-size);
		height: var(--preview-key-size);
		flex: 0 0 var(--preview-key-size);
	}

	.keyboard-preview__key {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in srgb, var(--border) 82%, var(--text-secondary));
		border-radius: 0.5rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--bg-primary) 84%, white) 0%,
			var(--bg-primary) 100%
		);
		color: var(--text-primary);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 16%, transparent),
			0 2px 0 color-mix(in srgb, var(--border) 88%, black),
			0 0.2rem 0.35rem color-mix(in srgb, black 10%, transparent);
		font-family: var(--font-mono);
		font-size: clamp(0.95rem, 2vw, 1.2rem);
		font-weight: 600;
		line-height: 1;
		text-transform: none;
	}

	.keyboard-preview__key--ansi-thumb {
		position: absolute;
		top: 0;
	}

	.keyboard-preview__key--unreachable::after {
		content: '';
		position: absolute;
		inset: 12%;
		background: linear-gradient(
			to top right,
			transparent calc(50% - 0.09rem),
			var(--typing-practice-incorrect) calc(50% - 0.09rem),
			var(--typing-practice-incorrect) calc(50% + 0.09rem),
			transparent calc(50% + 0.09rem)
		);
		pointer-events: none;
	}

	.keyboard-preview__magic-icon {
		display: inline-flex;
		width: clamp(1.05rem, 2.2vw, 1.35rem);
		height: clamp(1.05rem, 2.2vw, 1.35rem);
		align-items: center;
		justify-content: center;
		color: inherit;
	}

	.keyboard-preview__magic-icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.keyboard-preview__key--home {
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

	.keyboard-preview__key--active {
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
		white-space: nowrap;
	}

	.keyboard-preview__key--magic,
	.keyboard-preview__key--repeat {
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

	.keyboard-preview__key--next {
		outline: 2px solid var(--typing-practice-next-key-decoration);
		outline-offset: -1px;
		filter: drop-shadow(
			0 0 0.35rem color-mix(in srgb, var(--typing-practice-next-key-decoration) 42%, transparent)
		);
	}
</style>
