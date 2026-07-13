<script lang="ts">
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { SPLIT_COL } from '$lib/cmini/keyboard';
	import { filterStore } from '$lib/filterStore.svelte';

	function collectHandKeys(
		grid: string[][],
		leftThumbs: string[],
		rightThumbs: string[]
	): { left: string[]; right: string[] } {
		const left: string[] = [];
		const right: string[] = [];

		for (const row of grid) {
			for (let col = 0; col < row.length; col++) {
				const cell = row[col];
				if (!cell) continue;
				if (col < SPLIT_COL) left.push(cell);
				else right.push(cell);
			}
		}

		for (const key of leftThumbs) {
			if (key) left.push(key);
		}
		for (const key of rightThumbs) {
			if (key) right.push(key);
		}

		return { left, right };
	}

	function formatSection(
		label: string,
		grid: string[][],
		leftThumbs: string[],
		rightThumbs: string[]
	): string | null {
		const { left, right } = collectHandKeys(grid, leftThumbs, rightThumbs);
		if (left.length === 0 && right.length === 0) return null;

		const hands: string[] = [];
		if (left.length > 0) hands.push(`LH - ${left.join(',')}`);
		if (right.length > 0) hands.push(`RH: ${right.join(',')}`);
		return `${label}: ${hands.join(', ')}`;
	}

	let expanded = $derived(filterStore.keyFiltersExpanded);

	const hasActiveFilters = $derived(filterStore.hasActiveKeyFilters);

	const activeFilterSummary = $derived.by(() => {
		const parts = [
			formatSection(
				'AND',
				filterStore.includeGrid,
				filterStore.includeLeftThumbKeys,
				filterStore.includeRightThumbKeys
			),
			formatSection(
				'OR',
				filterStore.includeOrGrid,
				filterStore.includeOrLeftThumbKeys,
				filterStore.includeOrRightThumbKeys
			),
			formatSection(
				'Exclude',
				filterStore.excludeGrid,
				filterStore.excludeLeftThumbKeys,
				filterStore.excludeRightThumbKeys
			)
		].filter((part): part is string => part !== null);

		return parts.join(' • ');
	});
</script>

<div
	class="key-filters-panel"
	class:key-filters-panel--active={hasActiveFilters}
