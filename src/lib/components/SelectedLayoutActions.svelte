<script lang="ts">
	import SaveFilterModal from '$lib/components/SaveFilterModal.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		hiddenSelectedCount: number;
	}

	const { hiddenSelectedCount }: Props = $props();

	let showSaveSelectedViewModal = $state(false);
	const selectedLayoutCount = $derived(filterStore.selectedLayoutNames.size);
</script>

{#if selectedLayoutCount > 0}
	<div class="selected-layout-actions" role="presentation">
		<div class="selected-layout-actions-group">
			{#if filterStore.layoutSource !== 'selected'}
				{#if filterStore.includeSelectedInResults || hiddenSelectedCount > 0}
					<button
						type="button"
						class="selected-layout-actions-button"
						class:selected-layout-actions-button--active={filterStore.includeSelectedInResults}
						aria-pressed={filterStore.includeSelectedInResults}
						aria-label={filterStore.includeSelectedInResults
							? 'Always showing selected'
							: `Show (${hiddenSelectedCount}) non-matching selected`}
						onclick={() => filterStore.toggleIncludeSelectedInResults()}
					>
						{#if filterStore.includeSelectedInResults}
							Always showing selected layouts
						{:else}
							Show ({hiddenSelectedCount}) non-matching selected layout{hiddenSelectedCount === 1
								? ''
								: 's'}
						{/if}
					</button>
				{/if}
				<button
					type="button"
					class="selected-layout-actions-button"
					aria-label="Save selected as view"
					onclick={() => (showSaveSelectedViewModal = true)}
				>
					Save selected as view
				</button>
				<button
					type="button"
					class="selected-layout-actions-icon-button"
					aria-label="Clear selected layouts"
					title="Clear selected layouts"
					onclick={() => filterStore.clearSelectedLayouts()}
				>
					<svg
						class="size-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"
					>
						<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			{:else}
				<button
					type="button"
					class="selected-layout-actions-button selected-layout-actions-button--with-icon"
					aria-label="Clear selected layouts"
					onclick={() => filterStore.clearSelectedLayouts()}
				>
					Clear selected layouts
					<svg
						class="size-4 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"
					>
						<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
{/if}

<SaveFilterModal
	open={showSaveSelectedViewModal}
	mode="selected"
	onClose={() => (showSaveSelectedViewModal = false)}
/>

<style>
	.selected-layout-actions {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 1.25rem;
		z-index: 40;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.selected-layout-actions {
			/* Center within the results column, not the full viewport. */
			position: absolute;
		}
	}

	.selected-layout-actions-group {
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.selected-layout-actions-button {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		color: var(--text-primary);
		background-color: var(--bg-secondary);
		border: 1px solid var(--border);
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--accent) 45%, transparent);
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.selected-layout-actions-button--with-icon {
		gap: 0.375rem;
		padding-right: 0.625rem;
	}

	.selected-layout-actions-icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border-radius: 9999px;
		font-size: 0.8125rem;
		cursor: pointer;
		color: var(--text-primary);
		background-color: var(--bg-secondary);
		border: 1px solid var(--border);
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--accent) 45%, transparent);
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.selected-layout-actions-button:hover,
	.selected-layout-actions-icon-button:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.selected-layout-actions-button--active {
		color: var(--accent);
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, var(--bg-secondary));
		box-shadow: 0 4px 16px color-mix(in srgb, var(--text-primary) 8%, transparent);
	}

	.selected-layout-actions-button:focus-visible,
	.selected-layout-actions-icon-button:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--accent),
			0 0 12px 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}
</style>
