<script lang="ts">
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import type { SegmentedOption } from '$lib/segmentedControl';
	import type { TypingWorkspaceMode } from '$lib/typingWorkspace';

	interface Props {
		value: TypingWorkspaceMode;
		onChange: (value: TypingWorkspaceMode) => void;
	}

	const options: readonly SegmentedOption<TypingWorkspaceMode>[] = [
		{ value: 'practice', label: 'Typing practice' },
		{ value: 'free', label: 'Type freely' }
	];

	const { value, onChange }: Props = $props();
</script>

<div class="typing-mode-tabs-scope">
	<SegmentedControl
		{value}
		{onChange}
		{options}
		ariaLabel="Typing mode"
		class="typing-mode-tabs"
		buttonClass="typing-mode-tab"
		selectedClass="typing-mode-tab--selected"
	/>
</div>

<style>
	.typing-mode-tabs-scope {
		display: contents;
	}

	.typing-mode-tabs-scope :global(.typing-mode-tabs) {
		display: inline-grid;
		grid-template-columns: repeat(2, max-content);
		flex-shrink: 0;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.typing-mode-tabs-scope :global(.typing-mode-tab) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3.5rem;
		padding: 0.125rem 0.55rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.2;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.typing-mode-tabs-scope :global(.typing-mode-tab:hover) {
		color: var(--text-primary);
	}

	.typing-mode-tabs-scope :global(.typing-mode-tab:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.typing-mode-tabs-scope :global(.typing-mode-tab--selected) {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
	}
</style>
