<script lang="ts">
	import HoverPopup from '$lib/components/HoverPopup.svelte';
	import { uiPrefs } from '$lib/uiPrefs.svelte';

	interface Props {
		text: string;
		/** Visual style of the trigger button. */
		variant?: 'help' | 'caution';
	}

	let { text, variant = 'help' }: Props = $props();

	let showTooltip = $state(false);
	let triggerEl = $state<HTMLButtonElement | undefined>(undefined);
	const tooltipId = `tooltip-${crypto.randomUUID()}`;

	const ariaLabel = $derived(variant === 'caution' ? 'Caution' : 'Help');
	/** Help tips follow the app-bar toggle; caution warnings always stay visible. */
	const hintsVisible = $derived(variant === 'caution' || uiPrefs.hintsEnabled);

	function open() {
		if (!hintsVisible) return;
		showTooltip = true;
	}

	function close() {
		showTooltip = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && showTooltip) {
			event.preventDefault();
			event.stopPropagation();
			close();
			triggerEl?.focus();
		}
	}

	$effect(() => {
		if (!hintsVisible) showTooltip = false;
	});
</script>

{#if hintsVisible}
	<span class="tooltip-root">
		<button
			bind:this={triggerEl}
			type="button"
			onmouseenter={open}
			onmouseleave={close}
			onfocus={open}
			onblur={close}
			onkeydown={handleKeyDown}
			class="tooltip-trigger"
			class:tooltip-trigger--help={variant === 'help'}
			class:tooltip-trigger--caution={variant === 'caution'}
			aria-label={ariaLabel}
			aria-describedby={showTooltip ? tooltipId : undefined}
		>
			{#if variant === 'caution'}
				<svg
					class="tooltip-trigger-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M12 9v4" />
					<path d="M12 17h.01" />
					<path
						d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
					/>
				</svg>
			{:else}
				<span class="tooltip-trigger-mark">?</span>
			{/if}
		</button>
	</span>

	<HoverPopup
		open={showTooltip}
		anchor={triggerEl}
		{text}
		id={tooltipId}
		size="default"
		placement="below"
	/>
{/if}

<style>
	.tooltip-root {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		line-height: 0;
		position: relative;
		vertical-align: middle;
	}

	.tooltip-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0;
		background: transparent;
		outline: none;
		box-shadow: none;
		cursor: help;
		appearance: none;
		-webkit-appearance: none;
		transition: color 0.15s ease;
	}

	.tooltip-trigger--help {
		width: 1rem;
		height: 1rem;
		border: 1px solid var(--text-secondary);
		border-radius: 9999px;
		color: var(--text-secondary);
		--tw-ring-color: var(--accent);
	}

	.tooltip-trigger--caution {
		width: 1rem;
		height: 1rem;
		border: 0;
		border-radius: 0;
		color: var(--warning);
		--tw-ring-color: var(--warning);
	}

	.tooltip-trigger:focus-visible {
		box-shadow: 0 0 0 2px var(--tw-ring-color, var(--accent));
	}

	.tooltip-trigger-mark {
		font-size: 10px;
		font-weight: 500;
		line-height: 1;
	}

	.tooltip-trigger-icon {
		display: block;
		width: 1rem;
		height: 1rem;
	}
</style>
