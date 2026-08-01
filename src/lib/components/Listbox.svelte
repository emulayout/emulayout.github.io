<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { navigateListIndex } from '$lib/listboxNavigation';

	interface OptionProps {
		type: 'button';
		role: 'option';
		id: string;
		tabindex: -1;
		'aria-selected': boolean;
		onclick: () => void;
		onpointerdown?: (event: PointerEvent) => void;
		onpointerenter: () => void;
	}

	interface ItemArgs {
		option: T;
		index: number;
		active: boolean;
		selected: boolean;
		optionProps: OptionProps;
	}

	interface Props {
		id: string;
		label: string;
		options: readonly T[];
		activeIndex: number;
		onActiveIndexChange: (index: number) => void;
		onSelect: (option: T) => void;
		getKey: (option: T) => string | number;
		isSelected?: (option: T, index: number) => boolean;
		multiselectable?: boolean;
		/** Give the listbox itself focus for a select-only popup. */
		focusable?: boolean;
		/** Keep focus in an external combobox input during pointer selection. */
		preserveExternalFocus?: boolean;
		onEscape?: () => void;
		class?: string;
		style?: string;
		item: Snippet<[ItemArgs]>;
		empty?: Snippet;
	}

	let {
		id,
		label,
		options,
		activeIndex,
		onActiveIndexChange,
		onSelect,
		getKey,
		isSelected = () => false,
		multiselectable = false,
		focusable = false,
		preserveExternalFocus = false,
		onEscape,
		class: className = '',
		style,
		item,
		empty
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	const resolvedIndex = $derived(
		options.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), options.length - 1)
	);

	$effect(() => {
		if (options.length === 0 || !rootEl) return;
		rootEl
			.querySelector<HTMLElement>(`#${CSS.escape(`${id}-option-${resolvedIndex}`)}`)
			?.scrollIntoView({ block: 'nearest' });
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!focusable) return;

		if (event.key === 'Escape' && onEscape) {
			event.preventDefault();
			event.stopPropagation();
			onEscape();
			return;
		}

		const next = navigateListIndex(event.key, resolvedIndex, options.length);
		if (next !== null) {
			event.preventDefault();
			onActiveIndexChange(next);
			return;
		}

		if ((event.key === 'Enter' || event.key === ' ') && options.length > 0) {
			event.preventDefault();
			const option = options[resolvedIndex];
			if (option) onSelect(option);
		}
	}

	function optionPropsFor(option: T, index: number): OptionProps {
		return {
			type: 'button',
			role: 'option',
			id: `${id}-option-${index}`,
			tabindex: -1,
			'aria-selected': isSelected(option, index),
			onclick: () => onSelect(option),
			onpointerdown: preserveExternalFocus
				? (event: PointerEvent) => event.preventDefault()
				: undefined,
			onpointerenter: () => onActiveIndexChange(index)
		};
	}

	export function focus() {
		rootEl?.focus();
	}
</script>

<div
	bind:this={rootEl}
	{id}
	class="listbox {className}"
	{style}
	role="listbox"
	aria-label={label}
	aria-multiselectable={multiselectable || undefined}
	aria-activedescendant={focusable && options.length > 0
		? `${id}-option-${resolvedIndex}`
		: undefined}
	tabindex={focusable ? 0 : undefined}
	onkeydown={handleKeydown}
>
	{#each options as option, index (getKey(option))}
		{@const selected = isSelected(option, index)}
		{@const active = index === resolvedIndex}
		{@const optionProps = optionPropsFor(option, index)}
		{@render item({ option, index, active, selected, optionProps })}
	{/each}
	{#if options.length === 0 && empty}
		{@render empty()}
	{/if}
</div>
