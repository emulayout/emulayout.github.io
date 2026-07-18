<script lang="ts">
	import Tooltip from './Tooltip.svelte';
	import { isHomeKeySlot, SPLIT_COL } from '$lib/cmini/keyboard';

	const THUMB_KEYS_PER_HAND = 4;
	const DEFAULT_THUMB_SLOTS_PER_HAND = 2;

	/** Show 2 slots by default; add one more when all visible slots on that hand are filled (max 4). */
	function visibleThumbSlotCount(keys: readonly string[]): number {
		const maxFilledIndex = keys.reduce((max, key, index) => (key !== '' ? index : max), -1);

		let visible = DEFAULT_THUMB_SLOTS_PER_HAND;
		while (visible < THUMB_KEYS_PER_HAND && keys.slice(0, visible).every((key) => key !== '')) {
			visible++;
		}

		if (maxFilledIndex >= visible) {
			visible = Math.min(maxFilledIndex + 1, THUMB_KEYS_PER_HAND);
		}

		return visible;
	}

	interface Props {
		label?: string;
		grid: string[][];
		leftThumbKeys?: string[];
		rightThumbKeys?: string[];
		accentColor?: string;
		hideThumbKeys?: boolean;
		tooltipText?: string;
		/** When true, render the grid only (no panel chrome or header). */
		nested?: boolean;
		/** Smaller cells/gaps for narrow side panels. */
		compact?: boolean;
		onCellChange?: (row: number, col: number, value: string) => void;
		onLeftThumbKeyChange?: (index: number, value: string) => void;
		onRightThumbKeyChange?: (index: number, value: string) => void;
		onClear?: () => void;
	}

	let {
		label = '',
		grid,
		leftThumbKeys = Array.from({ length: THUMB_KEYS_PER_HAND }, () => ''),
		rightThumbKeys = Array.from({ length: THUMB_KEYS_PER_HAND }, () => ''),
		accentColor = 'var(--accent)',
		hideThumbKeys = false,
		tooltipText = 'Placeholder tooltip text - please fill in with helpful instructions',
		nested = false,
		compact = false,
		onCellChange,
		onLeftThumbKeyChange,
		onRightThumbKeyChange,
		onClear
	}: Props = $props();

	function handleInput(rowIdx: number, colIdx: number, event: Event) {
		const input = event.target as HTMLInputElement;
		onCellChange?.(rowIdx, colIdx, input.value);
	}

	function handleClear() {
		onClear?.();
	}

	const hasActiveFilters = $derived(
		grid.some((row) => row.some((cell) => cell !== '')) ||
			leftThumbKeys.some((key) => key !== '') ||
			rightThumbKeys.some((key) => key !== '')
	);

	const leftThumbVisibleCount = $derived(visibleThumbSlotCount(leftThumbKeys));
	const rightThumbVisibleCount = $derived(visibleThumbSlotCount(rightThumbKeys));

	/** Rem widths so every cell in a column matches the widest content in that column. */
	const columnWidthsRem = $derived.by(() => {
		const colCount = grid[0]?.length ?? 0;
		const charRem = compact ? 0.52 : 0.6;
		const padRem = compact ? 0.58 : 0.8;
		const minLen = compact ? 1.6 : 2;
		const widths: number[] = [];
		for (let col = 0; col < colCount; col++) {
			let maxLen = minLen;
			for (const row of grid) {
				const len = row[col]?.length ?? 0;
				if (len > maxLen) maxLen = len;
			}
			widths.push(maxLen * charRem + padRem);
		}
		return widths;
	});

	function keyBackgroundColor(rowIdx: number, colIdx: number): string {
		return isHomeKeySlot(rowIdx, colIdx) ? 'var(--key-home-bg)' : 'var(--key-bg)';
	}

	function cellInputStyle(rowIdx: number, colIdx: number): string {
		const fallback = compact ? 1.4 : 2;
		return `
			width: ${columnWidthsRem[colIdx] ?? fallback}rem;
			background-color: ${keyBackgroundColor(rowIdx, colIdx)};
			color: var(--text-primary);
			border: 1px solid var(--border);
			--tw-ring-color: ${accentColor};
		`;
	}

	function thumbInputStyle(key: string): string {
		const charRem = compact ? 0.52 : 0.6;
		const padRem = compact ? 0.58 : 0.8;
		const minLen = compact ? 1.6 : 2;
		return `
			width: ${Math.max(minLen, key.length) * charRem + padRem}rem;
			background-color: var(--key-bg);
			color: var(--text-primary);
			border: 1px solid var(--border);
			--tw-ring-color: ${accentColor};
		`;
	}
</script>

<div
	class="key-filter flex flex-col items-center"
	class:key-filter--nested={nested}
	class:key-filter--compact={compact}
	style={nested ? undefined : 'background-color: var(--bg-secondary); border: 1px solid var(--border);'}
