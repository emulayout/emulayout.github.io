<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	import { getRovingSelectionIndex } from '$lib/segmentedControl';
	import type { TabOption } from '$lib/tabs';

	interface TabProps {
		type: 'button';
		role: 'tab';
		id: string | undefined;
		'aria-selected': boolean;
		'aria-controls': string | undefined;
		tabindex: 0 | -1;
		'data-tab-option': true;
		onclick: () => void;
		onkeydown: (event: KeyboardEvent) => void;
	}

	interface ItemArgs {
		option: TabOption<T>;
		selected: boolean;
		index: number;
		tabProps: TabProps;
	}

	interface Props {
		value: T;
		onChange: (value: T) => void;
		options: readonly TabOption<T>[];
		ariaLabel: string;
		controls?: string;
		class?: string;
		buttonClass?: string;
		selectedClass?: string;
		item?: Snippet<[ItemArgs]>;
	}

	let {
		value,
		onChange,
		options,
		ariaLabel,
		controls,
		class: className = '',
		buttonClass = '',
		selectedClass = '',
		item
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	const rovingIndex = $derived(getRovingSelectionIndex(options, value));

	function selectAt(index: number) {
		const option = options[index];
		if (!option) return;
		onChange(option.value);
		rootEl?.querySelectorAll<HTMLButtonElement>('[data-tab-option]')[index]?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		let nextIndex: number;
		switch (event.key) {
			case 'ArrowRight':
				nextIndex = (index + 1) % options.length;
				break;
			case 'ArrowLeft':
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

	function tabPropsFor(option: TabOption<T>, index: number, selected: boolean): TabProps {
		return {
			type: 'button',
			role: 'tab',
			id: option.id,
			'aria-selected': selected,
			'aria-controls': option.controls ?? controls,
			tabindex: index === rovingIndex ? 0 : -1,
			'data-tab-option': true,
			onclick: () => onChange(option.value),
			onkeydown: (event: KeyboardEvent) => handleKeydown(event, index)
		};
	}
</script>

<div bind:this={rootEl} class="tabs {className}" role="tablist" aria-label={ariaLabel}>
	{#each options as option, index (option.value)}
		{@const selected = value === option.value}
		{@const tabProps = tabPropsFor(option, index, selected)}
		{#if item}
			{@render item({ option, selected, index, tabProps })}
		{:else}
			<button
				class="tab {buttonClass} {option.class ?? ''} {selected ? selectedClass : ''}"
				{...tabProps}
			>
				<span>{option.label}</span>
				{#if option.indicator}
					<span class="tab-dot" aria-hidden="true"></span>
					{#if option.indicatorSrLabel}
						<span class="tab-sr">{option.indicatorSrLabel}</span>
					{/if}
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.tab-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.tab-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 9999px;
		background-color: var(--filter-active-dot);
		flex-shrink: 0;
	}
</style>
