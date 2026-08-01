<script lang="ts" generics="T extends string">
	import { getRovingSelectionIndex, type SegmentedOption } from '$lib/segmentedControl';

	interface Props {
		value: T;
		onChange: (value: T) => void;
		options: readonly SegmentedOption<T>[];
		ariaLabel: string;
		/** Optional `aria-controls` shared by all options. */
		controls?: string;
		class?: string;
		/** Extra classes on each default-rendered button. */
		buttonClass?: string;
		/** Extra class applied when the option is selected. */
		selectedClass?: string;
	}

	let {
		value,
		onChange,
		options,
		ariaLabel,
		controls,
		class: className = '',
		buttonClass = '',
		selectedClass = ''
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	const rovingIndex = $derived(getRovingSelectionIndex(options, value));

	function selectAt(index: number) {
		const option = options[index];
		if (!option) return;
		onChange(option.value);
		const buttons = rootEl?.querySelectorAll<HTMLButtonElement>('[data-segmented-option]');
		buttons?.[index]?.focus();
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		const count = options.length;
		let nextIndex: number;

		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				nextIndex = (index + 1) % count;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				nextIndex = (index - 1 + count) % count;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = count - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		selectAt(nextIndex);
	}

	function buttonPropsFor(option: SegmentedOption<T>, index: number, selected: boolean) {
		return {
			type: 'button' as const,
			role: 'radio' as const,
			'aria-checked': selected,
			tabindex: (index === rovingIndex ? 0 : -1) as 0 | -1,
			id: option.id,
			'aria-controls': controls,
			'data-segmented-option': true as const,
			onclick: () => onChange(option.value),
			onkeydown: (event: KeyboardEvent) => handleKeydown(event, index)
		};
	}
</script>

<div
	bind:this={rootEl}
	class="segmented-control {className}"
	role="radiogroup"
	aria-label={ariaLabel}
	aria-orientation="horizontal"
>
	{#each options as option, index (option.value)}
		{@const selected = value === option.value}
		{@const buttonProps = buttonPropsFor(option, index, selected)}
		<button
			class="segmented-control-option {buttonClass} {option.class ?? ''} {selected
				? selectedClass
				: ''}"
			class:segmented-control-option--selected={selected}
			{...buttonProps}
		>
			<span>{option.label}</span>
			{#if option.indicator}
				<span class="segmented-control-dot" aria-hidden="true"></span>
				{#if option.indicatorSrLabel}
					<span class="segmented-control-sr">{option.indicatorSrLabel}</span>
				{/if}
			{/if}
		</button>
	{/each}
</div>

<style>
	.segmented-control-sr {
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

	.segmented-control-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 9999px;
		background-color: var(--filter-active-dot);
		flex-shrink: 0;
	}
</style>
