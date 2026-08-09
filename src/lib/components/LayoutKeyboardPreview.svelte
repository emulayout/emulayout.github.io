<script lang="ts">
	import { tick } from 'svelte';
	import LayoutInputFeatureIcon from '$lib/components/LayoutInputFeatureIcon.svelte';
	import type { LayoutData } from '$lib/layout';
	import { thumbTargetColumns, type DisplayCell } from '$lib/layoutDisplay';
	import type {
		LayoutKeyboardFeedback,
		LayoutKeyboardKeyFeedback,
		LayoutKeyboardSwapPath
	} from '$lib/layoutKeyboardFeedback';
	import { isTypingPracticeHomeKeySlot } from '$lib/typingPracticeKeyboard';

	const EMPTY_FEEDBACK: LayoutKeyboardFeedback = new Map();

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		feedback?: LayoutKeyboardFeedback;
		swapPaths?: readonly LayoutKeyboardSwapPath[];
		highlightedKey?: string;
		highlightHomeKeys?: boolean;
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
	type RenderedSwapPath = LayoutKeyboardSwapPath & {
		id: string;
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	};
	type SwapPathLayer = {
		width: number;
		height: number;
		paths: RenderedSwapPath[];
	};

	const {
		layout,
		rows,
		feedback = EMPTY_FEEDBACK,
		swapPaths = [],
		highlightedKey,
		highlightHomeKeys = false
	}: Props = $props();
	let keysElement: HTMLDivElement | null = $state(null);
	let swapPathLayer = $state<SwapPathLayer>({ width: 0, height: 0, paths: [] });
	const orthoGeometry = $derived(layout.board === 'ortho' || layout.board === 'mini');
	const rightThumbKeys = $derived(
		new Set(layout.thumbKeysByHand.r.map((entry) => entry.key.toLowerCase()))
	);
	const previewRows = $derived.by((): PreviewRow[] => {
		const mainRowMaxColumn = Math.max(
			9,
			...Object.values(layout.keys)
				.filter(({ row }) => row < 3)
				.map(({ col }) => col)
		);
		const rightSlotCount = Math.max(5, mainRowMaxColumn - 4);

		return rows.flatMap((row) => {
			const keys = row.filter((cell): cell is PreviewKey => cell.slot !== null);
			if (keys.length === 0) return [];

			const rowNumber = Number(keys[0].slot.split(',')[0]);
			const thumbs = rowNumber >= 3;
			const leftKeys = keys.filter((key) => !rightThumbKeys.has(key.char.toLowerCase()));
			const rightKeys = keys.filter((key) => rightThumbKeys.has(key.char.toLowerCase()));
			const keyByColumn = thumbs
				? new Map([
						...thumbTargetColumns('left', leftKeys.length).map(
							(column, index) => [column, leftKeys[index]] as const
						),
						...thumbTargetColumns('right', rightKeys.length).map(
							(column, index) => [column, rightKeys[index]] as const
						)
					])
				: new Map(
						Object.values(layout.keys)
							.filter(({ row }) => row === rowNumber)
							.map(({ col }) => col)
							.sort((a, b) => a - b)
							.map((column, index) => [column, keys[index]] as const)
					);
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
					column: column - 0.5,
					key: leftKeys[index]
				})),
				...thumbTargetColumns('right', rightKeys.length).map((column, index) => ({
					column: column - 0.5,
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
		return `calc(var(--preview-key-size) * ${column + 0.68} + var(--preview-key-gap) * ${column})`;
	}

	function isHighlightedKey(key: string): boolean {
		return highlightedKey !== undefined && key.toLowerCase() === highlightedKey.toLowerCase();
	}

	function isHomeKey(key: PreviewKey): boolean {
		const [row, column] = key.slot.split(',').map(Number);
		return isTypingPracticeHomeKeySlot(row, column);
	}

	function edgeDistance(rect: DOMRect, unitX: number, unitY: number): number {
		const horizontal = unitX === 0 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(unitX);
		const vertical = unitY === 0 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(unitY);
		return Math.min(horizontal, vertical);
	}

	function measureSwapPaths(
		container: HTMLDivElement,
		paths: readonly LayoutKeyboardSwapPath[]
	): SwapPathLayer {
		const containerRect = container.getBoundingClientRect();
		const keyByChar = new Map(
			Array.from(container.querySelectorAll<HTMLElement>('[data-key-char]')).map((key) => [
				key.dataset.keyChar ?? '',
				key
			])
		);
		const renderedPaths = paths.flatMap((path): RenderedSwapPath[] => {
			const fromKey = keyByChar.get(path.from);
			const toKey = keyByChar.get(path.to);
			if (!fromKey || !toKey) return [];

			const fromRect = fromKey.getBoundingClientRect();
			const toRect = toKey.getBoundingClientRect();
			const fromCenterX = fromRect.left + fromRect.width / 2;
			const fromCenterY = fromRect.top + fromRect.height / 2;
			const toCenterX = toRect.left + toRect.width / 2;
			const toCenterY = toRect.top + toRect.height / 2;
			const deltaX = toCenterX - fromCenterX;
			const deltaY = toCenterY - fromCenterY;
			const distance = Math.hypot(deltaX, deltaY);
			if (distance === 0) return [];

			const unitX = deltaX / distance;
			const unitY = deltaY / distance;
			const fromEdge = edgeDistance(fromRect, unitX, unitY);
			const toEdge = edgeDistance(toRect, unitX, unitY);

			return [
				{
					...path,
					id: `${path.from}:${path.to}`,
					x1: fromCenterX - containerRect.left + unitX * fromEdge,
					y1: fromCenterY - containerRect.top + unitY * fromEdge,
					x2: toCenterX - containerRect.left - unitX * toEdge,
					y2: toCenterY - containerRect.top - unitY * toEdge
				}
			];
		});

		return {
			width: containerRect.width,
			height: containerRect.height,
			paths: renderedPaths
		};
	}

	$effect(() => {
		const container = keysElement;
		const paths = swapPaths;
		void rows;
		if (!container || paths.length === 0) {
			swapPathLayer = { width: 0, height: 0, paths: [] };
			return;
		}

		let disposed = false;
		const update = () => {
			if (!disposed) swapPathLayer = measureSwapPaths(container, paths);
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
	{#if keyFeedback?.kind === 'magic' && !keyFeedback.value}
		<span class="keyboard-preview__magic-icon">
			<LayoutInputFeatureIcon feature="magic" />
		</span>
	{:else}
		{keyFeedback?.value ?? key.char}
	{/if}
{/snippet}

<div
	class="keyboard-preview"
	role="img"
	aria-label={`${layout.name} keyboard preview`}
	data-board={layout.board}
	data-geometry={orthoGeometry ? 'ortho' : 'ansi'}
>
	<div class="keyboard-preview__board" aria-hidden="true">
		<div class="keyboard-preview__keys" bind:this={keysElement}>
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
									{@const keyFeedback = feedback.get(slot.key.char)}
									<span
										class="keyboard-preview__key"
										class:keyboard-preview__key--magic={keyFeedback?.kind === 'magic'}
										class:keyboard-preview__key--active={Boolean(keyFeedback?.active)}
										class:keyboard-preview__key--home={highlightHomeKeys && isHomeKey(slot.key)}
										class:keyboard-preview__key--next={isHighlightedKey(slot.key.char)}
										data-key-char={slot.key.char}
										data-key-column={slot.column}
										data-key-feedback={keyFeedback?.kind}
										data-key-feedback-active={keyFeedback?.active ? 'true' : undefined}
										data-key-home={highlightHomeKeys && isHomeKey(slot.key) ? 'true' : undefined}
										data-key-next={isHighlightedKey(slot.key.char) ? 'true' : undefined}
										title={keyFeedback?.value
											? `${slot.key.char} emits ${keyFeedback.value}`
											: undefined}
									>
										{@render keyContent(slot.key, keyFeedback)}
									</span>
								{:else}
									<span class="keyboard-preview__key-placeholder" data-key-column={slot.column}
									></span>
								{/if}
							{/each}
						</div>
						<div class="keyboard-preview__half keyboard-preview__half--right">
							{#each row.rightSlots as slot (slot.column)}
								{#if slot.key}
									{@const keyFeedback = feedback.get(slot.key.char)}
									<span
										class="keyboard-preview__key"
										class:keyboard-preview__key--magic={keyFeedback?.kind === 'magic'}
										class:keyboard-preview__key--active={Boolean(keyFeedback?.active)}
										class:keyboard-preview__key--home={highlightHomeKeys && isHomeKey(slot.key)}
										class:keyboard-preview__key--next={isHighlightedKey(slot.key.char)}
										data-key-char={slot.key.char}
										data-key-column={slot.column}
										data-key-feedback={keyFeedback?.kind}
										data-key-feedback-active={keyFeedback?.active ? 'true' : undefined}
										data-key-home={highlightHomeKeys && isHomeKey(slot.key) ? 'true' : undefined}
										data-key-next={isHighlightedKey(slot.key.char) ? 'true' : undefined}
										title={keyFeedback?.value
											? `${slot.key.char} emits ${keyFeedback.value}`
											: undefined}
									>
										{@render keyContent(slot.key, keyFeedback)}
									</span>
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
							{@const keyFeedback = feedback.get(thumb.key.char)}
							<span
								class="keyboard-preview__key keyboard-preview__key--ansi-thumb"
								class:keyboard-preview__key--magic={keyFeedback?.kind === 'magic'}
								class:keyboard-preview__key--active={Boolean(keyFeedback?.active)}
								class:keyboard-preview__key--next={isHighlightedKey(thumb.key.char)}
								data-key-char={thumb.key.char}
								data-thumb-column={thumb.column}
								data-key-feedback={keyFeedback?.kind}
								data-key-feedback-active={keyFeedback?.active ? 'true' : undefined}
								data-key-next={isHighlightedKey(thumb.key.char) ? 'true' : undefined}
								title={keyFeedback?.value
									? `${thumb.key.char} emits ${keyFeedback.value}`
									: undefined}
								style={`left: ${ansiThumbOffset(thumb.column)};`}
								>{@render keyContent(thumb.key, keyFeedback)}</span
							>
						{/each}
					</div>
				{:else}
					<div
						class="keyboard-preview__row keyboard-preview__row--ansi"
						data-keyboard-row={row.rowNumber}
						style={`--preview-row-offset: ${ansiRowOffset(row.rowNumber)};`}
					>
						{#each row.keys as key (key.slot)}
							{@const keyFeedback = feedback.get(key.char)}
							<span
								class="keyboard-preview__key"
								class:keyboard-preview__key--magic={keyFeedback?.kind === 'magic'}
								class:keyboard-preview__key--active={Boolean(keyFeedback?.active)}
								class:keyboard-preview__key--home={highlightHomeKeys && isHomeKey(key)}
								class:keyboard-preview__key--next={isHighlightedKey(key.char)}
								data-key-char={key.char}
								data-key-feedback={keyFeedback?.kind}
								data-key-feedback-active={keyFeedback?.active ? 'true' : undefined}
								data-key-home={highlightHomeKeys && isHomeKey(key) ? 'true' : undefined}
								data-key-next={isHighlightedKey(key.char) ? 'true' : undefined}
								title={keyFeedback?.value ? `${key.char} emits ${keyFeedback.value}` : undefined}
							>
								{@render keyContent(key, keyFeedback)}
							</span>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.keyboard-preview {
		--preview-key-size: clamp(2.35rem, 4.7vw, 3.35rem);
		--preview-key-gap: clamp(0.25rem, 0.65vw, 0.45rem);
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
		stroke: var(--accent);
		stroke-width: 3;
		stroke-linecap: round;
		filter: drop-shadow(0 0 0.2rem color-mix(in srgb, var(--accent) 52%, transparent));
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

	.keyboard-preview__key--ansi-thumb {
		position: absolute;
		top: 0;
	}

	.keyboard-preview__key,
	.keyboard-preview__key-placeholder {
		width: var(--preview-key-size);
		height: var(--preview-key-size);
		flex: 0 0 var(--preview-key-size);
	}

	.keyboard-preview__key {
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

	.keyboard-preview__magic-icon {
		display: inline-flex;
		width: clamp(1.05rem, 2.2vw, 1.35rem);
		height: clamp(1.05rem, 2.2vw, 1.35rem);
		align-items: center;
		justify-content: center;
		color: var(--accent);
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
		border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--accent) 35%, var(--bg-primary)) 0%,
			color-mix(in srgb, var(--accent) 20%, var(--bg-primary)) 100%
		);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, white 20%, transparent),
			0 2px 0 color-mix(in srgb, var(--accent) 42%, black),
			0 0 0.5rem color-mix(in srgb, var(--accent) 22%, transparent);
		font-size: clamp(0.65rem, 1.45vw, 1rem);
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.keyboard-preview__key--next {
		border-color: var(--typing-practice-next-key-decoration);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--typing-practice-next-key-decoration) 16%, var(--bg-primary)) 0%,
			color-mix(in srgb, var(--typing-practice-next-key-decoration) 8%, var(--bg-primary)) 100%
		);
		box-shadow:
			inset 0 0 0 1px var(--typing-practice-next-key-decoration),
			0 2px 0 color-mix(in srgb, var(--typing-practice-next-key-decoration) 58%, black),
			0 0 0.75rem color-mix(in srgb, var(--typing-practice-next-key-decoration) 42%, transparent);
	}
</style>
