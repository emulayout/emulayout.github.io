<script lang="ts">
	import LayoutInputFeatureIcon, {
		type LayoutInputFeature as InputFeature
	} from '$lib/components/LayoutInputFeatureIcon.svelte';

	export type LayoutInputFeature = InputFeature;
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

{#snippet glyph()}
	<span class="input-feature-control__glyph">
		<LayoutInputFeatureIcon {feature} />
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
