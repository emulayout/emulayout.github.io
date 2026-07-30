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
		showFingerDistanceBars?: boolean;
	}

	const {
		cmini = null,
		cyanophage = null,
		mana2 = null,
		showFingerUsageBars = false,
		showFingerDistanceBars = true
	}: Props = $props();

	function getStatsItemView(model: LayoutStatsBlockModel) {
		const fingerUsage =
			showFingerUsageBars && model.lines && model.fingerUsage ? model.fingerUsage : null;
		const fingerDistance =
			showFingerUsageBars && showFingerDistanceBars && model.lines && model.fingerDistance
				? model.fingerDistance
				: null;
		const baseLines = fingerUsage
			? (model.lines?.slice(0, -FINGER_USAGE_TEXT_LINE_COUNT) ?? null)
			: model.lines;
		const lines =
			showFingerUsageBars && model.fingerDistance
				? (baseLines?.filter(
						(line) => !line.some((segment) => segment.text.trim().startsWith('Distance'))
					) ?? null)
				: baseLines;
		return {
			lines,
			lineCount: fingerUsage ? lines?.length : undefined,
			fingerUsage,
			fingerDistance
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
			<div
				class="finger-chart-area"
				class:finger-chart-area--split={view.fingerDistance}
				class:finger-chart-area--cmini={model.analyzer === 'cmini'}
			>
				<FingerUsageBars
					usage={view.fingerUsage.usage}
					leftTotal={view.fingerUsage.leftTotal}
					rightTotal={view.fingerUsage.rightTotal}
					tone={model.analyzer}
					compact={Boolean(view.fingerDistance)}
					showLabel
				/>
				{#if view.fingerDistance}
					<FingerUsageBars
						usage={view.fingerDistance.distance}
						leftTotal={view.fingerDistance.leftShare}
						rightTotal={view.fingerDistance.rightShare}
						scaleMax={100}
						label="Finger distance"
						labelDetail={view.fingerDistance.total.toFixed(1)}
						tone={model.analyzer}
						compact
						showLabel
						valueUnit="raw"
					/>
				{/if}
			</div>
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

	.finger-chart-area--cmini {
		margin-top: 0.75rem;
	}

	.finger-chart-area--split {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		align-items: end;
		min-width: 0;
	}
</style>
