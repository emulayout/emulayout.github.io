<script lang="ts">
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import type { SegmentedOption } from '$lib/segmentedControl';
	import {
		CYANOPHAGE_ANALYZER,
		CMINI_ANALYZER,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';

	interface Props {
		value: StatsAnalyzer;
		onChange: (value: StatsAnalyzer) => void;
		/** Accessible name for the control group. */
		ariaLabel?: string;
		variant?: 'filters' | 'toolbar';
		/** When set, shows an active-filter dot on that analyzer (filters variant). */
		isActive?: (analyzer: StatsAnalyzer) => boolean;
		/** Prefix for tab button ids (`{idPrefix}-{analyzer}`). */
		idPrefix?: string;
		/** Optional `aria-controls` target for each tab. */
		controls?: string;
		class?: string;
	}

	let {
		value,
		onChange,
		ariaLabel = 'Analyzer',
		variant = 'toolbar',
		isActive,
		idPrefix,
		controls,
		class: className = ''
	}: Props = $props();

	const options = $derived<SegmentedOption<StatsAnalyzer>[]>(
		STAT_ANALYZERS.map((analyzerDef) => {
			const analyzerClass =
				analyzerDef.value === CMINI_ANALYZER
					? 'analyzer-tab--cmini'
					: analyzerDef.value === CYANOPHAGE_ANALYZER
						? 'analyzer-tab--cyanophage'
						: analyzerDef.value === MANA2_ANALYZER
							? 'analyzer-tab--mana2'
							: '';
			const active = isActive?.(analyzerDef.value) ?? false;
			return {
				value: analyzerDef.value,
				label: analyzerDef.shortLabel,
				id: idPrefix ? `${idPrefix}-${analyzerDef.value}` : undefined,
				class: analyzerClass,
				indicator: variant === 'filters' && active,
				indicatorSrLabel: variant === 'filters' && active ? 'Has active filters' : undefined
			};
		})
	);
</script>

<div class="analyzer-tabs-scope">
	{#if variant === 'filters'}
		<Tabs
			{value}
			{onChange}
			{options}
			{ariaLabel}
			{controls}
			class="analyzer-tabs analyzer-tabs--{variant} {className}"
			buttonClass="analyzer-tab"
			selectedClass="analyzer-tab--selected"
		/>
	{:else}
		<SegmentedControl
			{value}
			{onChange}
			{options}
			{ariaLabel}
			{controls}
			class="analyzer-tabs analyzer-tabs--{variant} {className}"
			buttonClass="analyzer-tab"
			selectedClass="analyzer-tab--selected"
		/>
	{/if}
</div>

<style>
	.analyzer-tabs-scope {
		display: contents;
	}

	.analyzer-tabs-scope :global(.analyzer-tabs) {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		flex-shrink: 0;
		background-color: var(--bg-primary);
		border: 1px solid var(--border);
	}

	.analyzer-tabs-scope :global(.analyzer-tabs--filters) {
		gap: 0.25rem;
		padding: 0.25rem;
		border-radius: 0.5rem;
	}

	.analyzer-tabs-scope :global(.analyzer-tabs--toolbar) {
		display: inline-grid;
		gap: 0.125rem;
		padding: 0.125rem;
		border-radius: 0.375rem;
	}

	.analyzer-tabs-scope :global(.analyzer-tab) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-width: 0;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.analyzer-tabs-scope :global(.analyzer-tabs--filters .analyzer-tab) {
		padding: 0.4375rem 0.375rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		line-height: 1.25;
	}

	.analyzer-tabs-scope :global(.analyzer-tabs--toolbar .analyzer-tab) {
		min-width: 3.5rem;
		padding: 0.125rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1.2;
	}

	.analyzer-tabs-scope :global(.analyzer-tab:hover) {
		color: var(--text-primary);
	}

	.analyzer-tabs-scope :global(.analyzer-tab:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.analyzer-tabs-scope :global(.analyzer-tabs--filters .analyzer-tab--selected) {
		background-color: var(--bg-secondary);
		border-color: var(--border);
		color: var(--text-primary);
		font-weight: 600;
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--filters .analyzer-tab--cmini.analyzer-tab--selected) {
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		box-shadow: inset 0 -2px 0 var(--analyzer-cmini);
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--filters .analyzer-tab--cyanophage.analyzer-tab--selected) {
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		box-shadow: inset 0 -2px 0 var(--analyzer-cyanophage);
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--filters .analyzer-tab--mana2.analyzer-tab--selected) {
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		box-shadow: inset 0 -2px 0 var(--analyzer-mana2);
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--filters .analyzer-tab--cmini.analyzer-tab--selected:focus-visible) {
		box-shadow:
			inset 0 -2px 0 var(--analyzer-cmini),
			0 0 0 2px var(--accent);
	}

	.analyzer-tabs-scope
		:global(
			.analyzer-tabs--filters .analyzer-tab--cyanophage.analyzer-tab--selected:focus-visible
		) {
		box-shadow:
			inset 0 -2px 0 var(--analyzer-cyanophage),
			0 0 0 2px var(--accent);
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--filters .analyzer-tab--mana2.analyzer-tab--selected:focus-visible) {
		box-shadow:
			inset 0 -2px 0 var(--analyzer-mana2),
			0 0 0 2px var(--accent);
	}

	.analyzer-tabs-scope :global(.analyzer-tabs--toolbar .analyzer-tab--selected) {
		font-weight: 600;
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		border-color: var(--border);
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--toolbar .analyzer-tab--cmini.analyzer-tab--selected) {
		color: var(--analyzer-cmini);
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cmini) 14%, var(--bg-primary));
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--toolbar .analyzer-tab--cyanophage.analyzer-tab--selected) {
		color: var(--analyzer-cyanophage);
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cyanophage) 14%, var(--bg-primary));
	}

	.analyzer-tabs-scope
		:global(.analyzer-tabs--toolbar .analyzer-tab--mana2.analyzer-tab--selected) {
		color: var(--analyzer-mana2);
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-mana2) 14%, var(--bg-primary));
	}

	.analyzer-tabs-scope :global(.analyzer-tab--cmini .tab-dot) {
		background-color: var(--analyzer-cmini);
	}

	.analyzer-tabs-scope :global(.analyzer-tab--cyanophage .tab-dot) {
		background-color: var(--analyzer-cyanophage);
	}

	.analyzer-tabs-scope :global(.analyzer-tab--mana2 .tab-dot) {
		background-color: var(--analyzer-mana2);
	}

	@container (max-width: 36rem) {
		.analyzer-tabs-scope :global(.analyzer-tabs--toolbar) {
			display: grid;
			flex: 1 1 auto;
			min-width: 0;
		}

		.analyzer-tabs-scope :global(.analyzer-tabs--toolbar .analyzer-tab) {
			min-width: 0;
		}
	}
</style>
