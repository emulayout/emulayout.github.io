<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onToggle: () => void;
		/** Visible label and default `aria-label` for the panel region. */
		label: string;
		panelId: string;
		/** Shows the active dot and “, active filters” in the sr-only trigger text. */
		active?: boolean;
		/** When true (default: same as `active`), shows the Reset all control. */
		showReset?: boolean;
		onReset?: () => void;
		/** Panel region label; defaults to `label`. */
		regionLabel?: string;
		/** Root element id (e.g. for scroll-into-view). */
		id?: string;
		/** Accordion surface: secondary (default) or primary nested panels. */
		surface?: 'secondary' | 'primary';
		/** Optional content in the header hint slot (e.g. Tooltip). */
		hint?: Snippet;
		children: Snippet;
	}

	let {
		open,
		onToggle,
		label,
		panelId,
		active = false,
		showReset,
		onReset,
		regionLabel = label,
		id,
		surface = 'secondary',
		hint,
		children
	}: Props = $props();

	const bg = $derived(surface === 'primary' ? 'var(--bg-primary)' : 'var(--bg-secondary)');
	const resetVisible = $derived(showReset ?? active);
</script>

<div
	{id}
	class="filter-accordion"
	class:filter-accordion--open={open}
	style="background-color: {bg}; border: 1px solid var(--border);"
>
	<div class="filter-accordion-header">
		<button
			type="button"
			class="filter-accordion-trigger"
			aria-expanded={open}
			aria-controls={panelId}
			onclick={onToggle}
		>
			<span class="sr-only">
				{label}{#if active}, active filters{/if}
			</span>
		</button>
		<div class="filter-accordion-header-face">
			<span class="filter-accordion-trigger-main">
				<svg
					class="filter-accordion-caret"
					class:filter-accordion-caret--expanded={open}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
				<span class="filter-accordion-trigger-label">
					{label}
					{#if active}
						<span class="filter-open-button-dot" aria-hidden="true"></span>
					{/if}
				</span>
			</span>
			{#if hint}
				<div class="filter-accordion-header-hint">
					{@render hint()}
				</div>
			{/if}
			<span class="filter-accordion-header-spacer" aria-hidden="true"></span>
			{#if resetVisible && onReset}
				<div class="filter-accordion-header-actions">
					<button type="button" class="filter-reset-button shrink-0" onclick={onReset}>
						Reset all
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if open}
		<div id={panelId} class="filter-accordion-panel" role="region" aria-label={regionLabel}>
			{@render children()}
		</div>
	{/if}
</div>
