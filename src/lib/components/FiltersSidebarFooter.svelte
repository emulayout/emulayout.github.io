<script lang="ts">
	import { onDestroy } from 'svelte';
	import RenameViewModal from '$lib/components/RenameViewModal.svelte';
	import SaveFilterModal from '$lib/components/SaveFilterModal.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { copyTextToClipboard } from '$lib/viewFilterShare';

	interface Props {
		adjustActive: boolean;
		onToggleInactiveFilters: () => void;
	}

	const { adjustActive, onToggleInactiveFilters }: Props = $props();

	let showSaveModal = $state(false);
	let showRenameModal = $state(false);
	let saveMenuOpen = $state(false);
	let splitRootEl = $state<HTMLDivElement | undefined>(undefined);
	let shareCopied = $state(false);
	let shareCopiedTimer: ReturnType<typeof setTimeout> | null = null;

	const showUpdateSplit = $derived(
		Boolean(filterStore.activeSavedFilterId && filterStore.isActiveSavedViewDirty)
	);
	const showDuplicateSplit = $derived(
		Boolean(
			filterStore.activeSavedFilterId &&
			!filterStore.isActiveSavedViewDirty &&
			(filterStore.hasActiveFilters || filterStore.hasCustomSourceSelection)
		)
	);
	const showViewSplit = $derived(showUpdateSplit || showDuplicateSplit);
	const showShareButton = $derived(Boolean(filterStore.activeSavedFilterId));
	/** Selection-only saved views: share is the sole footer action. */
	const shareOnlyFooter = $derived(
		showShareButton && !filterStore.hasActiveFilters && !showUpdateSplit && !showDuplicateSplit
	);
	const showFooter = $derived(filterStore.hasActiveFilters || showUpdateSplit || showShareButton);

	function openSaveModal() {
		saveMenuOpen = false;
		showSaveModal = true;
	}

	function openRenameModal() {
		saveMenuOpen = false;
		showRenameModal = true;
	}

	function toggleSaveMenu() {
		saveMenuOpen = !saveMenuOpen;
	}

	async function shareActiveView() {
		const url = filterStore.buildActiveShareViewUrl();
		if (!url) return;
		const ok = await copyTextToClipboard(url);
		if (!ok) return;
		shareCopied = true;
		if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
		shareCopiedTimer = setTimeout(() => {
			shareCopied = false;
			shareCopiedTimer = null;
		}, 1600);
	}

	onDestroy(() => {
		if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
	});

	$effect(() => {
		if (!showViewSplit) saveMenuOpen = false;
	});

	$effect(() => {
		if (!saveMenuOpen) return;

		function handlePointerDown(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (splitRootEl?.contains(target)) return;
			saveMenuOpen = false;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				saveMenuOpen = false;
			}
		}

		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{#if showFooter}
	<div class="filters-sidebar-footer">
		{#if filterStore.hasActiveFilters}
			<button
				type="button"
				class="filter-reset-button filters-sidebar-footer-icon"
				class:filters-sidebar-footer-icon--active={adjustActive}
				aria-label={adjustActive ? 'Show all filters' : 'Hide inactive filters'}
				title={adjustActive ? 'Show all filters' : 'Hide inactive filters'}
				onclick={onToggleInactiveFilters}
			>
				{#if adjustActive}
					<svg
						class="filters-sidebar-footer-icon-svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				{:else}
					<svg
						class="filters-sidebar-footer-icon-svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"
						/>
						<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
						<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
						<path d="M1 1l22 22" />
					</svg>
				{/if}
			</button>
		{/if}

		{#if showShareButton}
			{#if shareOnlyFooter}
				<button
					type="button"
					class="filter-reset-button filters-sidebar-footer-button filters-sidebar-footer-primary filters-sidebar-footer-share-label"
					class:filters-sidebar-footer-icon--active={shareCopied}
					onclick={shareActiveView}
				>
					{#if shareCopied}
						<svg
							class="filters-sidebar-footer-icon-svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M20 6L9 17l-5-5" />
						</svg>
						Link copied
					{:else}
						<svg
							class="filters-sidebar-footer-icon-svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<circle cx="18" cy="5" r="3" />
							<circle cx="6" cy="12" r="3" />
							<circle cx="18" cy="19" r="3" />
							<path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
						</svg>
						Share view
					{/if}
				</button>
			{:else}
				<button
					type="button"
					class="filter-reset-button filters-sidebar-footer-icon"
					class:filters-sidebar-footer-icon--active={shareCopied}
					aria-label={shareCopied ? 'Link copied' : 'Share view'}
					title={shareCopied ? 'Link copied' : 'Share view'}
					onclick={shareActiveView}
				>
					{#if shareCopied}
						<svg
							class="filters-sidebar-footer-icon-svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M20 6L9 17l-5-5" />
						</svg>
					{:else}
						<svg
							class="filters-sidebar-footer-icon-svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<circle cx="18" cy="5" r="3" />
							<circle cx="6" cy="12" r="3" />
							<circle cx="18" cy="19" r="3" />
							<path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
						</svg>
					{/if}
				</button>
			{/if}
		{/if}

		{#if showUpdateSplit}
			<div class="filters-sidebar-footer-primary">
				<div class="filters-split-button" bind:this={splitRootEl}>
					<button
						type="button"
						class="filter-reset-button filters-split-button-main"
						onclick={() => {
							saveMenuOpen = false;
							filterStore.updateActiveSavedView();
						}}
					>
						Update view
					</button>
					<button
						type="button"
						class="filter-reset-button filters-split-button-toggle"
						aria-label="More save options"
						aria-haspopup="menu"
						aria-expanded={saveMenuOpen}
						onclick={toggleSaveMenu}
					>
						<svg
							class="filters-split-button-caret"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if saveMenuOpen}
						<div class="filters-split-menu" role="menu">
							<button
								type="button"
								role="menuitem"
								class="filters-split-menu-item"
								onclick={openSaveModal}
							>
								Save as new view
							</button>
							<button
								type="button"
								role="menuitem"
								class="filters-split-menu-item"
								onclick={openRenameModal}
							>
								Rename view
							</button>
						</div>
					{/if}
				</div>
			</div>
		{:else if showDuplicateSplit}
			<div class="filters-sidebar-footer-primary">
				<div class="filters-split-button" bind:this={splitRootEl}>
					<button
						type="button"
						class="filter-reset-button filters-split-button-main"
						onclick={openSaveModal}
					>
						Duplicate view
					</button>
					<button
						type="button"
						class="filter-reset-button filters-split-button-toggle"
						aria-label="More view options"
						aria-haspopup="menu"
						aria-expanded={saveMenuOpen}
						onclick={toggleSaveMenu}
					>
						<svg
							class="filters-split-button-caret"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if saveMenuOpen}
						<div class="filters-split-menu" role="menu">
							<button
								type="button"
								role="menuitem"
								class="filters-split-menu-item"
								onclick={openRenameModal}
							>
								Rename view
							</button>
						</div>
					{/if}
				</div>
			</div>
		{:else if filterStore.hasActiveFilters}
			<button
				type="button"
				class="filter-reset-button filters-sidebar-footer-button filters-sidebar-footer-primary"
				onclick={openSaveModal}
			>
				Save as view
			</button>
		{/if}

		{#if filterStore.hasActiveFilters || (filterStore.activeSavedFilterId && filterStore.isActiveSavedViewDirty)}
			<button
				type="button"
				class="filter-reset-button filters-sidebar-footer-icon"
				aria-label={filterStore.activeSavedFilterId && filterStore.isActiveSavedViewDirty
					? 'Reset view'
					: 'Reset all'}
				title={filterStore.activeSavedFilterId && filterStore.isActiveSavedViewDirty
					? 'Reset view'
					: 'Reset all'}
				onclick={() => filterStore.resetFilters()}
			>
				<svg
					class="filters-sidebar-footer-icon-svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
					<path d="M3 3v5h5" />
				</svg>
			</button>
		{/if}
	</div>
{/if}

<SaveFilterModal open={showSaveModal} onClose={() => (showSaveModal = false)} />
<RenameViewModal open={showRenameModal} onClose={() => (showRenameModal = false)} />

<style>
	.filters-sidebar-footer {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 0.5rem;
		flex-shrink: 0;
		padding-top: var(--filters-reset-pad);
	}

	.filters-sidebar-footer-primary {
		flex: 1 1 auto;
		min-width: 0;
	}

	.filters-sidebar-footer-button {
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.filters-sidebar-footer-share-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
	}

	.filters-sidebar-footer-icon {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		min-height: 2.5rem;
		padding: 0;
		border-radius: 0.75rem;
	}

	.filters-sidebar-footer-icon--active {
		border-color: var(--filter-action);
		background-color: color-mix(in srgb, var(--filter-action) 18%, var(--bg-primary));
		color: var(--filter-action);
	}

	.filters-sidebar-footer-icon-svg {
		width: 1rem;
		height: 1rem;
	}

	.filters-split-button {
		position: relative;
		display: flex;
		align-items: stretch;
		width: 100%;
		min-width: 0;
	}

	.filters-split-button-main,
	.filters-split-button-toggle {
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.filters-split-button-main {
		flex: 1 1 auto;
		min-width: 0;
		justify-content: center;
		border-radius: 0.75rem 0 0 0.75rem;
		border-right-width: 0;
	}

	.filters-split-button-toggle {
		flex: 0 0 auto;
		width: 2.25rem;
		padding-left: 0;
		padding-right: 0;
		border-radius: 0 0.75rem 0.75rem 0;
	}

	.filters-split-button-caret {
		width: 0.875rem;
		height: 0.875rem;
	}

	.filters-split-menu {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(100% + 0.25rem);
		z-index: 20;
		display: flex;
		flex-direction: column;
		padding: 0.25rem;
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		background-color: var(--bg-primary);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	}

	.filters-split-menu-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}

	.filters-split-menu-item:hover {
		background-color: color-mix(in srgb, var(--filter-action) 12%, var(--bg-primary));
	}

	.filters-split-menu-item:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--filter-action);
	}
</style>
