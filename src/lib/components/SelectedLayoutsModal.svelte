<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import {
		showsCyanophageStats,
		showsMana2Stats,
		showsMonkeyracerStats
	} from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const authorById = $derived(
		new Map<number, string>(
			Object.entries(layoutsCatalog.authorsData).map(([name, id]) => [id as number, name])
		)
	);

	const layoutByName = $derived(
		new Map<string, LayoutData>(layoutsCatalog.layouts.map((layout) => [layout.name, layout]))
	);

	/** Selected layouts in selection order, ignoring page filters. */
	const selectedLayouts = $derived.by((): LayoutData[] => {
		const layouts: LayoutData[] = [];
		for (const name of filterStore.compareSelectedNames) {
			const layout = layoutByName.get(name);
			if (layout) layouts.push(layout);
		}
		return layouts;
	});

	function getAuthorName(userId: number): string {
		return authorById.get(userId) ?? 'Unknown';
	}

	function clearSelection() {
		filterStore.clearCompareLayouts();
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="selected-layouts-title"
	panelClass="max-h-[min(90vh,900px)] max-w-[min(96rem,calc(100vw-2rem))]"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<div>
			<h2
				id="selected-layouts-title"
				class="text-lg font-semibold"
				style="color: var(--text-primary);"
			>
				Selected layouts
			</h2>
			{#if selectedLayouts.length > 0}
				<p class="text-sm" style="color: var(--text-secondary);">
					{selectedLayouts.length} layout{selectedLayouts.length === 1 ? '' : 's'}
				</p>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-2">
			{#if selectedLayouts.length > 0}
				<button
					type="button"
					onclick={clearSelection}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
					style="color: var(--text-primary); background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-label="Clear selection"
				>
					Clear selection
				</button>
			{/if}
			<button
				onclick={onClose}
				class="flex size-8 items-center justify-center rounded-full transition-colors"
				style="color: var(--text-secondary);"
				aria-label="Close"
			>
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
		{#if layoutsCatalog.layouts.length === 0}
			<p class="text-sm" style="color: var(--text-secondary);">Loading…</p>
		{:else if selectedLayouts.length === 0}
			<p class="text-sm" style="color: var(--text-secondary);">
				No layouts selected. Use the checkbox on a layout card to add one.
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
				{#each selectedLayouts as layout (layout.name)}
					<LayoutCard
						{layout}
						authorName={getAuthorName(layout.user)}
						likeCount={0}
						compactMonkeyStats={showsMonkeyracerStats(filterStore.statsAnalyzer)
							? layoutStatsStore.maps.monkeyracer?.[layout.name]
							: undefined}
						compactCyanophageStats={showsCyanophageStats(filterStore.statsAnalyzer)
							? layoutStatsStore.maps.cyanophage?.[layout.name]
							: undefined}
						compactMana2Stats={showsMana2Stats(filterStore.statsAnalyzer)
							? layoutStatsStore.maps.mana2?.[layout.name]
							: undefined}
					/>
				{/each}
			</div>
		{/if}
	</div>
</ModalShell>
