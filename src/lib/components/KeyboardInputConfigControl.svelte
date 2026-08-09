<script lang="ts">
	import KeyboardInputConfigModal from '$lib/components/KeyboardInputConfigModal.svelte';
	import { keyboardInputConfigLabel } from '$lib/keyboardInputConfig';
	import { keyboardInputStore } from '$lib/keyboardInputStore.svelte';

	let open = $state(false);
	const label = $derived(`Input layout: ${keyboardInputConfigLabel(keyboardInputStore.config)}`);
</script>

<button
	type="button"
	class="keyboard-input-config-trigger"
	aria-haspopup="dialog"
	onclick={() => (open = true)}
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
	<span>{label}</span>
</button>

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
</style>
