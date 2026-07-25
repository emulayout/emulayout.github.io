<script lang="ts">
	import { isSimilarDiffSlot, type DisplayCell } from '$lib/layoutDisplay';

	interface Props {
		rows: DisplayCell[][];
		value: string;
		highlightDifferences?: boolean;
		referencePositions?: Map<string, string>;
		fillAvailableSpace?: boolean;
	}

	const {
		rows,
		value,
		highlightDifferences = false,
		referencePositions,
		fillAvailableSpace = true
	}: Props = $props();
</script>

<div
	class="layout-display-area min-w-0 overflow-x-auto flex flex-col justify-center px-2"
	class:flex-1={fillAvailableSpace}
	class:layout-display-area--fixed={!fillAvailableSpace}
>
	{#if highlightDifferences}
		<div
			class="layout-display layout-display--diff font-mono whitespace-pre m-0"
			style="color: var(--text-primary);"
			aria-label="Layout keys; green marks differences from the selected layout"
		>
			{#each rows as row, rowIndex (rowIndex)}
				<div class="layout-display-row">
					{#each row as cell, cellIndex (`${rowIndex}:${cellIndex}`)}
						{#if isSimilarDiffSlot(cell.slot, cell.char, referencePositions)}
							<span class="layout-key-diff">{cell.char}</span>
						{:else}{cell.char}{/if}
					{/each}
				</div>
			{/each}
		</div>
	{:else}
		<pre
			class="layout-display font-mono whitespace-pre m-0"
			style="color: var(--text-primary);">{value}</pre>
	{/if}
</div>

<style>
	.layout-display-area--fixed {
		flex: 0 0 auto;
	}

	.layout-display--diff {
		line-height: 1.25;
	}

	.layout-display-row {
		white-space: pre;
	}

	.layout-key-diff {
		color: var(--similar-diff);
	}
</style>
