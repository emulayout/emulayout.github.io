<script lang="ts">
	import FingerUsageBars from '$lib/components/FingerUsageBars.svelte';
	import LayoutStatsBlock from '$lib/components/LayoutStatsBlock.svelte';
	import {
		buildFocusedMetricSlots,
		type LayoutCardMetric,
		type LayoutStatsBlockModel
	} from '$lib/layoutStatsBlockModel';
	import { FINGER_USAGE_TEXT_LINE_COUNT } from '$lib/statsBlockFormatting';
	import { analyzerShortLabel } from '$lib/statsAnalyzers';
	import type { SortOrder } from '$lib/statsSorting';

	interface Props {
		cmini?: LayoutStatsBlockModel | null;
		cyanophage?: LayoutStatsBlockModel | null;
		mana2?: LayoutStatsBlockModel | null;
		showFingerDistanceBars?: boolean;
		/** Active sort metric, including when another analyzer owns it. */
		sortMetric?: LayoutCardMetric | null;
		filterValueOnClick?: boolean;
		onFilterMetric?: (metric: LayoutCardMetric, useMetricValue: boolean) => void;
		onSortMetric?: (metric: LayoutCardMetric, order: SortOrder) => void;
		/** Highlights uses visual finger usage; Detailed uses the text stat block. */
		mode?: 'focused' | 'detailed';
	}

	const {
		cmini = null,
		cyanophage = null,
		mana2 = null,
		showFingerDistanceBars = true,
		sortMetric = null,
		filterValueOnClick = false,
		onFilterMetric,
		onSortMetric,
		mode = 'focused'
	}: Props = $props();
	const showFingerUsageBars = $derived(mode === 'focused');

	function fallbackCopy(model: LayoutStatsBlockModel) {
		const lines = model.fallback
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && line !== '…');
		return {
			title: model.loading ? 'Loading stats' : 'Stats unavailable',
			detail: lines[1] ?? (model.loading ? 'Preparing this analyzer' : 'No data for this layout')
		};
	}

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

