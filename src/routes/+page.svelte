<script lang="ts">
	import { printPretty, type LayoutData } from '$lib/printPretty';
	import FilterGrid from '$lib/components/FilterGrid.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import { filterStore, type ThumbKeyFilter } from '$lib/filterStore.svelte';
	import authorsData from '$lib/cmini/authors.json';

	const layoutModules = import.meta.glob<{ default: LayoutData }>('$lib/cmini/layouts/*.json', {
		eager: true
	});

	const layouts: LayoutData[] = Object.values(layoutModules).map((mod) => mod.default);

	// Create reverse lookup: user_id -> author_name
	const authorById = new Map<number, string>(
		Object.entries(authorsData).map(([name, id]) => [id as number, name])
	);

	// Create sorted list of unique authors for the select
	const authorList = Array.from(authorById.entries())
		.map(([id, name]) => ({ id, name }))
		.sort((a, b) => a.name.localeCompare(b.name));

	function getAuthorName(userId: number): string {
		return authorById.get(userId) ?? 'Unknown';
	}

	const filteredLayouts = $derived(filterStore.filterLayouts(layouts));
</script>

<div class="max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-2 tracking-tight" style="color: var(--text-primary);">
		Keyboard Layout Viewer
	</h1>

	<!-- Name Search & Author Filter -->
	<div class="grid gap-4 md:grid-cols-2 mb-4">
		<input
			type="text"
			placeholder="Search by layout name..."
			value={filterStore.nameFilterInput}
			oninput={(e) => filterStore.setNameFilter(e.currentTarget.value)}
			class="w-full px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 transition-all duration-200"
			style="
				background-color: var(--bg-secondary);
				color: var(--text-primary);
				border: 1px solid {filterStore.nameFilterInput ? 'var(--accent)' : 'var(--border)'};
				--tw-ring-color: var(--accent);
			"
		/>
		<AuthorSelect
			authors={authorList}
			selectedIds={filterStore.selectedAuthors}
			onToggle={(id) => filterStore.toggleAuthor(id)}
			onClear={() => filterStore.clearAuthors()}
		/>
	</div>

	<!-- Filter Grids -->
	<div class="grid gap-4 md:grid-cols-2 mb-4">
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

	{#if filterStore.hasActiveFilters}
		<div class="mb-6">
			<button
				onclick={() => filterStore.clearAll()}
				class="text-sm px-3 py-1.5 rounded-lg transition-colors"
				style="color: var(--accent); background-color: var(--bg-secondary); border: 1px solid var(--border);"
			>
				Reset all filters
			</button>
		</div>
	{/if}

	<div class="flex items-center justify-between mb-8">
		<p style="color: var(--text-secondary);">
			Showing <span style="color: var(--accent); font-weight: 600;">{filteredLayouts.length}</span> layouts
		</p>

		<div class="flex items-center gap-4">
			<label class="flex items-center gap-2 cursor-pointer select-none">
				<input
					type="checkbox"
					checked={filterStore.hideEmpty}
					onchange={(e) => filterStore.setHideEmpty(e.currentTarget.checked)}
					class="size-4 rounded accent-(--accent)"
				/>
				<span class="text-sm" style="color: var(--text-secondary);">Hide empty</span>
			</label>

			<label class="flex items-center gap-2 select-none">
				<span class="text-sm" style="color: var(--text-secondary);">Thumb keys:</span>
				<select
					value={filterStore.thumbKeyFilter}
					onchange={(e) => filterStore.setThumbKeyFilter(e.currentTarget.value as ThumbKeyFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer"
					style="
						background-color: var(--bg-secondary);
						color: var(--text-primary);
						border: 1px solid {filterStore.thumbKeyFilter !== 'optional' ? 'var(--accent)' : 'var(--border)'};
					"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>
		</div>
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
					{layout.board} · by {getAuthorName(layout.user)}
				</p>
				<pre
					class="font-mono text-xs leading-relaxed tracking-widest"
					style="color: var(--text-primary);">{printPretty(layout)}</pre>
			</div>
		{/each}
	</div>
</div>
