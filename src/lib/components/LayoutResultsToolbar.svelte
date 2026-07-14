<script lang="ts">
	import {
		filterStore,
		type SortBy,
		type SortOrder
	} from '$lib/filterStore.svelte';
	import { getStatSortFieldsForAnalyzer } from '$lib/layoutStats';

	interface Props {
		filteredCount: number;
		likesSortAvailable: boolean;
	}

	const { filteredCount, likesSortAvailable }: Props = $props();

	const sortIsDefault = $derived(filterStore.sortBy === 'date' && filterStore.sortOrder === 'desc');
	const statSortFields = $derived(getStatSortFieldsForAnalyzer(filterStore.statsAnalyzer));
	const displaySettingsActive = $derived(
		filterStore.hideLayoutStats || filterStore.hideLayoutTestArea || filterStore.hideLayoutLikes
	);

	let displaySettingsOpen = $state(false);
	let displaySettingsButton = $state<HTMLButtonElement | undefined>(undefined);
	let displaySettingsContainer = $state<HTMLDivElement | undefined>(undefined);
	let resultsStatus = $state<HTMLElement | undefined>(undefined);

	// One-shot: after picking a similar layout from deep in the list, scroll up to this bar.
	$effect(() => {
		if (!filterStore.scrollToSelectedLayout || !resultsStatus) return;

		const section = resultsStatus;
		let cancelled = false;

		const frame = requestAnimationFrame(() => {
			if (cancelled) return;

			const top = section.getBoundingClientRect().top + window.scrollY - 10;
			if (window.scrollY > top) {
				window.scrollTo(0, Math.max(0, top));
			}
			filterStore.clearScrollToSelectedLayout();
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	});

	$effect(() => {
		if (!displaySettingsOpen) return;

		function handlePointerDown(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (displaySettingsContainer?.contains(target)) return;
			displaySettingsOpen = false;
		}

		function handleFocusIn(event: FocusEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (displaySettingsContainer?.contains(target)) return;
			displaySettingsOpen = false;
		}

		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('focusin', handleFocusIn);

		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('focusin', handleFocusIn);
		};
	});

	function handleDisplaySettingsKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && displaySettingsOpen) {
			displaySettingsOpen = false;
			displaySettingsButton?.focus();
		}
	}
</script>

