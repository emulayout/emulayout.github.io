<script lang="ts">
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import { geometryLabel, type KeyboardGeometry } from '$lib/keyboardGeometry';
	import type { SegmentedOption } from '$lib/segmentedControl';

	interface Props {
		value: KeyboardGeometry;
		onChange: (value: KeyboardGeometry) => void;
	}

	const options: readonly SegmentedOption<KeyboardGeometry>[] = [
		{ value: 'row-stagger', label: geometryLabel('row-stagger') },
		{ value: 'column-stagger', label: geometryLabel('column-stagger') }
	];

	const { value, onChange }: Props = $props();
</script>

<div class="keyboard-geometry-tabs-scope">
	<SegmentedControl
		{value}
		{onChange}
		{options}
		ariaLabel="Keyboard geometry"
		class="keyboard-geometry-tabs"
		buttonClass="keyboard-geometry-tab"
		selectedClass="keyboard-geometry-tab--selected"
	/>
</div>

<style>
	.keyboard-geometry-tabs-scope {
		display: contents;
	}

	.keyboard-geometry-tabs-scope :global(.keyboard-geometry-tabs) {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		flex-shrink: 0;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.keyboard-geometry-tabs-scope :global(.keyboard-geometry-tab) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 5.75rem;
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

	.keyboard-geometry-tabs-scope :global(.keyboard-geometry-tab:hover) {
		color: var(--text-primary);
	}

	.keyboard-geometry-tabs-scope :global(.keyboard-geometry-tab:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.keyboard-geometry-tabs-scope :global(.keyboard-geometry-tab--selected) {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
	}
</style>
