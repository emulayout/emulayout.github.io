<script lang="ts">
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import type { SegmentedOption } from '$lib/segmentedControl';
	import type { LayoutCardStatsMode } from '$lib/uiPrefs.svelte';

	interface Props {
		value: LayoutCardStatsMode;
		onChange: (value: LayoutCardStatsMode) => void;
	}

	const options: readonly SegmentedOption<LayoutCardStatsMode>[] = [
		{ value: 'focused', label: 'Highlights' },
		{ value: 'detailed', label: 'Detailed' }
	];

	const { value, onChange }: Props = $props();
</script>

<div class="stats-display-tabs-scope">
	<SegmentedControl
		{value}
		{onChange}
		{options}
		ariaLabel="Stats display"
		class="stats-display-tabs"
		buttonClass="stats-display-tab"
		selectedClass="stats-display-tab--selected"
	/>
</div>

<style>
	.stats-display-tabs-scope {
		display: contents;
	}

	.stats-display-tabs-scope :global(.stats-display-tabs) {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		flex-shrink: 0;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.stats-display-tabs-scope :global(.stats-display-tab) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3.5rem;
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

	.stats-display-tabs-scope :global(.stats-display-tab:hover) {
		color: var(--text-primary);
	}

	.stats-display-tabs-scope :global(.stats-display-tab:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.stats-display-tabs-scope :global(.stats-display-tab--selected) {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
	}
</style>
