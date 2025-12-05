<script lang="ts">
	import { printPretty, type LayoutData } from '$lib/printPretty';
	import FilterGrid from '$lib/components/FilterGrid.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	const layoutModules = import.meta.glob<{ default: LayoutData }>('$lib/layouts/*.json', {
		eager: true
	});

	const layouts: LayoutData[] = Object.values(layoutModules).map((mod) => mod.default);

	const filteredLayouts = $derived(filterStore.filterLayouts(layouts));
</script>

<div class="max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-2 tracking-tight" style="color: var(--text-primary);">
		Keyboard Layout Viewer
	</h1>

	<!-- Filter Grids -->
	<div class="grid gap-4 md:grid-cols-2 mb-6">
		<FilterGrid
			label="Include (must have)"
			grid={filterStore.includeGrid}
			accentColor="#4ade80"
			onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
			onClear={() => filterStore.clearInclude()}
		/>
		<FilterGrid
			label="Exclude (must not have)"
			grid={filterStore.excludeGrid}
			accentColor="#f87171"
			onCellChange={(row, col, value) => filterStore.setExcludeCell(row, col, value)}
			onClear={() => filterStore.clearExclude()}
		/>
	</div>

	<div class="flex items-center justify-between mb-8">
		<p style="color: var(--text-secondary);">
			Showing <span style="color: var(--accent); font-weight: 600;">{filteredLayouts.length}</span> layouts
		</p>

		<label class="flex items-center gap-2 cursor-pointer select-none">
			<input
				type="checkbox"
				checked={filterStore.hideEmpty}
				onchange={(e) => filterStore.setHideEmpty(e.currentTarget.checked)}
				class="size-4 rounded accent-(--accent)"
			/>
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
