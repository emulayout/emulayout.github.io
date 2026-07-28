<script lang="ts">
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		mappingsLabel: string;
		inputMappingsUnavailable?: boolean;
		active?: boolean;
		onToggle?: () => void;
	}

	const {
		layout,
		mappingsLabel,
		inputMappingsUnavailable = false,
		active = false,
		onToggle
	}: Props = $props();

	const hasKnownMappings = $derived(layout.hasMagicKeyMappings || layout.hasAdaptiveSwapMappings);
	const hasAnyIndicator = $derived(
		hasKnownMappings || layout.hasMagicKey || layout.hasAdaptiveSwap
	);
	const accessibleMappingsLabel = $derived(
		mappingsLabel.charAt(0).toUpperCase() + mappingsLabel.slice(1)
	);
	const mappingsTitle = $derived(active ? `Close ${mappingsLabel}` : `Show ${mappingsLabel}`);
</script>

{#snippet adaptiveSwapIcon()}
	<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<!-- Material Insights icon paths, inlined to avoid a MUI dependency. -->
		<path
			d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2"
		/>
		<path
			d="m15 9 .94-2.07L18 6l-2.06-.93L15 3l-.92 2.07L12 6l2.08.93zM3.5 11 4 9l2-.5L4 8l-.5-2L3 8l-2 .5L3 9z"
		/>
	</svg>
{/snippet}

{#snippet magicKeyIcon()}
	<svg
		class="size-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<!-- Lucide sparkles style (inline; no icon pack dependency) -->
		<path
			d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
		/>
	</svg>
{/snippet}

{#snippet knownMappingsIcons()}
	{#if layout.hasMagicKeyMappings}
		{@render magicKeyIcon()}
	{/if}
	{#if layout.hasAdaptiveSwapMappings}
		{@render adaptiveSwapIcon()}
	{/if}
{/snippet}

{#if hasAnyIndicator}
	<div class="input-mappings-indicators">
		{#if hasKnownMappings}
			{#if onToggle}
				<button
					type="button"
					class="input-mappings-indicator input-mappings-indicator--button"
					class:input-mappings-indicator--combined={layout.hasMagicKeyMappings &&
						layout.hasAdaptiveSwapMappings}
					class:input-mappings-indicator--active={active}
					onclick={onToggle}
					title={mappingsTitle}
					aria-label={mappingsTitle}
					aria-pressed={active}
				>
					{@render knownMappingsIcons()}
				</button>
			{:else}
				<span
					class="input-mappings-indicator"
					class:input-mappings-indicator--combined={layout.hasMagicKeyMappings &&
						layout.hasAdaptiveSwapMappings}
					class:input-mappings-indicator--presentation={!inputMappingsUnavailable}
					class:input-mappings-indicator--unavailable={inputMappingsUnavailable}
					title={inputMappingsUnavailable
						? `${accessibleMappingsLabel} unavailable`
						: `${accessibleMappingsLabel} available`}
					aria-label={inputMappingsUnavailable
						? `${accessibleMappingsLabel} unavailable`
						: `${accessibleMappingsLabel} available`}
				>
					{@render knownMappingsIcons()}
				</span>
			{/if}
		{/if}

		{#if layout.hasAdaptiveSwap && !layout.hasAdaptiveSwapMappings}
			<span
				class="input-mappings-indicator input-mappings-indicator--unavailable"
				title="Adaptive swap layout; mappings unavailable"
				aria-label="Adaptive swap layout; mappings unavailable"
			>
				{@render adaptiveSwapIcon()}
			</span>
		{/if}

		{#if layout.hasMagicKey && !layout.hasMagicKeyMappings}
			<span
				class="input-mappings-indicator input-mappings-indicator--unavailable"
				title="Magic key layout; mappings unavailable"
				aria-label="Magic key layout; mappings unavailable"
			>
				{@render magicKeyIcon()}
			</span>
		{/if}
	</div>
{/if}

<style>
	.input-mappings-indicators {
		display: inline-flex;
		flex-shrink: 0;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding-right: 0.25rem;
	}

	.input-mappings-indicator {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		gap: 0.125rem;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.625rem;
		background: transparent;
		color: var(--text-primary);
		opacity: 0.72;
	}

	.input-mappings-indicator--combined {
		flex-direction: column;
		gap: 0;
		width: 2.5rem;
		padding: 0.25rem;
	}

	.input-mappings-indicator--combined :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.input-mappings-indicator--unavailable {
		color: var(--text-secondary);
		opacity: 0.42;
	}

	.input-mappings-indicator--presentation {
		opacity: 0.62;
	}

	.input-mappings-indicator--button {
		border-color: var(--border);
		background-color: var(--bg-primary);
		cursor: pointer;
		box-shadow: 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
		transition:
			background-color 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease,
			opacity 0.12s ease,
			box-shadow 0.12s ease,
			transform 0.08s ease;
	}

	.input-mappings-indicator--button:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		background-color: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
		color: var(--accent);
		opacity: 1;
	}

	.input-mappings-indicator--button:active {
		transform: translateY(1px);
		box-shadow: none;
	}

	.input-mappings-indicator--button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
		opacity: 1;
	}

	.input-mappings-indicator--active {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
		color: var(--accent);
		opacity: 1;
	}
</style>
