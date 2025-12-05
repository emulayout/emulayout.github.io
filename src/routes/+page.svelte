<script lang="ts">
	import { printPretty, type LayoutData } from '$lib/printPretty';

	const layoutModules = import.meta.glob<{ default: LayoutData }>('$lib/layouts/*.json', {
		eager: true
	});

	const layouts: LayoutData[] = Object.values(layoutModules).map((mod) => mod.default);

	let hideEmpty = $state(true);

	// Filter grid: 3 rows, 10 columns
	const ROWS = 3;
	const COLS = 10;
	const SPLIT_COL = 5;

	// Initialize filter grid state
	let filterGrid: string[][] = $state(
		Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''))
	);

	// Get key at a specific position in a layout
	function getKeyAt(layout: LayoutData, row: number, col: number): string | undefined {
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info.row === row && info.col === col) return key;
		}
		return undefined;
	}

	// Check if layout matches all filter criteria
	function matchesFilter(layout: LayoutData): boolean {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChar = filterGrid[row][col].toLowerCase();
				if (filterChar) {
					const keyAtPos = getKeyAt(layout, row, col);
					if (keyAtPos?.toLowerCase() !== filterChar) return false;
				}
			}
		}
		return true;
	}

	const filteredLayouts = $derived(
		layouts.filter((l) => {
			if (hideEmpty && Object.keys(l.keys).length === 0) return false;
			return matchesFilter(l);
		})
	);

	function clearFilters() {
		filterGrid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
	}

	const hasActiveFilters = $derived(filterGrid.some((row) => row.some((cell) => cell !== '')));
</script>

<div class="max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-2 tracking-tight" style="color: var(--text-primary);">
		Keyboard Layout Viewer
	</h1>

	<!-- Filter Grid -->
	<div
		class="p-4 rounded-xl mb-6"
		style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
	>
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm font-medium" style="color: var(--text-secondary);"
				>Filter by position</span
			>
			{#if hasActiveFilters}
				<button
					onclick={clearFilters}
					class="text-xs px-2 py-1 rounded transition-colors"
					style="color: var(--accent); background-color: var(--bg-primary);"
				>
					Clear filters
				</button>
			{/if}
		</div>

		<div class="flex flex-col gap-1 font-mono">
			{#each filterGrid as row, rowIdx}
				<div class="flex gap-1">
					{#each row as _, colIdx}
						{#if colIdx === SPLIT_COL}
							<div class="w-3"></div>
						{/if}
						<input
							type="text"
							maxlength="1"
							bind:value={filterGrid[rowIdx][colIdx]}
							class="size-8 text-center text-sm rounded transition-all duration-200 outline-none focus:ring-2"
							style="
								background-color: var(--key-bg);
								color: var(--text-primary);
								border: 1px solid {filterGrid[rowIdx][colIdx] ? 'var(--accent)' : 'var(--border)'};
								--tw-ring-color: var(--accent);
							"
							placeholder="·"
						/>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<div class="flex items-center justify-between mb-8">
		<p style="color: var(--text-secondary);">
			Showing <span style="color: var(--accent); font-weight: 600;">{filteredLayouts.length}</span> layouts
		</p>

		<label class="flex items-center gap-2 cursor-pointer select-none">
			<input type="checkbox" bind:checked={hideEmpty} class="size-4 rounded accent-(--accent)" />
			<span class="text-sm" style="color: var(--text-secondary);">Hide empty layouts</span>
		</label>
	</div>

	<div class="grid gap-6 md:grid-cols-2">
		{#each filteredLayouts as layout (layout.name)}
			<div
				class="p-5 rounded-xl transition-all duration-300"
				style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
			>
				<h2 class="text-lg font-semibold mb-1" style="color: var(--text-primary);">
					{layout.name}
				</h2>
				<p class="text-xs mb-3" style="color: var(--text-secondary);">
					{layout.board}
				</p>
				<pre
					class="font-mono text-xs leading-relaxed tracking-widest"
					style="color: var(--text-primary);">{printPretty(layout)}</pre>
			</div>
		{/each}
	</div>
</div>
