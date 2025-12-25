<script lang="ts">
	import type { LayoutData } from '$lib/layout';
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import LayoutFilters from '$lib/components/LayoutFilters.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

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

	function getModeFromBoard(board: string): string {
		// Map board types to cyanophage mode parameter
		switch (board) {
			case 'angle':
				return 'iso';
			case 'stagger':
				return 'ansi';
			case 'ortho':
				return 'ergo';
			case 'mini':
				return 'ergo';
			default:
				// Default to ergo if board type is unknown
				return 'ergo';
		}
	}

	function formatLayoutForUrl(displayValue: string): string {
		// Split by newlines to get rows
		const rows = displayValue.split('\n');
		// Remove all spaces from each row
		const cleanedRows = rows.map((row) => row.replace(/\s+/g, ''));
		// Join with newline character - cyanophage will handle filling in missing characters
		// and will update the URL with the complete layout
		return cleanedRows.join('\n');
	}

	function generatePlaygroundUrl(layout: LayoutData): string {
		const layoutParam = formatLayoutForUrl(layout.displayValue);
		const mode = getModeFromBoard(layout.board);
		// URL encode the layout param (newlines will become %0A)
		const encodedLayout = encodeURIComponent(layoutParam);
		return `https://cyanophage.github.io/playground.html?layout=${encodedLayout}&mode=${mode}`;
	}

	const filteredLayouts = $derived(filterStore.filterLayouts(layouts));
</script>

<div class="max-w-5xl mx-auto">
	<LayoutFilters {authorList} filteredCount={filteredLayouts.length} />

	<div class="grid gap-4 grid-cols-2 md:grid-cols-3">
		{#each filteredLayouts as layout (layout.name)}
			<LayoutCard
				{layout}
				authorName={getAuthorName(layout.user)}
				playgroundUrl={generatePlaygroundUrl(layout)}
			/>
		{/each}
	</div>
</div>
