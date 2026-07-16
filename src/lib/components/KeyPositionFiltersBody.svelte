<script lang="ts">
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		/** Force a single column (e.g. modal). Accordion keeps responsive columns. */
		stacked?: boolean;
	}

	let { stacked = false }: Props = $props();
</script>

<div class="key-filters-grid" class:key-filters-grid--stacked={stacked}>
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

<style>
	.key-filters-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		min-width: 0;
	}

	@media (min-width: 890px) {
		.key-filters-grid:not(.key-filters-grid--stacked) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.key-filters-grid:not(.key-filters-grid--stacked) > :global(*:last-child) {
			grid-column: 1 / -1;
		}
	}

	@media (min-width: 1280px) {
		.key-filters-grid:not(.key-filters-grid--stacked) {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.key-filters-grid:not(.key-filters-grid--stacked) > :global(*:last-child) {
			grid-column: auto;
		}
	}
</style>
