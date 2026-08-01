<script lang="ts">
	import type { LayoutCardStatsMode } from '$lib/uiPrefs.svelte';

	interface Props {
		value: LayoutCardStatsMode;
		onChange: (value: LayoutCardStatsMode) => void;
	}

	const options: readonly { value: LayoutCardStatsMode; label: string }[] = [
		{ value: 'focused', label: 'Highlights' },
		{ value: 'detailed', label: 'Detailed' }
	];

	const { value, onChange }: Props = $props();
	let rootEl = $state<HTMLDivElement | undefined>(undefined);

	function selectAt(index: number) {
		const option = options[index];
		if (!option) return;
		onChange(option.value);
		rootEl?.querySelectorAll<HTMLButtonElement>('[data-stats-display-tab]')[index]?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		let nextIndex: number;

		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				nextIndex = (index + 1) % options.length;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				nextIndex = (index - 1 + options.length) % options.length;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = options.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		selectAt(nextIndex);
	}
</script>

<div bind:this={rootEl} class="stats-display-tabs" role="toolbar" aria-label="Stats display">
	{#each options as option, index (option.value)}
		<button
			type="button"
			data-stats-display-tab
			aria-pressed={value === option.value}
			class="stats-display-tab"
			class:stats-display-tab--selected={value === option.value}
			onclick={() => onChange(option.value)}
			onkeydown={(event) => handleKeydown(event, index)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.stats-display-tabs {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		flex-shrink: 0;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
	}

	.stats-display-tab {
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

	.stats-display-tab:hover {
		color: var(--text-primary);
	}

	.stats-display-tab:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.stats-display-tab--selected {
		border-color: var(--border);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		color: var(--text-primary);
		font-weight: 600;
	}
</style>