>
	<div class="key-filter-grid flex flex-col font-mono">
		{#if !nested}
			<div class="filter-section-header w-full">
				<div class="filter-section-header-start">
					<span class="filter-section-header-label">{label}</span>
					<Tooltip text={tooltipText} />
				</div>
				{#if hasActiveFilters}
					<button
						onclick={handleClear}
						class="text-xs px-2 py-1 rounded transition-colors inline-flex shrink-0"
						style="color: {accentColor}; background-color: var(--bg-primary);"
					>
						Clear
					</button>
				{/if}
			</div>
		{/if}
		{#each grid as row, rowIdx (rowIdx)}
			<div class="key-filter-row flex">
				{#each row as cell, colIdx (`${rowIdx}-${colIdx}`)}
					{#if colIdx === SPLIT_COL}
						<div class="key-filter-split shrink-0"></div>
					{/if}
					<input
						type="text"
						value={cell}
						oninput={(e) => handleInput(rowIdx, colIdx, e)}
						class="key-filter-cell text-center rounded transition-all duration-200 outline-none focus:ring-2"
						style={cellInputStyle(rowIdx, colIdx)}
						placeholder="·"
					/>
				{/each}
			</div>
		{/each}

		{#if !hideThumbKeys}
			<div class="key-filter-thumbs w-full" style="border-top: 1px solid var(--border);">
				<p class="key-filter-thumbs-note italic" style="color: var(--text-caption);">
					Thumb keys — filter in order (not by column)
				</p>
				<div class="key-filter-row flex">
					<div class="flex justify-end flex-1 min-w-0 key-filter-thumb-hand">
						{#each { length: leftThumbVisibleCount } as _, idx (idx)}
							<input
								type="text"
								value={leftThumbKeys[idx]}
								oninput={(e) => onLeftThumbKeyChange?.(idx, e.currentTarget.value)}
								class="key-filter-cell key-filter-thumb-cell text-center rounded transition-all duration-200 outline-none focus:ring-2"
								style={thumbInputStyle(leftThumbKeys[idx])}
								placeholder="·"
								aria-label={`Left thumb key ${idx + 1}`}
							/>
						{/each}
					</div>
					<div class="key-filter-split shrink-0"></div>
					<div class="flex flex-1 min-w-0 key-filter-thumb-hand">
						{#each { length: rightThumbVisibleCount } as _, idx (idx)}
							<input
								type="text"
								value={rightThumbKeys[idx]}
								oninput={(e) => onRightThumbKeyChange?.(idx, e.currentTarget.value)}
								class="key-filter-cell key-filter-thumb-cell text-center rounded transition-all duration-200 outline-none focus:ring-2"
								style={thumbInputStyle(rightThumbKeys[idx])}
								placeholder="·"
								aria-label={`Right thumb key ${idx + 1}`}
							/>
						{/each}
					</div>
				</div>
				<div class="key-filter-thumb-labels flex" style="color: var(--text-caption);">
					<span class="flex-1 text-right pr-1">Left thumb</span>
					<div class="key-filter-split shrink-0"></div>
					<span class="flex-1 pl-1">Right thumb</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.key-filter {
		padding: 0.75rem;
		border-radius: 0.75rem;
		height: 100%;
	}

	.key-filter--nested {
		padding: 0;
		border-radius: 0;
		height: auto;
	}

	.key-filter-grid {
		gap: 0.25rem;
	}

	.key-filter-row,
	.key-filter-thumb-hand {
		gap: 0.25rem;
	}

	.key-filter-split {
		width: 0.75rem;
	}

	.key-filter-cell {
		height: 2rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.key-filter-thumb-cell {
		width: 2rem;
		min-width: 2rem;
	}

	.key-filter-thumbs {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
	}

	.key-filter-thumbs-note {
		margin: 0 0 0.5rem;
		font-size: 0.625rem;
		line-height: 1;
	}

	.key-filter-thumb-labels {
		margin-top: 0.25rem;
		gap: 0.25rem;
		font-size: 0.5625rem;
		line-height: 1;
	}

	.key-filter--compact .key-filter-grid {
		gap: 0.15rem;
	}

	.key-filter--compact .key-filter-row,
	.key-filter--compact .key-filter-thumb-hand {
		gap: 0.15rem;
	}

	.key-filter--compact .key-filter-split {
		width: 0.4375rem;
	}

	.key-filter--compact .key-filter-cell {
		height: 1.625rem;
		font-size: 0.78125rem;
		line-height: 1.0625rem;
		border-radius: 0.4rem;
	}

	.key-filter--compact .key-filter-thumb-cell {
		width: 1.625rem;
		min-width: 1.625rem;
	}

	.key-filter--compact .key-filter-thumbs {
		margin-top: 0.4rem;
		padding-top: 0.4rem;
	}

	.key-filter--compact .key-filter-thumbs-note {
		margin-bottom: 0.4rem;
		font-size: 0.5625rem;
	}

	.key-filter--compact .key-filter-thumb-labels {
		font-size: 0.5rem;
	}
</style>