{#snippet fingerUsageCharts(model: LayoutStatsBlockModel, showDistance: boolean)}
	{#if model.fingerUsage}
		<div
			class="finger-chart-area"
			class:finger-chart-area--split={showDistance && model.fingerDistance}
			class:finger-chart-area--cmini={model.analyzer === 'cmini'}
		>
			<FingerUsageBars
				usage={model.fingerUsage.usage}
				leftTotal={model.fingerUsage.leftTotal}
				rightTotal={model.fingerUsage.rightTotal}
				tone={model.analyzer}
				compact={Boolean(showDistance && model.fingerDistance)}
				showLabel
			/>
			{#if showDistance && model.fingerDistance}
				<FingerUsageBars
					usage={model.fingerDistance.distance}
					leftTotal={model.fingerDistance.leftShare}
					rightTotal={model.fingerDistance.rightShare}
					scaleMax={100}
					label="Finger distance"
					labelDetail={model.fingerDistance.total.toFixed(1)}
					tone={model.analyzer}
					compact
					showLabel
					valueUnit="raw"
				/>
			{/if}
		</div>
	{/if}
{/snippet}

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
			{@render fingerUsageCharts(model, Boolean(view.fingerDistance))}
		{/if}
	</div>
{/snippet}

{#snippet focusedStatsItem(model: LayoutStatsBlockModel)}
	{@const analyzerLabel = analyzerShortLabel(model.analyzer)}
	{@const metricSlots = buildFocusedMetricSlots(model, sortMetric)}
	<section
		class="core-stats core-stats--{model.analyzer}"
		aria-label="{analyzerLabel} core statistics"
	>
		{#if model.cardMetrics}
			<dl class="core-stats-grid">
				{#each metricSlots as metric, slotIndex (slotIndex)}
					{#if metric}
						{@const foreignAnalyzer = metric.analyzer !== model.analyzer}
						{@const actionSortOrder =
							metric.sortOrder === 'asc'
								? 'desc'
								: metric.sortOrder === 'desc'
									? 'asc'
									: metric.preferredSortOrder}
						<div
							class="core-stat"
							class:core-stat--interactive={Boolean(onFilterMetric || onSortMetric)}
							class:core-stat--filtered={foreignAnalyzer ||
								metric.highlight === 'cmini' ||
								metric.highlight === 'cyanophage' ||
								metric.highlight === 'mana2'}
							class:core-stat--sorted={!foreignAnalyzer && metric.highlight === 'sort'}
							class:core-stat--foreign={foreignAnalyzer}
							style={foreignAnalyzer
								? `--core-stats-tone: var(--analyzer-${metric.analyzer})`
								: undefined}
							title={metric.description}
						>
							{#if onFilterMetric}
								<button
									type="button"
									class="core-stat-filter-button"
									aria-label={`Open ${analyzerShortLabel(metric.analyzer)} ${metric.description} filter`}
									title={filterValueOnClick
										? `Set filter from ${metric.value}`
										: `Filter by ${metric.description}. Shift-click to use ${metric.value}`}
									onclick={(event) => {
										onFilterMetric(metric, filterValueOnClick || event.shiftKey);
									}}
								></button>
							{/if}
							<dt class="core-stat-label">
								<span>{metric.label}</span>
								{#if metric.sortOrder}
									<span
										class="core-stat-sort"
										aria-label={`Sorted ${metric.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
									>
										{metric.sortOrder === 'asc' ? '↑' : '↓'}
									</span>
								{/if}
							</dt>
							<dd class="core-stat-value">{metric.value}</dd>
							{#if onSortMetric}
								<div class="core-stat-sort-controls">
									<button
										type="button"
										class="core-stat-sort-button"
										class:core-stat-sort-button--toggle={Boolean(metric.sortOrder)}
										aria-label={`Sort ${analyzerShortLabel(metric.analyzer)} ${metric.description} ${actionSortOrder === 'asc' ? 'ascending' : 'descending'}`}
										title={`Sort ${actionSortOrder === 'asc' ? 'ascending' : 'descending'}`}
										onclick={(event) => {
											event.stopPropagation();
											onSortMetric(metric, actionSortOrder);
										}}>{actionSortOrder === 'asc' ? '▲' : '▼'}</button
									>
								</div>
							{/if}
						</div>
					{:else}
						<div class="core-stat core-stat--empty" aria-hidden="true"></div>
					{/if}
				{/each}
			</dl>
		{:else}
			{@const fallback = fallbackCopy(model)}
			<div class="core-stats-status" class:core-stats-status--loading={model.loading}>
				<span class="core-stats-status-mark" aria-hidden="true"></span>
				<span class="core-stats-status-copy">
					<strong>{fallback.title}</strong>
					<span>{fallback.detail}</span>
				</span>
			</div>
		{/if}

		{#if model.fingerUsage}
			{#if showFingerUsageBars}
				{@render fingerUsageCharts(model, Boolean(showFingerDistanceBars && model.fingerDistance))}
			{:else}
				<div class="focused-finger-text">
					<LayoutStatsBlock
						lines={model.lines?.slice(-FINGER_USAGE_TEXT_LINE_COUNT) ?? null}
						fallback={null}
						unavailable={false}
						lineCount={FINGER_USAGE_TEXT_LINE_COUNT}
						shrink
					/>
				</div>
			{/if}
		{/if}
	</section>
{/snippet}

<div class="stats-stack">
	{#if cmini}
		{#if mode === 'detailed'}
			{@render statsItem(cmini)}
		{:else}
			{@render focusedStatsItem(cmini)}
		{/if}
	{/if}
	{#if cyanophage}
		{#if mode === 'detailed'}
			{@render statsItem(cyanophage)}
		{:else}
			{@render focusedStatsItem(cyanophage)}
		{/if}
	{/if}
	{#if mana2}
		{#if mode === 'detailed'}
			{@render statsItem(mana2)}
		{:else}
			{@render focusedStatsItem(mana2)}
		{/if}
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

	.core-stats {
		--core-stats-tone: var(--text-caption);
		min-width: 0;
	}

	.core-stats--cmini {
		--core-stats-tone: var(--analyzer-cmini);
	}

	.core-stats--cyanophage {
		--core-stats-tone: var(--analyzer-cyanophage);
	}

	.core-stats--mana2 {
		--core-stats-tone: var(--analyzer-mana2);
	}

	.core-stats-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0;
		min-width: 0;
		margin: 0;
	}

	.core-stat {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 2.75rem;
		flex-direction: column;
		justify-content: center;
		gap: 0.1rem;
		padding: 0.35rem 0.6rem;
		overflow: hidden;
		background: transparent;
		transition:
			padding-right 120ms ease,
			background-color 120ms ease;
	}

	.core-stat--interactive:hover,
	.core-stat--interactive:focus-within {
		padding-right: 1.4rem;
		background: color-mix(in srgb, var(--text-caption) 5%, transparent);
	}

	.core-stat:not(:nth-child(3n + 1)) {
		border-left: 1px solid var(--border);
	}

	.core-stat:nth-child(n + 4) {
		border-top: 1px solid var(--border);
	}

	.core-stat--empty {
		background: color-mix(in srgb, var(--text-caption) 2%, transparent);
	}

	.core-stat--filtered {
		background: color-mix(in srgb, var(--core-stats-tone) 5%, transparent);
	}

	.core-stat--filtered.core-stat--interactive:hover,
	.core-stat--filtered.core-stat--interactive:focus-within {
		background: color-mix(in srgb, var(--core-stats-tone) 9%, transparent);
	}

	.core-stat--sorted {
		--core-stats-tone: var(--stats-fg-highlight-sort);
		background: color-mix(in srgb, var(--stats-fg-highlight-sort) 6%, transparent);
	}

	.core-stat--sorted.core-stat--interactive:hover,
	.core-stat--sorted.core-stat--interactive:focus-within {
		background: color-mix(in srgb, var(--stats-fg-highlight-sort) 10%, transparent);
	}

	.core-stat-sort-controls {
		position: absolute;
		inset-block: 0;
		inset-inline-end: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr);
		width: 1rem;
		height: 100%;
		overflow: hidden;
		border-left: 1px solid var(--border);
		opacity: 0;
		pointer-events: none;
		transform: translateX(0.2rem);
		transition:
			opacity 120ms ease,
			transform 120ms ease;
		z-index: 2;
	}

	.core-stat-filter-button {
		position: absolute;
		inset: 0;
		z-index: 0;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.core-stat-label,
	.core-stat-value {
		position: relative;
		z-index: 1;
		pointer-events: none;
	}

	.core-stat--interactive:hover .core-stat-sort-controls,
	.core-stat--interactive:focus-within .core-stat-sort-controls {
		opacity: 1;
		pointer-events: auto;
		transform: translateX(0);
	}

	.core-stat-sort-button {
		display: grid;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 0;
		color: var(--text-caption);
		background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
		font-size: 0.5rem;
		line-height: 1;
		cursor: pointer;
	}

	.core-stat-sort-button:hover,
	.core-stat-sort-button:focus-visible,
	.core-stat-sort-button--toggle {
		color: var(--text-primary);
		background: color-mix(in srgb, var(--stats-fg-highlight-sort) 16%, var(--bg-primary));
	}

	.core-stat--foreign .core-stat-sort-button--toggle {
		background: color-mix(in srgb, var(--core-stats-tone) 16%, var(--bg-primary));
	}

	.core-stat-sort-button:focus-visible {
		outline: 1px solid var(--stats-fg-highlight-sort);
		outline-offset: -1px;
	}

	@media (hover: none) {
		.core-stat--interactive {
			padding-right: 1.4rem;
		}

		.core-stat-sort-controls {
			opacity: 1;
			pointer-events: auto;
			transform: translateX(0);
		}
	}

	.core-stat-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		min-width: 0;
		color: var(--text-caption);
		font-size: 0.5625rem;
		font-weight: 650;
		line-height: 1.15;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.core-stat-label > span:first-child {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.core-stat--filtered .core-stat-label,
	.core-stat--sorted .core-stat-label {
		color: var(--core-stats-tone);
	}

	.core-stat-sort {
		font-size: 0.75rem;
		line-height: 1;
	}

	.core-stat-value {
		min-width: 0;
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 550;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.core-stat--filtered .core-stat-value,
	.core-stat--sorted .core-stat-value {
		color: var(--text-primary);
	}

	.core-stats-status {
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.6rem;
		border-block: 1px solid var(--border);
		background: transparent;
	}

	.core-stats-status-mark {
		width: 0.25rem;
		height: 1.5rem;
		flex-shrink: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--core-stats-tone) 62%, var(--border));
	}

	.core-stats-status--loading .core-stats-status-mark {
		animation: stats-loading-pulse 1.2s ease-in-out infinite alternate;
	}

	.core-stats-status-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.2rem;
		color: var(--text-caption);
		font-size: 0.75rem;
	}

	.core-stats-status-copy strong {
		color: var(--text-secondary);
		font-size: 0.8125rem;
	}

	@keyframes stats-loading-pulse {
		to {
			opacity: 0.35;
		}
	}

	.stats-stack-item .finger-chart-area {
		margin-top: 0.5rem;
	}

	.core-stats .focused-finger-text,
	.core-stats .finger-chart-area {
		margin-top: 1rem;
	}

	.finger-chart-area--split {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		align-items: end;
		min-width: 0;
	}
</style>
