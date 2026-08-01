<script lang="ts">
	import { getLayoutCardHeight } from '$lib/constants';
	import { filterStore } from '$lib/filterStore.svelte';
	import { uiPrefs } from '$lib/uiPrefs.svelte';

	interface Props {
		name: string;
		onRemove: (name: string) => void;
	}

	const { name, onRemove }: Props = $props();

	const cardHeight = $derived(
		getLayoutCardHeight(
			filterStore.showLayoutStats,
			filterStore.showLayoutTestArea,
			filterStore.statsAnalyzer,
			uiPrefs.layoutCardStatsMode
		)
	);
</script>

<div
	data-layout-name={name}
	class="missing-layout-card px-3 pt-3 pb-3 rounded-xl min-w-0 flex flex-col gap-3"
	style="
		background-color: var(--bg-secondary);
		border: 1px dashed var(--border);
		height: {cardHeight}px;
	"
>
	<div class="min-w-0">
		<h3 class="text-base font-semibold truncate" style="color: var(--text-primary);" title={name}>
			{name}
		</h3>
		<p class="mt-2 text-sm leading-snug" style="color: var(--text-secondary);">
			This layout has been deleted from cmini.
		</p>
	</div>

	<div class="mt-auto">
		<button type="button" class="missing-layout-remove" onclick={() => onRemove(name)}>
			Remove from view
		</button>
	</div>
</div>

<style>
	.missing-layout-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.missing-layout-remove:hover {
		border-color: var(--accent);
	}

	.missing-layout-remove:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
