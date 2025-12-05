<script lang="ts">
	import { printPretty, type LayoutData } from '$lib/printPretty';
	import FilterGrid from '$lib/components/FilterGrid.svelte';

	const layoutModules = import.meta.glob<{ default: LayoutData }>('$lib/layouts/*.json', {
		eager: true
	});

	const layouts: LayoutData[] = Object.values(layoutModules).map((mod) => mod.default);

	let hideEmpty = $state(true);

	// Filter grids: 3 rows, 10 columns
	const ROWS = 3;
	const COLS = 10;

	function createEmptyGrid(): string[][] {
		return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
	}

	let includeGrid: string[][] = $state(createEmptyGrid());
	let excludeGrid: string[][] = $state(createEmptyGrid());

	// Get key at a specific position in a layout
	function getKeyAt(layout: LayoutData, row: number, col: number): string | undefined {
		for (const [key, info] of Object.entries(layout.keys)) {
			if (info.row === row && info.col === col) return key;
		}
		return undefined;
	}

	// Check if layout matches include filter (must have these keys at positions)
	function matchesInclude(layout: LayoutData): boolean {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChar = includeGrid[row][col].toLowerCase();
				if (filterChar) {
					const keyAtPos = getKeyAt(layout, row, col);
					if (keyAtPos?.toLowerCase() !== filterChar) return false;
				}
			}
		}
		return true;
	}

	// Check if layout matches exclude filter (must NOT have these keys at positions)
	function matchesExclude(layout: LayoutData): boolean {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const filterChar = excludeGrid[row][col].toLowerCase();
				if (filterChar) {
					const keyAtPos = getKeyAt(layout, row, col);
					if (keyAtPos?.toLowerCase() === filterChar) return false;
				}
			}
		}
		return true;
	}

	const filteredLayouts = $derived(
		layouts.filter((l) => {
			if (hideEmpty && Object.keys(l.keys).length === 0) return false;
			return matchesInclude(l) && matchesExclude(l);
		})
	);
</script>

<div class="max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-2 tracking-tight" style="color: var(--text-primary);">
		Keyboard Layout Viewer
	</h1>

	<!-- Filter Grids -->
	<div class="grid gap-4 md:grid-cols-2 mb-6">
		<FilterGrid label="Include (must have)" bind:grid={includeGrid} accentColor="#4ade80" />
		<FilterGrid label="Exclude (must not have)" bind:grid={excludeGrid} accentColor="#f87171" />
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
