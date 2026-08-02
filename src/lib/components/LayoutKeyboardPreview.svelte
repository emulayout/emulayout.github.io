<script lang="ts">
	import type { LayoutData } from '$lib/layout';
	import { thumbTargetColumns, type DisplayCell } from '$lib/layoutDisplay';

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
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

	const { layout, rows }: Props = $props();
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
</script>

<div
	class="keyboard-preview"
	role="img"
	aria-label={`${layout.name} keyboard preview`}
	data-board={layout.board}
	data-geometry={orthoGeometry ? 'ortho' : 'ansi'}
>
	<div class="keyboard-preview__board" aria-hidden="true">
		<div class="keyboard-preview__keys">
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
									<span class="keyboard-preview__key" data-key-column={slot.column}
										>{slot.key.char}</span
									>
								{:else}
									<span class="keyboard-preview__key-placeholder" data-key-column={slot.column}
									></span>
								{/if}
							{/each}
						</div>
						<div class="keyboard-preview__half keyboard-preview__half--right">
							{#each row.rightSlots as slot (slot.column)}
								{#if slot.key}
									<span class="keyboard-preview__key" data-key-column={slot.column}
										>{slot.key.char}</span
									>
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
							<span
								class="keyboard-preview__key keyboard-preview__key--ansi-thumb"
								data-thumb-column={thumb.column}
								style={`left: ${ansiThumbOffset(thumb.column)};`}>{thumb.key.char}</span
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
							<span class="keyboard-preview__key">{key.char}</span>
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
		width: max-content;
		margin-inline: auto;
		padding-block: 0.125rem 0.3rem;
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
</style>
