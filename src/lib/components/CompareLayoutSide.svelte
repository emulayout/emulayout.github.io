<script lang="ts">
	import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
	import {
		buildBotStatsBlockLines,
		buildCyanophageStatsBlockLines,
		buildMana2StatsBlockLines,
		CYANOPHAGE_ANALYZER,
		decodeCyanophageStats,
		decodeMana2Stats,
		decodeMonkeyracerStats,
		deriveBotStats,
		deriveCyanophageStats,
		deriveMana2Stats,
		formatCyanophageStatsLoadingBlock,
		formatCyanophageStatsUnavailableBlock,
		formatMana2StatsLoadingBlock,
		formatMana2StatsUnavailableBlock,
		formatStatsLoadingBlock,
		formatStatsUnavailableBlock,
		MANA2_ANALYZER,
		type StatsAnalyzer
	} from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		CompactMana2Stats,
		LayoutData,
		MonkeyracerStats
	} from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		compactStats?: CompactLayoutStats | CompactCyanophageStats | CompactMana2Stats;
		analyzer: StatsAnalyzer;
		/** When set, shows a clear (X) control after likes. */
		onClear?: () => void;
		clearButton?: HTMLButtonElement | undefined;
		/** Cycle through selected compare layouts. */
		onCyclePrev?: () => void;
		onCycleNext?: () => void;
		showCycleControls?: boolean;
	}

	let {
		layout,
		authorName,
		likeCount,
		compactStats,
		analyzer,
		onClear,
		clearButton = $bindable(),
		onCyclePrev,
		onCycleNext,
		showCycleControls = false
	}: Props = $props();

	const isCyanophage = $derived(analyzer === CYANOPHAGE_ANALYZER);
	const isMana2 = $derived(analyzer === MANA2_ANALYZER);
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
		if (isMana2) {
			const decoded = decodeMana2Stats(compactStats as CompactMana2Stats);
			if (!decoded) return null;
			return buildMana2StatsBlockLines(deriveMana2Stats(decoded));
		}
		const decoded = decodeMonkeyracerStats(compactStats as CompactLayoutStats);
		if (!decoded) return null;
		return buildBotStatsBlockLines(deriveBotStats(decoded as MonkeyracerStats));
	});

	const statsFallback = $derived.by(() => {
		if (statsLoading) {
			if (isCyanophage) return formatCyanophageStatsLoadingBlock();
			if (isMana2) return formatMana2StatsLoadingBlock();
			return formatStatsLoadingBlock();
		}
		if (isCyanophage) {
			return formatCyanophageStatsUnavailableBlock(
				!layout.cyanophageCompatible ? CYANOPHAGE_UNSUPPORTED_LABEL : undefined
			);
		}
		if (isMana2) return formatMana2StatsUnavailableBlock();
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
			{#if onClear}
				<button
					bind:this={clearButton}
					type="button"
					class="compare-side-clear"
					style="
						color: var(--text-primary);
						background-color: var(--bg-secondary);
						border: 1px solid var(--border);
					"
					aria-label="Clear layout"
					title="Clear layout"
					onclick={onClear}
				>
					<svg
						class="size-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			{/if}
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
		<div class="stats-block" class:stats-block--mana2={isMana2}>
			{#each statsBlockLines as line, lineIndex (lineIndex)}
				<div class="stats-block-line">
					{#each line as segment, segmentIndex (segmentIndex)}
						<span>{segment.text}</span>
					{/each}
				</div>
			{/each}
		</div>
	{:else}
		<pre
			class="stats-block stats-block--unavailable"
			class:stats-block--mana2={isMana2}>{statsFallback}</pre>
	{/if}

	{#if showCycleControls && onCyclePrev && onCycleNext}
		<div class="compare-side-cycle">
			<button
				type="button"
				class="compare-side-cycle-button"
				style="
					color: var(--text-secondary);
					background-color: var(--bg-secondary);
					border: 1px solid var(--border);
				"
				aria-label="Previous selected layout"
				title="Previous selected layout"
				onclick={onCyclePrev}
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M15 18l-6-6 6-6" />
				</svg>
			</button>
			<button
				type="button"
				class="compare-side-cycle-button"
				style="
					color: var(--text-secondary);
					background-color: var(--bg-secondary);
					border: 1px solid var(--border);
				"
				aria-label="Next selected layout"
				title="Next selected layout"
				onclick={onCycleNext}
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M9 18l6-6-6-6" />
				</svg>
			</button>
		</div>
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

	.compare-side-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
	}

	.compare-side-clear:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.compare-side-clear:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.compare-side-sub {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.compare-side-keys {
		/* Lock to exactly 4 rows so thumb-key layouts align with standard ones. */
		--layout-font-size: 14px;
		--layout-line-height: 1.5;
		--layout-max-rows: 4;
		display: flex;
		flex-direction: column;
		justify-content: center;
		height: calc(var(--layout-max-rows) * var(--layout-line-height) * var(--layout-font-size));
		min-height: calc(var(--layout-max-rows) * var(--layout-line-height) * var(--layout-font-size));
		max-height: calc(var(--layout-max-rows) * var(--layout-line-height) * var(--layout-font-size));
		overflow: hidden;
	}

	.compare-side-cycle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.compare-side-cycle-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 0.5rem;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background-color 0.15s ease;
	}

	.compare-side-cycle-button:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.compare-side-cycle-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
