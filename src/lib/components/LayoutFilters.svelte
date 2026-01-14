<script lang="ts">
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		filterStore,
		type ThumbKeyFilter,
		type MagicKeyFilter,
		type CharacterSetFilter,
		type BoardTypeFilter
	} from '$lib/filterStore.svelte';

	interface Props {
		authorList: Array<{ id: number; name: string }>;
		filteredCount: number;
	}

	const { authorList, filteredCount }: Props = $props();
</script>

<!-- Name Search & Author Filter -->
<div class="grid gap-4 sm:grid-cols-2 mb-4">
	<div>
		<label
			for="name-filter"
			class="block text-sm mb-2 truncate"
			style="color: var(--text-secondary);"
		>
			Layout name
			<span class="text-[10px] italic" style="color: var(--text-caption);">
				(use commas for multiple terms)
			</span>
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
<!-- Filters grid: Responsive layout using CSS Grid -->
<div class="filters-grid gap-4 mb-4">
	<div class="grid-area-include-and">
		<KeyPositionFilter
			label="Include keys (AND)"
			grid={filterStore.includeGrid}
			thumbKeys={filterStore.includeThumbKeys}
			hideThumbKeys={filterStore.thumbKeyFilter === 'excluded'}
			accentColor="#4ade80"
			onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
			onThumbKeyChange={(index, value) => filterStore.setIncludeThumbKey(index, value)}
			onClear={() => filterStore.clearInclude()}
			tooltipText="Use this filter to find layouts that include desired keys in specific row and column positions. All specified positions must match (AND logic). You can specify multiple keys in the same field to return layouts that include any of those keys at that position."
		/>
	</div>
	<div class="grid-area-include-or">
		<KeyPositionFilter
			label="Include keys (OR)"
			grid={filterStore.includeOrGrid}
			hideThumbKeys={true}
			accentColor="#60a5fa"
			onCellChange={(row, col, value) => filterStore.setIncludeOrCell(row, col, value)}
			onClear={() => filterStore.clearIncludeOr()}
			tooltipText="Use this filter to find layouts where at least one of the specified positions matches (OR logic). For example, if you specify E at left middle finger OR E at right middle finger, it will match all layouts where E is at either location."
		/>
	</div>
	<div class="grid-area-exclude">
		<KeyPositionFilter
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
		class="p-4 rounded-xl grid-area-other-options flex flex-col items-center"
		style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
	>
		<div class="flex flex-wrap items-start gap-x-6 gap-y-4">
			<label class="flex flex-col items-start gap-1 select-none w-40">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
					>Thumb keys:</span
				>
				<select
					value={filterStore.thumbKeyFilter}
					onchange={(e) => filterStore.setThumbKeyFilter(e.currentTarget.value as ThumbKeyFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.thumbKeyFilter !== 'optional' ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>

			<label class="flex flex-col items-start gap-1 select-none w-40">
				<span
					class="text-sm flex items-center gap-1 whitespace-nowrap"
					style="color: var(--text-secondary);"
				>
					Magic key
					<Tooltip
						text="A magic key is a key that has custom functionality. For example, it can change its letter based on the preceeding key pressed. Since a magic key's functionality is not standardized, resources outside this explorer are required to understand its functionality."
					/>
					:
				</span>
				<select
					value={filterStore.magicKeyFilter}
					onchange={(e) => filterStore.setMagicKeyFilter(e.currentTarget.value as MagicKeyFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.magicKeyFilter !== 'optional' ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>

			<label class="flex flex-col items-start gap-1 select-none w-40">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
					>Board type:</span
				>
				<select
					value={filterStore.boardTypeFilter}
					onchange={(e) => filterStore.setBoardTypeFilter(e.currentTarget.value as BoardTypeFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.boardTypeFilter !== 'all' ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="all">All</option>
					<option value="angle">Angle</option>
					<option value="stagger">Stagger</option>
					<option value="ortho">Ortho</option>
					<option value="mini">Mini</option>
				</select>
			</label>

			<label class="flex flex-col items-start gap-1 select-none w-44">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
					>Character set:</span
				>
				<select
					value={filterStore.characterSetFilter}
					onchange={(e) =>
						filterStore.setCharacterSetFilter(e.currentTarget.value as CharacterSetFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {filterStore.characterSetFilter !== 'english'
						? 'var(--accent)'
						: 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="all">All</option>
					<option value="english">English</option>
					<option value="international">International</option>
				</select>
			</label>

			<label
				class="flex items-center gap-2 select-none w-44 mt-5"
				class:cursor-pointer={filterStore.characterSetFilter !== 'international'}
			>
				<span class="relative">
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
							class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
							style="color: white;"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<span
					class="text-sm flex items-center gap-1 whitespace-nowrap"
					class:line-through={filterStore.characterSetFilter === 'international'}
					style="color: var(--text-secondary);"
				>
					Show unfinished layouts
					<Tooltip
						text="Unfinished layouts are English-character-set layouts (without a magic key) that don't have all letters (A-Z) assigned to a key."
					/>
				</span>
			</label>
		</div>
	</div>
</div>

<div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
	<p style="color: var(--text-secondary);">
		Showing <span style="color: var(--accent); font-weight: 600;">{filteredCount}</span> layouts
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

<style>
	.filters-grid {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-areas:
			'includeAnd'
			'includeOr'
			'exclude'
			'otherOptions';
	}

	@media (min-width: 890px) {
		.filters-grid {
			grid-template-columns: repeat(2, 1fr);
			grid-template-areas:
				'includeAnd includeOr'
				'exclude otherOptions';
		}
	}

	@media (min-width: 1280px) {
		.filters-grid {
			grid-template-columns: repeat(3, 1fr);
			grid-template-areas:
				'includeAnd includeOr exclude'
				'otherOptions otherOptions otherOptions';
		}
	}

	.grid-area-include-and {
		grid-area: includeAnd;
		display: flex;
		flex-direction: column;
	}

	.grid-area-include-or {
		grid-area: includeOr;
		display: flex;
		flex-direction: column;
	}

	.grid-area-exclude {
		grid-area: exclude;
		display: flex;
		flex-direction: column;
	}

	.grid-area-other-options {
		grid-area: otherOptions;
		display: flex;
		flex-direction: column;
	}

	.grid-area-include-and > :global(*) {
		flex: 1;
	}

	.grid-area-include-or > :global(*) {
		flex: 1;
	}

	.grid-area-exclude > :global(*) {
		flex: 1;
	}
</style>
