<script lang="ts">
	const ROWS = 3;
	const COLS = 10;
	const SPLIT_COL = 5;

	interface Props {
		label: string;
		grid: string[][];
		accentColor?: string;
	}

	let { label, grid = $bindable(), accentColor = 'var(--accent)' }: Props = $props();

	function clear() {
		grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
	}

	const hasActiveFilters = $derived(grid.some((row) => row.some((cell) => cell !== '')));
</script>

<div
	class="p-4 rounded-xl"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="flex items-center justify-between mb-3">
		<span class="text-sm font-medium" style="color: var(--text-secondary);">{label}</span>
		{#if hasActiveFilters}
			<button
				onclick={clear}
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
				{#each row as _, colIdx}
					{#if colIdx === SPLIT_COL}
						<div class="w-3"></div>
					{/if}
					<input
						type="text"
						maxlength="1"
						bind:value={grid[rowIdx][colIdx]}
						class="size-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
						style="
							background-color: var(--key-bg);
							color: var(--text-primary);
							border: 1px solid {grid[rowIdx][colIdx] ? accentColor : 'var(--border)'};
							--tw-ring-color: {accentColor};
						"
						placeholder="·"
					/>
				{/each}
			</div>
		{/each}
	</div>
</div>

