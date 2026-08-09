<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import HoverPopup from '$lib/components/HoverPopup.svelte';
	import KeyboardInputConfigModal from '$lib/components/KeyboardInputConfigModal.svelte';
	import { TAILWIND_BREAKPOINTS } from '$lib/constants';
	import { keyboardInputConfigLabel } from '$lib/keyboardInputConfig';
	import { keyboardInputStore } from '$lib/keyboardInputStore.svelte';

	interface Props {
		/** Hide the visible label below the small breakpoint and disclose it as a tooltip. */
		responsiveLabel?: boolean;
	}

	let { responsiveLabel = false }: Props = $props();
	let open = $state(false);
	let showTooltip = $state(false);
	let triggerEl = $state<HTMLButtonElement | undefined>(undefined);
	const smUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`);
	const tooltipId = `keyboard-input-config-tooltip-${crypto.randomUUID()}`;
	const label = $derived(`Input layout: ${keyboardInputConfigLabel(keyboardInputStore.config)}`);
	const iconOnly = $derived(responsiveLabel && !smUp.current);

	function openTooltip() {
		if (iconOnly && !open) showTooltip = true;
	}

	function closeTooltip() {
		showTooltip = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !showTooltip) return;
		event.preventDefault();
		event.stopPropagation();
		closeTooltip();
	}

	$effect(() => {
		if (!iconOnly || open) closeTooltip();
	});
</script>

<button
	bind:this={triggerEl}
	type="button"
	class="keyboard-input-config-trigger"
	class:keyboard-input-config-trigger--responsive={responsiveLabel}
	aria-label={label}
	aria-describedby={showTooltip ? tooltipId : undefined}
	aria-haspopup="dialog"
	onmouseenter={openTooltip}
	onmouseleave={closeTooltip}
	onfocus={openTooltip}
	onblur={closeTooltip}
	onkeydown={handleKeydown}
	onclick={() => {
		closeTooltip();
		open = true;
	}}
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<rect width="20" height="14" x="2" y="5" rx="2" />
		<path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 13h.01M11 13h.01M15 13h.01M19 13h.01M6 17h12" />
	</svg>
	<span class="keyboard-input-config-label">{label}</span>
</button>

<HoverPopup
	open={showTooltip}
	anchor={triggerEl}
	text={label}
	id={tooltipId}
	size="compact"
	placement="below"
/>

<KeyboardInputConfigModal
	{open}
	config={keyboardInputStore.config}
	onClose={() => (open = false)}
	onSave={(config) => {
		keyboardInputStore.setConfig(config);
		open = false;
	}}
/>

<style>
	.keyboard-input-config-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 1.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
		cursor: pointer;
	}

	.keyboard-input-config-trigger:hover {
		color: var(--text-primary);
	}

	.keyboard-input-config-trigger:focus-visible {
		border-radius: 0.25rem;
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 0.15rem;
	}

	.keyboard-input-config-trigger svg {
		width: 1.125rem;
		height: 1.125rem;
		flex: none;
	}

	@media (max-width: 39.999rem) {
		.keyboard-input-config-trigger--responsive {
			justify-content: center;
			width: 2.125rem;
			height: 2.125rem;
			min-height: 2.125rem;
		}

		.keyboard-input-config-trigger--responsive .keyboard-input-config-label {
			display: none;
		}
	}
</style>
