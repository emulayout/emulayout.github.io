<script lang="ts">
	import Tooltip from './Tooltip.svelte';

	const SPLIT_COL = 5;

	interface Props {
		label: string;
		grid: string[][];
		thumbKeys?: string[];
		accentColor?: string;
		hideThumbKeys?: boolean;
		tooltipText?: string;
		onCellChange?: (row: number, col: number, value: string) => void;
		onThumbKeyChange?: (index: number, value: string) => void;
		onClear?: () => void;
	}

	let {
		label,
		grid,
		thumbKeys = ['', '', '', ''],
		accentColor = 'var(--accent)',
		hideThumbKeys = false,
		tooltipText = 'Placeholder tooltip text - please fill in with helpful instructions',
		onCellChange,
		onThumbKeyChange,
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
		grid.some((row) => row.some((cell) => cell !== '')) || thumbKeys.some((key) => key !== '')
	);
</script>

<div
	class="p-4 rounded-xl flex flex-col items-center"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="flex flex-col gap-1 font-mono">
		<div class="flex items-center justify-between mb-3 w-full gap-3">
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
		{#each grid as row, rowIdx}
			<div class="flex gap-1">
				{#each row as cell, colIdx}
					{#if colIdx === SPLIT_COL}
						<div class="w-3"></div>
					{/if}
					<input
						type="text"
						value={cell}
						oninput={(e) => handleInput(rowIdx, colIdx, e)}
						class="w-8 min-w-8 h-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
						style="
							width: {Math.max(2, cell.length) * 0.6 + 0.8}rem;
							background-color: var(--key-bg);
							color: var(--text-primary);
							border: 1px solid {cell ? accentColor : 'var(--border)'};
							--tw-ring-color: {accentColor};
						"
						placeholder="·"
					/>
				{/each}
			</div>
		{/each}

		<!-- Thumb keys row (row 3) - 4 inputs -->
		{#if !hideThumbKeys}
			<div class="mt-2 pt-2" style="border-top: 1px solid var(--border);">
				<p class="text-[10px] mb-2 italic" style="color: var(--text-caption);">
					Thumb keys (only filter by order, not column position)
				</p>
				<div class="flex gap-2">
					{#each thumbKeys as key, idx}
						<input
							type="text"
							value={key}
							oninput={(e) => onThumbKeyChange?.(idx, e.currentTarget.value)}
							class="w-8 min-w-8 h-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
							style="
								width: {Math.max(2, key.length) * 0.6 + 0.8}rem;
								background-color: var(--key-bg);
								color: var(--text-primary);
								border: 1px solid {key ? accentColor : 'var(--border)'};
								--tw-ring-color: {accentColor};
							"
							placeholder="·"
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
