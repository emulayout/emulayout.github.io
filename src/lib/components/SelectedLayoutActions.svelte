<script lang="ts">
	import DropdownMenu from '$lib/components/DropdownMenu.svelte';
	import SaveFilterModal from '$lib/components/SaveFilterModal.svelte';
	import { filterStore } from '$lib/filterStore.svelte';

	const { hasFilteredSelection }: { hasFilteredSelection: boolean } = $props();

	let showSaveSelectedViewModal = $state(false);
	const selectedLayoutCount = $derived(filterStore.selectedLayoutNames.size);
</script>

{#if selectedLayoutCount > 0}
	<div class="selected-layout-actions" role="presentation">
		<div class="selected-layout-actions-group">
			{#if filterStore.layoutSource === 'selected' || !hasFilteredSelection}
				<button
					type="button"
					class="selected-layout-actions-button"
					onclick={() => (showSaveSelectedViewModal = true)}
				>
					Save ({selectedLayoutCount}) selected as view
				</button>
			{:else}
				<DropdownMenu menuLabel="Selected layout options" placement="top-stretch">
					{#snippet trigger({ toggle, triggerProps })}
						<div class="selected-layout-actions-split">
							<button
								type="button"
								class="selected-layout-actions-button selected-layout-actions-primary"
								aria-pressed={filterStore.includeSelectedInResults}
								onclick={() => filterStore.toggleIncludeSelectedInResults()}
							>
								{#if filterStore.includeSelectedInResults}
									<svg
										class="size-4 shrink-0"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										aria-hidden="true"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6" />
									</svg>
								{/if}
								Always show selected layouts
							</button>
							<button
								{...triggerProps}
								type="button"
								class="selected-layout-actions-button selected-layout-actions-more"
								aria-label="Selected layout options"
								onclick={toggle}
							>
								<svg
									class="size-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="m6 15 6-6 6 6" />
								</svg>
							</button>
						</div>
					{/snippet}
					{#snippet children({ close })}
						<button
							type="button"
							role="menuitem"
							tabindex="-1"
							class="selected-layout-actions-menu-item"
							onclick={() => {
								close(true);
								showSaveSelectedViewModal = true;
							}}
						>
							Save selected ({selectedLayoutCount}) layout{selectedLayoutCount === 1 ? '' : 's'} as view
						</button>
					{/snippet}
				</DropdownMenu>
			{/if}
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

	.selected-layout-actions-split {
		display: flex;
		border-radius: 9999px;
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.selected-layout-actions-split .selected-layout-actions-button {
		box-shadow: none;
	}

	.selected-layout-actions-primary {
		gap: 0.375rem;
		border-radius: 9999px 0 0 9999px;
	}

	.selected-layout-actions-more {
		margin-left: -1px;
		padding-inline: 0.625rem;
		border-radius: 0 9999px 9999px 0;
	}

	.selected-layout-actions-split .selected-layout-actions-button:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.selected-layout-actions-menu-item {
		padding: 0.5rem 0.625rem;
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
	}

	.selected-layout-actions-menu-item:hover,
	.selected-layout-actions-menu-item:focus-visible {
		background-color: var(--bg-secondary);
		outline: 1px solid var(--accent);
		outline-offset: -1px;
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

	.selected-layout-actions-button:focus-visible,
	.selected-layout-actions-icon-button:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--accent),
			0 0 12px 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}
</style>
