<script lang="ts">
	import type { LayoutData } from '$lib/layout';
	import FilterGrid from '$lib/components/FilterGrid.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import {
		filterStore,
		type ThumbKeyFilter,
		type MagicKeyFilter,
		type CharacterSetFilter
	} from '$lib/filterStore.svelte';

	const { data } = $props();
	const layouts = $derived(data.layouts);
	const authorsData = $derived(data.authorsData);

	// Create reverse lookup: user_id -> author_name
	const authorById = $derived(
		new Map<number, string>(Object.entries(authorsData).map(([name, id]) => [id as number, name]))
	);

	// Create sorted list of unique authors for the select
	const authorList = $derived(
		Array.from(authorById.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	function getAuthorName(userId: number): string {
		return authorById.get(userId) ?? 'Unknown';
	}

	const filteredLayouts = $derived(filterStore.filterLayouts(layouts));
</script>

<div class="max-w-5xl mx-auto">
	<!-- Name Search & Author Filter -->
	<div class="grid gap-4 md:grid-cols-2 mb-4">
		<div>
			<label for="name-filter" class="block text-sm mb-2" style="color: var(--text-secondary);">
				Layout name
			</label>
			<input
				id="name-filter"
				type="text"
				value={filterStore.nameFilterInput}
				oninput={(e) => filterStore.setNameFilter(e.currentTarget.value)}
				class="w-full px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 transition-all duration-200"
				style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.nameFilterInput ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				placeholder="All layouts"
			/>
		</div>
		<div>
			<div class="block text-sm mb-2" style="color: var(--text-secondary);">Author</div>
			<AuthorSelect
				authors={authorList}
				selectedIds={filterStore.selectedAuthors}
				onToggle={(id) => filterStore.toggleAuthor(id)}
				onClear={() => filterStore.clearAuthors()}
			/>
		</div>
	</div>

	<!-- Filter Grids -->
	<div class="grid gap-4 lg:grid-cols-2 mb-4">
		<FilterGrid
			label="Include keys"
			grid={filterStore.includeGrid}
			thumbKeys={filterStore.includeThumbKeys}
			hideThumbKeys={filterStore.thumbKeyFilter === 'excluded'}
			accentColor="#4ade80"
			onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
			onThumbKeyChange={(index, value) => filterStore.setIncludeThumbKey(index, value)}
			onClear={() => filterStore.clearInclude()}
			tooltipText="Use this filter to find layouts that include desired keys in specific row and column positions. You can specify multiple keys in the same field to return layouts that include any of the keys."
		/>
		<FilterGrid
			label="Exclude keys"
			grid={filterStore.excludeGrid}
			thumbKeys={filterStore.excludeThumbKeys}
			hideThumbKeys={filterStore.thumbKeyFilter === 'excluded'}
			accentColor="#f87171"
			onCellChange={(row, col, value) => filterStore.setExcludeCell(row, col, value)}
			onThumbKeyChange={(index, value) => filterStore.setExcludeThumbKey(index, value)}
			onClear={() => filterStore.clearExclude()}
			tooltipText="Use this filter to exclude layouts that include unwanted keys in specific row and column positions. You can specify multiple keys in the same field to return layouts that do not include any of the keys."
		/>
	</div>

	<div
		class="p-4 rounded-xl mb-6 flex flex-wrap items-center justify-center gap-6"
		style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
	>
		<label
			class="flex items-center gap-2 select-none relative"
			class:cursor-pointer={filterStore.characterSetFilter !== 'international'}
		>
			<input
				type="checkbox"
				checked={filterStore.showUnfinished}
				disabled={filterStore.characterSetFilter === 'international'}
				onchange={(e) => filterStore.setShowUnfinished(e.currentTarget.checked)}
				class="size-4 rounded appearance-none cursor-pointer relative"
				style="
					background-color: {filterStore.showUnfinished ? 'var(--accent)' : 'var(--bg-primary)'};
					border: 1px solid var(--border);
				"
			/>
			{#if filterStore.showUnfinished}
				<svg
					class="absolute size-4 pointer-events-none"
					style="left: 0; color: white;"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="3"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{/if}
			<span
				class="text-sm"
				class:line-through={filterStore.characterSetFilter === 'international'}
				style="color: var(--text-secondary);">Show unfinished layouts</span
			>
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

		<label class="flex items-center gap-2 select-none">
			<span class="text-sm" style="color: var(--text-secondary);">Magic key:</span>
			<select
				value={filterStore.magicKeyFilter}
				onchange={(e) => filterStore.setMagicKeyFilter(e.currentTarget.value as MagicKeyFilter)}
				class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer"
				style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.magicKeyFilter !== 'optional' ? 'var(--accent)' : 'var(--border)'};
				"
			>
				<option value="optional">Optional</option>
				<option value="excluded">Excluded</option>
				<option value="required">Required</option>
			</select>
		</label>

		<label class="flex items-center gap-2 select-none">
			<span class="text-sm" style="color: var(--text-secondary);">Character set:</span>
			<select
				value={filterStore.characterSetFilter}
				onchange={(e) =>
					filterStore.setCharacterSetFilter(e.currentTarget.value as CharacterSetFilter)}
				class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer"
				style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.characterSetFilter !== 'english'
					? 'var(--accent)'
					: 'var(--border)'};
				"
			>
				<option value="all">All</option>
				<option value="english">English</option>
				<option value="international">International</option>
			</select>
		</label>
	</div>

	<div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
		<p style="color: var(--text-secondary);">
			Showing <span style="color: var(--accent); font-weight: 600;">{filteredLayouts.length}</span> layouts
		</p>

		{#if filterStore.hasActiveFilters}
			<button
				onclick={() => filterStore.clearAll()}
				class="text-sm px-3 py-1.5 rounded-lg transition-colors"
				style="color: var(--accent); background-color: var(--bg-secondary); border: 1px solid var(--border);"
			>
				Reset filters
			</button>
		{/if}
	</div>

	<div class="grid gap-4 grid-cols-2 md:grid-cols-3">
		{#each filteredLayouts as layout (layout.name)}
			<div
				class="p-5 rounded-xl transition-all duration-300 min-w-0 overflow-hidden"
				style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
			>
				<h2 class="text-lg font-semibold mb-1" style="color: var(--text-primary);">
					{layout.name}
				</h2>
				<p class="text-xs mb-3" style="color: var(--text-secondary);">
					{layout.board} · by {getAuthorName(layout.user)}
				</p>
				<div class="overflow-x-auto -mx-5 px-5">
					<pre
						class="font-mono text-xs leading-relaxed tracking-widest whitespace-pre"
						style="color: var(--text-primary);">{layout.displayValue}</pre>
				</div>
			</div>
		{/each}
	</div>
</div>