<div bind:this={resultsStatus} id="results-status" class="results-toolbar mb-2">
	<div class="results-toolbar-status">
		<p class="results-toolbar-count" style="color: var(--text-secondary);">
			Showing <span style="color: var(--accent); font-weight: 600;">{filteredCount}</span>
			{#if filterStore.hasSimilarReference}
				layouts <span style="color: var(--similar-diff); font-weight: 600;">similar</span> to
			{:else}
				layouts
			{/if}
			{#if filterStore.similarReferenceName}
				<span style="color: var(--text-primary); font-weight: 600;"
					>{filterStore.similarReferenceName}</span
				>
			{/if}
		</p>

		{#if filterStore.hasActiveFilters}
			<button
				onclick={() => filterStore.clearAll()}
				class="results-toolbar-reset text-sm px-3 py-1.5 rounded-lg transition-colors shrink-0"
				style="color: var(--accent); background-color: var(--bg-secondary); border: 1px solid var(--border);"
			>
				<span class="reset-full">Reset filters</span>
				<span class="reset-short">Reset</span>
			</button>
		{/if}
	</div>

	<div class="results-toolbar-controls">
		<label class="results-toolbar-field select-none">
			<span class="results-toolbar-label text-sm whitespace-nowrap" style="color: var(--text-secondary);"
				>Sort by</span
			>
			<select
				value={filterStore.sortBy}
				onchange={(e) => filterStore.setSortBy(e.currentTarget.value as SortBy)}
				class="results-toolbar-select px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all"
				style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid {!sortIsDefault ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
			>
				<optgroup label="Layout">
					{#if filterStore.hasSimilarReference}
						<option value="similarity">Similarity</option>
					{/if}
					<option value="name">Name</option>
					<option value="date">Date</option>
					{#if likesSortAvailable}
						<option value="likes">Likes</option>
					{/if}
				</optgroup>
				<optgroup label="Stats">
					{#each statSortFields as field (field.value)}
						<option value={field.value}>{field.label}</option>
					{/each}
				</optgroup>
			</select>
		</label>

		<label class="results-toolbar-field select-none">
			<span class="results-toolbar-label text-sm whitespace-nowrap" style="color: var(--text-secondary);"
				>Order</span
			>
			<select
				value={filterStore.sortOrder}
				onchange={(e) => filterStore.setSortOrder(e.currentTarget.value as SortOrder)}
				class="results-toolbar-select px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all"
				style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid {!sortIsDefault ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
			>
				<option value="asc">Ascending</option>
				<option value="desc">Descending</option>
			</select>
		</label>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={displaySettingsContainer}
			class="results-toolbar-gear relative"
			onkeydown={handleDisplaySettingsKeyDown}
		>
			<button
				bind:this={displaySettingsButton}
				type="button"
				onclick={() => (displaySettingsOpen = !displaySettingsOpen)}
				class="flex items-center justify-center size-[34px] rounded-lg transition-all outline-none focus:ring-2 cursor-pointer"
				style="
					background-color: var(--bg-secondary);
					color: var(--text-primary);
					border: 1px solid {displaySettingsActive || displaySettingsOpen
					? 'var(--accent)'
					: 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				aria-label="Display settings"
				aria-expanded={displaySettingsOpen}
				aria-haspopup="true"
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</button>

			{#if displaySettingsOpen}
				<div
					class="absolute right-0 top-full mt-1 z-20 min-w-44 rounded-xl p-3 flex flex-col gap-3 shadow-lg"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					role="menu"
				>
					<label class="flex items-center gap-2 select-none cursor-pointer">
						<span class="relative shrink-0">
							<input
								type="checkbox"
								checked={filterStore.hideLayoutTestArea}
								onchange={(e) => filterStore.setHideLayoutTestArea(e.currentTarget.checked)}
								class="size-4 rounded appearance-none cursor-pointer relative"
								style="
									background-color: {filterStore.hideLayoutTestArea
									? 'var(--accent)'
									: 'var(--bg-primary)'};
									border: 1px solid var(--border);
								"
							/>
							{#if filterStore.hideLayoutTestArea}
								<svg
									class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
									style="color: white;"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="3"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</span>
						<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
							>Hide test area</span
						>
					</label>

					<label class="flex items-center gap-2 select-none cursor-pointer">
						<span class="relative shrink-0">
							<input
								type="checkbox"
								checked={filterStore.hideLayoutStats}
								onchange={(e) => filterStore.setHideLayoutStats(e.currentTarget.checked)}
								class="size-4 rounded appearance-none cursor-pointer relative"
								style="
									background-color: {filterStore.hideLayoutStats
									? 'var(--accent)'
									: 'var(--bg-primary)'};
									border: 1px solid var(--border);
								"
							/>
							{#if filterStore.hideLayoutStats}
								<svg
									class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
									style="color: white;"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="3"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</span>
						<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
							>Hide stats</span
						>
					</label>

					<label class="flex items-center gap-2 select-none cursor-pointer">
						<span class="relative shrink-0">
							<input
								type="checkbox"
								checked={filterStore.hideLayoutLikes}
								onchange={(e) => filterStore.setHideLayoutLikes(e.currentTarget.checked)}
								class="size-4 rounded appearance-none cursor-pointer relative"
								style="
									background-color: {filterStore.hideLayoutLikes
									? 'var(--accent)'
									: 'var(--bg-primary)'};
									border: 1px solid var(--border);
								"
							/>
							{#if filterStore.hideLayoutLikes}
								<svg
									class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
									style="color: white;"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="3"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</span>
						<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
							>Hide likes</span
						>
					</label>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.results-toolbar {
		container-type: inline-size;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	.results-toolbar-status {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		min-width: 0;
		flex: 1 1 12rem;
	}

	.results-toolbar-count {
		margin: 0;
		line-height: 1.35;
		min-width: 0;
		flex: 1 1 auto;
	}

	.results-toolbar-reset .reset-short {
		display: none;
	}

	.results-toolbar-controls {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		margin-left: auto;
	}

	.results-toolbar-field {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	/* Narrow column (mobile / similarity results pane): denser 2-row layout */
	@container (max-width: 36rem) {
		.results-toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}

		.results-toolbar-status {
			flex: 0 0 auto;
			width: 100%;
		}

		.results-toolbar-reset .reset-full {
			display: none;
		}

		.results-toolbar-reset .reset-short {
			display: inline;
		}

		.results-toolbar-controls {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
			align-items: end;
			gap: 0.5rem;
			width: 100%;
			margin-left: 0;
		}

		.results-toolbar-field {
			flex-direction: column;
			align-items: stretch;
			gap: 0.25rem;
			min-width: 0;
		}

		.results-toolbar-select {
			width: 100%;
			min-width: 0;
		}

		.results-toolbar-gear {
			align-self: end;
		}
	}
</style>