>
	<div
		class="key-filters-header"
		class:key-filters-header--collapsed={!expanded}
	>
		<button
			type="button"
			class="key-filters-toggle"
			aria-expanded={expanded}
			aria-controls="key-filters-content"
			onclick={() => filterStore.setKeyFiltersExpanded(!expanded)}
		>
			<span class="sr-only">Key filters</span>
		</button>
		<div class="key-filters-header-content">
			<span class="key-filters-title">
				<svg
					class="key-filters-chevron"
					class:key-filters-chevron--expanded={expanded}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M9 18l6-6-6-6" />
				</svg>
				<span class="text-sm font-medium" style="color: var(--text-secondary);">Key filters</span>
			</span>
			<div class="key-filters-help">
				<Tooltip
					text="Filter layouts by keys in specific positions. Include AND requires every filled position to match. Include OR matches if any filled position matches. Exclude removes layouts that place unwanted keys at the given positions."
				/>
			</div>
			{#if !expanded && activeFilterSummary}
				<p
					class="key-filters-summary"
					title={activeFilterSummary}
					style="color: var(--text-primary);"
				>
					{activeFilterSummary}
				</p>
			{/if}
			{#if hasActiveFilters}
				<button
					type="button"
					class="key-filters-clear"
					onclick={(e) => {
						e.stopPropagation();
						filterStore.clearKeyFilters();
					}}
				>
					Clear all
				</button>
			{/if}
		</div>
	</div>

	<div
		id="key-filters-content"
		class="key-filters-body"
		class:key-filters-body--expanded={expanded}
		aria-hidden={!expanded}
		inert={!expanded}
	>
		<div class="key-filters-body-inner">
			<div class="key-filters-grid">
				<KeyPositionFilter
					label="Include keys (AND)"
					grid={filterStore.includeGrid}
					leftThumbKeys={filterStore.includeLeftThumbKeys}
					rightThumbKeys={filterStore.includeRightThumbKeys}
					hideThumbKeys={filterStore.thumbKeyFilter === 'excluded'}
					accentColor="#4ade80"
					nested
					onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
					onLeftThumbKeyChange={(index, value) => filterStore.setIncludeLeftThumbKey(index, value)}
					onRightThumbKeyChange={(index, value) => filterStore.setIncludeRightThumbKey(index, value)}
					onClear={() => filterStore.clearInclude()}
					tooltipText="Use this filter to find layouts that include desired keys in specific row and column positions. All specified positions must match (AND logic). You can specify multiple keys in the same field to return layouts that include any of those keys at that position. Thumb keys are filtered separately per hand."
				/>
				<KeyPositionFilter
					label="Include keys (OR)"
					grid={filterStore.includeOrGrid}
					leftThumbKeys={filterStore.includeOrLeftThumbKeys}
					rightThumbKeys={filterStore.includeOrRightThumbKeys}
					hideThumbKeys={filterStore.thumbKeyFilter === 'excluded'}
					accentColor="#60a5fa"
					nested
					onCellChange={(row, col, value) => filterStore.setIncludeOrCell(row, col, value)}
					onLeftThumbKeyChange={(index, value) => filterStore.setIncludeOrLeftThumbKey(index, value)}
					onRightThumbKeyChange={(index, value) => filterStore.setIncludeOrRightThumbKey(index, value)}
					onClear={() => filterStore.clearIncludeOr()}
					tooltipText="Use this filter to find layouts where at least one specified position matches (OR logic). For example, E at left middle finger OR E at right middle finger. Thumb keys work the same way: e on the left thumb OR r on the right thumb."
				/>
				<KeyPositionFilter
					label="Exclude keys"
					grid={filterStore.excludeGrid}
					leftThumbKeys={filterStore.excludeLeftThumbKeys}
					rightThumbKeys={filterStore.excludeRightThumbKeys}
					hideThumbKeys={filterStore.thumbKeyFilter === 'excluded'}
					accentColor="#f87171"
					nested
					onCellChange={(row, col, value) => filterStore.setExcludeCell(row, col, value)}
					onLeftThumbKeyChange={(index, value) => filterStore.setExcludeLeftThumbKey(index, value)}
					onRightThumbKeyChange={(index, value) => filterStore.setExcludeRightThumbKey(index, value)}
					onClear={() => filterStore.clearExclude()}
					tooltipText="Use this filter to exclude layouts that include unwanted keys in specific row and column positions. You can specify multiple keys in the same field to return layouts that do not include any of the keys. Thumb keys are filtered separately per hand."
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.key-filters-panel {
		padding: 1rem;
		border-radius: 0.75rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border);
	}

	.key-filters-panel--active {
		border-color: var(--accent);
	}

	.key-filters-header {
		position: relative;
		margin: -1rem -1rem 0;
		padding: 1rem;
		min-width: 0;
	}

	.key-filters-header--collapsed {
		margin-bottom: -1rem;
	}

	.key-filters-toggle {
		position: absolute;
		inset: 0;
		z-index: 0;
		padding: 0;
		border: none;
		border-radius: 0.75rem 0.75rem 0 0;
		background: none;
		cursor: pointer;
		outline: none;
	}

	.key-filters-header--collapsed .key-filters-toggle {
		border-radius: 0.75rem;
	}

	.key-filters-toggle:focus-visible {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.key-filters-header-content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		min-width: 0;
		pointer-events: none;
	}

	.key-filters-title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.key-filters-chevron {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--text-secondary);
		transition: transform 0.2s ease;
	}

	.key-filters-chevron--expanded {
		transform: rotate(90deg);
	}

	.key-filters-summary {
		flex: 1 1 0;
		min-width: 0;
		margin: 0;
		font-size: 0.75rem;
		line-height: 1rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.key-filters-help {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		pointer-events: auto;
	}

	.key-filters-clear {
		flex-shrink: 0;
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		cursor: pointer;
		pointer-events: auto;
		color: var(--accent);
		background-color: var(--bg-primary);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.key-filters-body {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.2s ease;
	}

	.key-filters-body--expanded {
		grid-template-rows: 1fr;
	}

	.key-filters-body-inner {
		overflow: hidden;
		min-height: 0;
	}

	.key-filters-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		min-width: 0;
	}

	@media (min-width: 890px) {
		.key-filters-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.key-filters-grid > :global(*:last-child) {
			grid-column: 1 / -1;
		}
	}

	@media (min-width: 1280px) {
		.key-filters-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.key-filters-grid > :global(*:last-child) {
			grid-column: auto;
		}
	}
</style>
