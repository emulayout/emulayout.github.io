<script lang="ts">
	const ROWS = 3;
	const COLS = 10;
	const SPLIT_COL = 5;

	interface Props {
		label: string;
		grid: string[][];
		thumbKeys?: string[];
		accentColor?: string;
		hideThumbKeys?: boolean;
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
	class="p-4 rounded-xl"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="flex items-center justify-between mb-3">
		<span class="text-sm font-medium" style="color: var(--text-secondary);">{label}</span>
		{#if hasActiveFilters}
			<button
				onclick={handleClear}
				class="text-xs px-2 py-1 rounded transition-colors"
				style="color: {accentColor}; background-color: var(--bg-primary);"
			>
				Clear
			</button>
		{/if}
	</div>

	<div class="flex flex-col gap-1 font-mono">
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
				<p class="text-[10px] mt-1" style="color: var(--text-secondary);">
					Thumb keys filter only by order, not column position
				</p>
			</div>
		{/if}
	</div>
</div>
