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
		const widths: number[] = [];
		for (let col = 0; col < colCount; col++) {
			let maxLen = 2;
			for (const row of grid) {
				const len = row[col]?.length ?? 0;
				if (len > maxLen) maxLen = len;
			}
			widths.push(maxLen * 0.6 + 0.8);
		}
		return widths;
	});

	function keyBackgroundColor(rowIdx: number, colIdx: number): string {
		return isHomeKeySlot(rowIdx, colIdx) ? 'var(--key-home-bg)' : 'var(--key-bg)';
	}

	function cellInputStyle(rowIdx: number, colIdx: number, cell: string): string {
		return `
			width: ${columnWidthsRem[colIdx] ?? 2}rem;
			background-color: ${keyBackgroundColor(rowIdx, colIdx)};
			color: var(--text-primary);
			border: 1px solid ${cell ? accentColor : 'var(--border)'};
			--tw-ring-color: ${accentColor};
		`;
	}

	function thumbInputStyle(key: string): string {
		return `
			width: ${Math.max(2, key.length) * 0.6 + 0.8}rem;
			background-color: var(--key-bg);
			color: var(--text-primary);
			border: 1px solid ${key ? accentColor : 'var(--border)'};
			--tw-ring-color: ${accentColor};
		`;
	}
</script>

<div
	class="key-filter flex flex-col items-center"
	class:key-filter--nested={nested}
	style={nested ? undefined : 'background-color: var(--bg-secondary); border: 1px solid var(--border);'}
>
	<div class="flex flex-col gap-1 font-mono">
		{#if !nested}
			<div class="flex items-center justify-between mb-2 w-full gap-2">
				<div class="flex items-center gap-1.5 min-w-0">
					<span class="text-sm font-medium" style="color: var(--text-secondary);">{label}</span>
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
			<div class="flex gap-1">
				{#each row as cell, colIdx (`${rowIdx}-${colIdx}`)}
					{#if colIdx === SPLIT_COL}
						<div class="w-3"></div>
					{/if}
					<input
						type="text"
						value={cell}
						oninput={(e) => handleInput(rowIdx, colIdx, e)}
						class="h-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
						style={cellInputStyle(rowIdx, colIdx, cell)}
						placeholder="·"
					/>
				{/each}
			</div>
		{/each}

		{#if !hideThumbKeys}
			<div class="mt-2 pt-2 w-full" style="border-top: 1px solid var(--border);">
				<p class="text-[10px] mb-2 italic" style="color: var(--text-caption);">
					Thumb keys — filter in order (not by column)
				</p>
				<div class="flex gap-1">
					<div class="flex gap-1 justify-end flex-1 min-w-0">
						{#each { length: leftThumbVisibleCount } as _, idx (idx)}
							<input
								type="text"
								value={leftThumbKeys[idx]}
								oninput={(e) => onLeftThumbKeyChange?.(idx, e.currentTarget.value)}
								class="w-8 min-w-8 h-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
								style={thumbInputStyle(leftThumbKeys[idx])}
								placeholder="·"
								aria-label={`Left thumb key ${idx + 1}`}
							/>
						{/each}
					</div>
					<div class="w-3 shrink-0"></div>
					<div class="flex gap-1 flex-1 min-w-0">
						{#each { length: rightThumbVisibleCount } as _, idx (idx)}
							<input
								type="text"
								value={rightThumbKeys[idx]}
								oninput={(e) => onRightThumbKeyChange?.(idx, e.currentTarget.value)}
								class="w-8 min-w-8 h-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
								style={thumbInputStyle(rightThumbKeys[idx])}
								placeholder="·"
								aria-label={`Right thumb key ${idx + 1}`}
							/>
						{/each}
					</div>
				</div>
				<div class="flex gap-1 mt-1 text-[9px]" style="color: var(--text-caption);">
					<span class="flex-1 text-right pr-1">Left thumb</span>
					<div class="w-3 shrink-0"></div>
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
</style>
