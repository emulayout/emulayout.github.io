<script lang="ts">
	export type LayoutInputFeature = 'repeat' | 'adaptive' | 'magic';
	export type LayoutInputFeatureState = 'on' | 'off' | 'unavailable';

	interface Props {
		feature: LayoutInputFeature;
		state: LayoutInputFeatureState;
		label: string;
		pressed?: boolean;
		highlighted?: boolean;
		onActivate?: () => void;
	}

	const {
		feature,
		state,
		label,
		pressed = false,
		highlighted = false,
		onActivate
	}: Props = $props();
	const interactive = $derived(state !== 'unavailable' && Boolean(onActivate));
</script>

{#snippet repeatIcon()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="m17 2 4 4-4 4" />
		<path d="M3 11V9a3 3 0 0 1 3-3h15" />
		<path d="m7 22-4-4 4-4" />
		<path d="M21 13v2a3 3 0 0 1-3 3H3" />
	</svg>
{/snippet}

{#snippet adaptiveIcon()}
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<!-- Material Insights icon paths, inlined to avoid a MUI dependency. -->
		<path
			d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2"
		/>
		<path
			d="m15 9 .94-2.07L18 6l-2.06-.93L15 3l-.92 2.07L12 6l2.08.93zM3.5 11 4 9l2-.5L4 8l-.5-2L3 8l-2 .5L3 9z"
		/>
	</svg>
{/snippet}

{#snippet magicIcon()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<!-- Lucide sparkles style (inline; no icon pack dependency). -->
		<path
			d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
		/>
	</svg>
{/snippet}

{#snippet glyph()}
	<span class="input-feature-control__glyph">
		{#if feature === 'repeat'}
			{@render repeatIcon()}
		{:else if feature === 'adaptive'}
			{@render adaptiveIcon()}
		{:else}
			{@render magicIcon()}
		{/if}
	</span>
{/snippet}

{#if interactive}
	<button
		type="button"
		class="input-feature-control"
		class:input-feature-control--active={highlighted}
		data-input-feature={feature}
		data-feature-state={state}
		title={label}
		aria-label={label}
		aria-pressed={pressed}
		onclick={onActivate}
	>
		{@render glyph()}
	</button>
{:else}
	<span
		class="input-feature-control input-feature-control--presentation"
		data-input-feature={feature}
		data-feature-state={state}
		title={label}
		role="img"
		aria-label={label}
	>
		{@render glyph()}
	</span>
{/if}

<style>
	.input-feature-control {
		display: inline-flex;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0.25rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-primary);
		opacity: 0.72;
		box-shadow: none;
		transition:
			color 0.12s ease,
			opacity 0.12s ease,
			transform 0.08s ease;
	}

	button.input-feature-control {
		cursor: pointer;
	}

	button.input-feature-control:hover,
	.input-feature-control--active {
		color: var(--accent);
		opacity: 1;
	}

	button.input-feature-control:active {
		transform: translateY(1px);
	}

	button.input-feature-control:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
		outline-offset: 1px;
		opacity: 1;
	}

	.input-feature-control[data-feature-state='unavailable'] {
		color: var(--text-secondary);
		opacity: 0.42;
	}

	.input-feature-control__glyph {
		position: relative;
		display: inline-flex;
		width: 1.25rem;
		height: 1.25rem;
		align-items: center;
		justify-content: center;
	}

	.input-feature-control__glyph :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}

	.input-feature-control[data-feature-state='off'] .input-feature-control__glyph :global(svg) {
		color: var(--text-secondary);
	}

	.input-feature-control[data-feature-state='off'] .input-feature-control__glyph::after {
		position: absolute;
		width: 1.35rem;
		height: 2px;
		border-radius: 999px;
		background: var(--text-primary);
		content: '';
		transform: rotate(45deg);
		pointer-events: none;
	}

	.input-feature-control--presentation {
		cursor: default;
	}
</style>
