<script lang="ts">
	import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
	import {
		buildBotStatsBlockLines,
		buildCyanophageStatsBlockLines,
		CYANOPHAGE_ANALYZER,
		decodeCyanophageStats,
		decodeMonkeyracerStats,
		deriveBotStats,
		deriveCyanophageStats,
		formatCyanophageStatsLoadingBlock,
		formatCyanophageStatsUnavailableBlock,
		formatStatsLoadingBlock,
		formatStatsUnavailableBlock,
		type StatsAnalyzer
	} from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		LayoutData,
		MonkeyracerStats
	} from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		compactStats?: CompactLayoutStats | CompactCyanophageStats;
		analyzer: StatsAnalyzer;
	}

	let { layout, authorName, likeCount, compactStats, analyzer }: Props = $props();

	const isCyanophage = $derived(analyzer === CYANOPHAGE_ANALYZER);
	const displayValue = $derived(displayRowsToString(computeDisplayRows(layout)));
	const updatedLabel = $derived(
		new Date(layout.updatedAt).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);

	const statsLoading = $derived(layoutStatsStore.isLoading(analyzer));

	const statsBlockLines = $derived.by(() => {
		if (!compactStats) return null;
		if (isCyanophage) {
			if (!layout.cyanophageCompatible) return null;
			const decoded = decodeCyanophageStats(compactStats as CompactCyanophageStats);
			if (!decoded) return null;
			return buildCyanophageStatsBlockLines(deriveCyanophageStats(decoded));
		}
		const decoded = decodeMonkeyracerStats(compactStats as CompactLayoutStats);
		if (!decoded) return null;
		return buildBotStatsBlockLines(deriveBotStats(decoded as MonkeyracerStats));
	});

	const statsFallback = $derived.by(() => {
		if (statsLoading) {
			return isCyanophage ? formatCyanophageStatsLoadingBlock() : formatStatsLoadingBlock();
		}
		if (isCyanophage) {
			return formatCyanophageStatsUnavailableBlock(
				!layout.cyanophageCompatible ? CYANOPHAGE_UNSUPPORTED_LABEL : undefined
			);
		}
		return formatStatsUnavailableBlock();
	});
</script>

<div class="compare-side">
	<div class="compare-side-meta">
		<div class="compare-side-title-group">
			<h3 class="compare-side-name" style="color: var(--text-primary);" title={layout.name}>
				{layout.name}
			</h3>
			<span
				class="compare-side-likes"
				style="color: var(--text-secondary);"
				title="Likes"
				aria-label={`${likeCount} likes`}
			>
				<svg
					class="size-3.5 shrink-0"
					viewBox="0 0 24 24"
					fill={likeCount > 1 ? 'currentColor' : 'none'}
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
					/>
				</svg>
				{likeCount}
			</span>
		</div>
		<p class="compare-side-sub layout-meta" style="color: var(--text-secondary);">
			{layout.board} · by {authorName} · {updatedLabel}
		</p>
	</div>

	<div class="layout-display-area compare-side-keys">
		<pre
			class="layout-display font-mono whitespace-pre m-0"
			style="color: var(--text-primary);">{displayValue}</pre>
	</div>

	{#if statsBlockLines}
		<div class="stats-block">
			{#each statsBlockLines as line, lineIndex (lineIndex)}
				<div class="stats-block-line">
					{#each line as segment, segmentIndex (segmentIndex)}
						<span>{segment.text}</span>
					{/each}
				</div>
			{/each}
		</div>
	{:else}
		<pre class="stats-block stats-block--unavailable">{statsFallback}</pre>
	{/if}
</div>

<style>
	.compare-side {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.compare-side-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.compare-side-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.compare-side-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}

	.compare-side-likes {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.compare-side-sub {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.compare-side-keys {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
</style>
