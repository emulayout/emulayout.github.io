<script lang="ts">
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import type { SegmentedOption } from '$lib/segmentedControl';
	import { STAT_CORPORA, type StatsCorpus } from '$lib/statsAnalyzers';

	interface Props {
		value: StatsCorpus;
		onChange: (value: StatsCorpus) => void;
	}

	const options: readonly SegmentedOption<StatsCorpus>[] = STAT_CORPORA.map((corpus) => ({
		value: corpus.value,
		label: corpus.label
	}));

	const { value, onChange }: Props = $props();
</script>

<div class="corpus-tabs-scope">
	<SegmentedControl
		{value}
		{onChange}
		{options}
		ariaLabel="Stats corpus"
		class="corpus-tabs"
		buttonClass="corpus-tab"
		selectedClass="corpus-tab--selected"
	/>
</div>

<style>
	.corpus-tabs-scope {
		display: contents;
	}

	.corpus-tabs-scope :global(.corpus-tabs) {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		flex-shrink: 0;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.corpus-tabs-scope :global(.corpus-tab) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 4.5rem;
		padding: 0.125rem 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.2;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.corpus-tabs-scope :global(.corpus-tab:hover) {
		color: var(--text-primary);
	}

	.corpus-tabs-scope :global(.corpus-tab:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.corpus-tabs-scope :global(.corpus-tab--selected) {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
	}

	@container (max-width: 36rem) {
		.corpus-tabs-scope :global(.corpus-tabs) {
			display: grid;
			flex: 1 1 auto;
			min-width: 0;
		}

		.corpus-tabs-scope :global(.corpus-tab) {
			min-width: 0;
		}
	}
</style>
