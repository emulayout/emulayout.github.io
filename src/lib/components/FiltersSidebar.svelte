<script lang="ts">
	import ActiveFiltersAdjust from '$lib/components/ActiveFiltersAdjust.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import KeyFilters from '$lib/components/KeyFilters.svelte';
	import KeyboardFilters from '$lib/components/KeyboardFilters.svelte';
	import SaveFilterModal from '$lib/components/SaveFilterModal.svelte';
	import SimilarityFilters from '$lib/components/SimilarityFilters.svelte';
	import StatFilters from '$lib/components/StatFilters.svelte';
	import { buildActiveFiltersSnapshot, type ActiveFiltersSnapshot } from '$lib/activeFiltersAdjust';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';
	import type { LayoutData } from '$lib/layout';
	import { copyTextToClipboard } from '$lib/viewFilterShare';

	interface Props {
		authorList: Array<{ id: number; name: string }>;
		layouts: LayoutData[];
	}

	let { authorList, layouts }: Props = $props();

	let authorOpenSeq = $state(0);
	let adjustActive = $state(false);
	let adjustSnapshot = $state<ActiveFiltersSnapshot | null>(null);
	let showSaveModal = $state(false);
	let saveMenuOpen = $state(false);
	let splitRootEl = $state<HTMLDivElement | undefined>(undefined);
	let shareCopied = $state(false);
	let shareCopiedTimer: ReturnType<typeof setTimeout> | null = null;

	const showUpdateSplit = $derived(
		Boolean(filterStore.activeSavedFilterId && filterStore.isActiveSavedViewDirty)
	);
	const showShareButton = $derived(Boolean(filterStore.activeSavedFilterId));
	const showFooter = $derived(
		filterStore.hasActiveFilters || showUpdateSplit || showShareButton
	);

	function exitAdjustMode() {
		adjustActive = false;
		adjustSnapshot = null;
	}

	function showAllFilters() {
		exitAdjustMode();
	}

	function hideInactiveFilters() {
		if (adjustActive || !filterStore.hasActiveFilters) return;
		adjustSnapshot = buildActiveFiltersSnapshot(filterStore);
		adjustActive = true;
	}

	function toggleInactiveFilters() {
		if (adjustActive) showAllFilters();
		else hideInactiveFilters();
	}

	function openSaveModal() {
		saveMenuOpen = false;
		showSaveModal = true;
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

	$effect(() => {
		return () => {
			if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
		};
	});

	$effect(() => {
		if (!showUpdateSplit) saveMenuOpen = false;
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

	$effect(() => {
		if (adjustActive && !filterStore.hasActiveFilters) {
			exitAdjustMode();
		}
	});

	$effect(() => {
		const sidebarReq = takeFilterFocusRequest('sidebar');
		if (!sidebarReq) return;

		exitAdjustMode();
		afterPaint(() => {
			if (sidebarReq.field === 'name') {
				focusFilterControl(document.getElementById('name-filter'));
			} else if (sidebarReq.field === 'authors') {
				authorOpenSeq = sidebarReq.seq;
				document
					.getElementById('author-filter-trigger')
					?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			} else if (sidebarReq.field === 'similarity') {
				const el =
					document.getElementById('similarity-match-value') ??
					document.getElementById('similarity-layout-search');
				focusFilterControl(el);
			}
		});
	});

	// Chip focus opens section components; exit adjust so controls can show.
	$effect(() => {
		const keyboardReq = takeFilterFocusRequest('keyboard');
		if (keyboardReq) {
			exitAdjustMode();
			return;
		}
		const keysReq = takeFilterFocusRequest('keys');
		if (keysReq) {
			exitAdjustMode();
			return;
		}
		const statsReq = takeFilterFocusRequest('stats');
		if (statsReq) exitAdjustMode();
	});
</script>

<div class="filters-sidebar">
	<div class="filters-sidebar-panel">
		{#if adjustActive && adjustSnapshot}
			<div class="filters-sidebar-adjust">
				<ActiveFiltersAdjust snapshot={adjustSnapshot} {layouts} {authorList} {authorOpenSeq} />
			</div>
		{:else}
			<div class="filters-sidebar-search">
				<label class="filters-field">
					<span class="filters-label" style="color: var(--text-secondary);">Layout name</span>
					<input
						id="name-filter"
						type="text"
						value={filterStore.nameFilterInput}
						oninput={(e) => filterStore.setNameFilter(e.currentTarget.value)}
						class="filters-input"
						style="
							background-color: var(--input-bg);
							color: var(--text-primary);
							border: 1px solid var(--border);
							--tw-ring-color: var(--accent);
						"
						placeholder="Use commas for multiple results"
					/>
				</label>

				<div class="filters-field">
					<div class="filters-label" style="color: var(--text-secondary);">Author</div>
					<AuthorSelect
						authors={authorList}
						selectedIds={filterStore.selectedAuthors}
						onToggle={(id) => filterStore.toggleAuthor(id)}
						onClear={() => filterStore.clearAuthors()}
						openSeq={authorOpenSeq}
					/>
				</div>
			</div>

			<div class="filters-sidebar-actions">
				<KeyboardFilters />
			</div>

			<div class="filters-sidebar-actions">
				<KeyFilters />
			</div>

			<div class="filters-sidebar-actions">
				<StatFilters />
			</div>

			<div class="filters-sidebar-actions">
				<SimilarityFilters {layouts} />
			</div>
		{/if}
	</div>

	{#if showFooter}
		<div class="filters-sidebar-footer">
			{#if filterStore.hasActiveFilters}
				<button
					type="button"
					class="filter-reset-button filters-sidebar-footer-icon"
					class:filters-sidebar-footer-icon--active={adjustActive}
					aria-label={adjustActive ? 'Show all filters' : 'Hide inactive filters'}
					title={adjustActive ? 'Show all filters' : 'Hide inactive filters'}
					onclick={toggleInactiveFilters}
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
							<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
							<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
							<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
							<path d="M1 1l22 22" />
						</svg>
					{/if}
				</button>
			{/if}

			{#if showShareButton}
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
					{filterStore.activeSavedFilterId ? 'Duplicate view' : 'Save as view'}
				</button>
			{/if}

			{#if filterStore.hasActiveFilters}
				<button
					type="button"
					class="filter-reset-button filters-sidebar-footer-icon"
					aria-label="Reset all"
					title="Reset all"
					onclick={() => filterStore.clearAll()}
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
</div>

<SaveFilterModal open={showSaveModal} onClose={() => (showSaveModal = false)} />

<style>
	.filters-sidebar {
		--filters-chrome-edge: 0.25rem;
		--filters-reset-pad: 1rem;

		display: flex;
		flex-direction: column;
		gap: 0;
		padding-top: var(--filters-chrome-edge);
		padding-bottom: var(--filters-reset-pad);
		box-sizing: border-box;
		min-width: 0;
	}

	.filters-sidebar-panel {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.filters-sidebar-search,
	.filters-sidebar-actions,
	.filters-sidebar-adjust {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

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
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.filters-sidebar-footer-icon {
		flex: 0 0 auto;
		width: 2.5rem;
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

	.filters-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}

	.filters-label {
		font-size: 0.875rem;
		line-height: 1.25;
	}

	.filters-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
	}

	.filters-input:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.filters-input:-webkit-autofill:focus-visible {
		box-shadow:
			0 0 0 1000px var(--input-bg) inset,
			0 0 0 2px var(--accent);
	}

	/* Split view: fill the rail and scroll the filter body independently. */
	@media (min-width: 768px) {
		.filters-sidebar {
			flex: 1 1 auto;
			min-height: 0;
			height: 100%;
		}

		.filters-sidebar-panel {
			flex: 1 1 0;
			min-height: 0;
			overflow-x: hidden;
			overflow-y: auto;
			overscroll-behavior: contain;
			-webkit-overflow-scrolling: touch;
			/* Room for focus rings clipped by overflow. */
			padding: 0.125rem;
			margin: -0.125rem;
			scrollbar-width: thin;
			scrollbar-color: color-mix(in srgb, var(--text-caption) 70%, transparent) transparent;
		}

		.filters-sidebar-panel::-webkit-scrollbar {
			width: 8px;
			height: 8px;
		}

		.filters-sidebar-panel::-webkit-scrollbar-thumb {
			background: color-mix(in srgb, var(--text-caption) 70%, transparent);
			border-radius: 999px;
		}

		.filters-sidebar-panel::-webkit-scrollbar-track {
			background: transparent;
		}
	}
</style>
