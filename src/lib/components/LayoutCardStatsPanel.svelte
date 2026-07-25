<script lang="ts">
	import LayoutStatsBlock from '$lib/components/LayoutStatsBlock.svelte';
	import type { StatsBlockSegment } from '$lib/layoutStats';

	type CompactStatsBlock = {
		lines: StatsBlockSegment[][] | null;
		fallback: string | null;
		loading: boolean;
	};

	interface Props {
		monkey?: CompactStatsBlock | null;
		cyanophage?: CompactStatsBlock | null;
		mana2?: CompactStatsBlock | null;
	}

	const { monkey = null, cyanophage = null, mana2 = null }: Props = $props();
</script>

{#snippet statsItem(model: CompactStatsBlock, isMana2 = false)}
	<div class="stats-stack-item">
		<LayoutStatsBlock
			lines={model.lines}
			fallback={model.fallback}
			unavailable={!model.loading}
			mana2={isMana2}
			shrink
		/>
	</div>
{/snippet}

<div class="stats-stack">
	{#if monkey}
		{@render statsItem(monkey)}
	{/if}
	{#if cyanophage}
		{@render statsItem(cyanophage)}
	{/if}
	{#if mana2}
		{@render statsItem(mana2, true)}
	{/if}
</div>

<style>
	.stats-stack {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stats-stack-item {
		min-width: 0;
	}
</style>
