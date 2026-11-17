<script lang="ts">
	import LayoutLikeButton from '$lib/components/LayoutLikeButton.svelte';
	import { getCyanophageStatsUnavailableReason, type StatsAnalyzer } from '$lib/statsAnalyzers';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { computeDisplayRows, displayRowsToString } from '$lib/layoutDisplay';
	import LayoutStatsBlock from '$lib/components/LayoutStatsBlock.svelte';
	import type { LayoutData } from '$lib/layout';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import {
		buildLayoutStatsBlockModel,
		type CompactAnalyzerStats
	} from '$lib/layoutStatsBlockModel';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likeCount: number;
		compactStats?: CompactAnalyzerStats;
		analyzer: StatsAnalyzer;
		/** When set, shows a clear (X) control after likes. */
		onClear?: () => void;
		clearButton?: HTMLButtonElement | undefined;
		/** Cycle through selected layouts. */
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

	const displayValue = $derived(
		displayRowsToString(computeDisplayRows(layout, uiPrefs.keyboardGeometry))
	);
	const updatedLabel = $derived(
		new Date(layout.updatedAt).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);

	const statsLoading = $derived(layoutStatsStore.isLoading(analyzer));
	const statsModel = $derived(
		buildLayoutStatsBlockModel(analyzer, compactStats, {
			loading: statsLoading,
			cyanophageUnavailableReason: getCyanophageStatsUnavailableReason(layout)
		})
	);
</script>

<div class="compare-side">
	<div class="compare-side-meta">
		<div class="compare-side-title-group">
			<h3 class="compare-side-name" style="color: var(--text-primary);" title={layout.name}>
				{layout.name}
			</h3>
			<LayoutLikeButton name={layout.name} {likeCount} />
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
			by {authorName} · {updatedLabel}
		</p>
	</div>

	<div class="layout-display-area compare-side-keys">
		<pre
			class="layout-display font-mono whitespace-pre m-0"
			style="color: var(--text-primary);">{displayValue}</pre>
	</div>

	<LayoutStatsBlock
		lines={statsModel.lines}
		fallback={statsModel.fallback}
		mana2={statsModel.mana2}
		unavailable
	/>

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
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background-color 0.15s ease;
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
