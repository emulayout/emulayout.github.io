<script lang="ts">
	import FingerUsageBars from '$lib/components/FingerUsageBars.svelte';
	import LayoutStatsBlock from '$lib/components/LayoutStatsBlock.svelte';
	import type { LayoutStatsBlockModel } from '$lib/layoutStatsBlockModel';
	import { FINGER_USAGE_TEXT_LINE_COUNT } from '$lib/statsBlockFormatting';

	interface Props {
		cmini?: LayoutStatsBlockModel | null;
		cyanophage?: LayoutStatsBlockModel | null;
		mana2?: LayoutStatsBlockModel | null;
		showFingerUsageBars?: boolean;
	}

	const {
		cmini = null,
		cyanophage = null,
		mana2 = null,
		showFingerUsageBars = false
	}: Props = $props();

	function getStatsItemView(model: LayoutStatsBlockModel) {
		const fingerUsage =
			showFingerUsageBars && model.lines && model.fingerUsage ? model.fingerUsage : null;
		return {
			lines: fingerUsage
				? (model.lines?.slice(0, -FINGER_USAGE_TEXT_LINE_COUNT) ?? null)
				: model.lines,
			lineCount: fingerUsage
				? Math.max(0, (model.lines?.length ?? 0) - FINGER_USAGE_TEXT_LINE_COUNT)
				: undefined,
			fingerUsage
		};
	}
</script>

{#snippet statsItem(model: LayoutStatsBlockModel)}
	{@const view = getStatsItemView(model)}
	<div class="stats-stack-item">
		<LayoutStatsBlock
			lines={view.lines}
			fallback={model.fallback}
			unavailable={!model.loading}
			mana2={model.mana2}
			lineCount={view.lineCount}
			shrink
		/>
		{#if view.fingerUsage}
			<FingerUsageBars
				usage={view.fingerUsage.usage}
				leftTotal={view.fingerUsage.leftTotal}
				rightTotal={view.fingerUsage.rightTotal}
				tone={model.analyzer}
			/>
		{/if}
	</div>
{/snippet}

<div class="stats-stack">
	{#if cmini}
		{@render statsItem(cmini)}
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
