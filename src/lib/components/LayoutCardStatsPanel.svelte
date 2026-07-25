<script lang="ts">
	import LayoutStatsBlock from '$lib/components/LayoutStatsBlock.svelte';
	import type { LayoutStatsBlockModel } from '$lib/layoutStatsBlockModel';

	interface Props {
		monkey?: LayoutStatsBlockModel | null;
		cyanophage?: LayoutStatsBlockModel | null;
		mana2?: LayoutStatsBlockModel | null;
	}

	const { monkey = null, cyanophage = null, mana2 = null }: Props = $props();
</script>

{#snippet statsItem(model: LayoutStatsBlockModel)}
	<div class="stats-stack-item">
		<LayoutStatsBlock
			lines={model.lines}
			fallback={model.fallback}
			unavailable={!model.loading}
			mana2={model.mana2}
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
		{@render statsItem(mana2)}
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
