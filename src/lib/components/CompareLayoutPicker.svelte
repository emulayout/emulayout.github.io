<script lang="ts">
	import { tick } from 'svelte';
	import CompareLayoutSide from '$lib/components/CompareLayoutSide.svelte';
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { CompactAnalyzerStats } from '$lib/layoutStatsBlockModel';
	import type { StatsAnalyzer } from '$lib/statsAnalyzers';

	interface Props {
		side: 'left' | 'right';
		committedName: string | null;
		layout: LayoutData | null;
		availableLayouts: LayoutData[];
		quickNames: string[];
		authorName?: string;
		likeCount?: number;
		compactStats?: CompactAnalyzerStats;
		analyzer: StatsAnalyzer;
		canCycleSelected: boolean;
		onHighlight: (name: string | null) => void;
		onCommit: (name: string) => void;
		onClear: () => void;
		onCyclePrev: () => void;
		onCycleNext: () => void;
	}

	let {
		side,
		committedName,
		layout,
		availableLayouts,
		quickNames,
		authorName = '',
		likeCount = 0,
		compactStats,
		analyzer,
		canCycleSelected,
		onHighlight,
		onCommit,
		onClear,
		onCyclePrev,
		onCycleNext
	}: Props = $props();

	let search = $state<{ focus: () => void } | undefined>(undefined);
	let clearButton = $state<HTMLButtonElement | undefined>(undefined);

	const searchId = $derived(`compare-layout-search-${side}`);
	const searchLabel = $derived(`Find ${side} layout`);

	/** Focus whichever control currently starts this picker. */
	export function focus() {
		if (committedName) clearButton?.focus();
		else search?.focus();
	}

	function commit(name: string, meta?: { via: 'enter' | 'click' }) {
		onCommit(name);
		if (meta?.via === 'enter') {
			void tick().then(() => clearButton?.focus());
		}
	}

	function clear() {
		onClear();
		void tick().then(() => search?.focus());
	}
</script>

<div class="compare-col">
	{#if !committedName}
		<LayoutAutocomplete
			bind:this={search}
			layouts={availableLayouts}
			id={searchId}
			label={searchLabel}
			{onHighlight}
			onSelect={commit}
		/>
	{/if}

	{#if layout}
		<CompareLayoutSide
			{layout}
			{authorName}
			{likeCount}
			{compactStats}
			{analyzer}
			onClear={committedName ? clear : undefined}
			bind:clearButton
			showCycleControls={Boolean(committedName) && canCycleSelected}
			{onCyclePrev}
			{onCycleNext}
		/>
	{:else}
		<div
			class="compare-empty"
			class:compare-empty--options={quickNames.length > 0}
			style="color: var(--text-secondary); border-color: var(--border); background-color: var(--bg-secondary);"
		>
			{#if quickNames.length > 0}
				<p class="compare-empty-label">Selected layouts</p>
				<ul class="compare-quick-list">
					{#each quickNames as name (name)}
						<li>
							<button
								type="button"
								class="compare-quick-option"
								style="color: var(--text-primary);"
								onclick={() => commit(name)}
							>
								{name}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				Search to choose a layout.
			{/if}
		</div>
	{/if}
</div>

<style>
	.compare-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		align-self: stretch;
	}

	.compare-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 296px;
		max-height: 296px;
		padding: 1rem;
		border: 1px dashed;
		border-radius: 0.75rem;
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.compare-empty--options {
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		gap: 0.5rem;
		text-align: left;
	}

	.compare-empty-label {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.compare-quick-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 0;
		overflow-y: auto;
	}

	.compare-quick-option {
		display: block;
		width: 100%;
		padding: 0.375rem 0.5rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.compare-quick-option:hover {
		background-color: var(--bg-primary);
	}
</style>
