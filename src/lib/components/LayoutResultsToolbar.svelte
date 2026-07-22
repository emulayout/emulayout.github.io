<script lang="ts">
	import { filterStore, type SortBy, type SortOrder } from '$lib/filterStore.svelte';
	import {
		clearActiveFilterChip,
		getActiveFilterChips,
		type ActiveFilterChip
	} from '$lib/filterSummaries';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		getHiddenAnalyzerFilterCaution,
		getStatSortFieldsForAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZER_MODES,
		type StatsAnalyzerMode
	} from '$lib/layoutStats';

	interface Props {
		filteredCount: number;
		likesSortAvailable: boolean;
	}

	const { filteredCount, likesSortAvailable }: Props = $props();

	const filterChips = $derived.by(() => {
		void filterStore.appliedFiltersRevision;
		return getActiveFilterChips(filterStore);
	});
	const monkeySortFields = $derived(getStatSortFieldsForAnalyzer(DEFAULT_STATS_ANALYZER));
	const cyanophageSortFields = $derived(getStatSortFieldsForAnalyzer(CYANOPHAGE_ANALYZER));
	const mana2SortFields = $derived(getStatSortFieldsForAnalyzer(MANA2_ANALYZER));

	/** Hidden analyzer still narrowing results via applied stat filters. */
	const hiddenAnalyzerFilterCaution = $derived(
		getHiddenAnalyzerFilterCaution(filterStore.statsAnalyzer, filterStore.appliedStatLimits, {
			includeLikes: filterStore.canUseLikes
		})
	);

	let displaySettingsOpen = $state(false);
	let displaySettingsButton = $state<HTMLButtonElement | undefined>(undefined);
	let displaySettingsContainer = $state<HTMLDivElement | undefined>(undefined);
	let resultsStatus = $state<HTMLElement | undefined>(undefined);

	// One-shot: after picking a similar layout from deep in the list, bring this bar into view.
	$effect(() => {
		if (!filterStore.scrollToSelectedLayout || !resultsStatus) return;

		const section = resultsStatus;
		let cancelled = false;

		const frame = requestAnimationFrame(() => {
			if (cancelled) return;

			section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

	function clearChip(chip: ActiveFilterChip, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		clearActiveFilterChip(filterStore, chip.clear);
	}

	function openChip(chip: ActiveFilterChip) {
		filterStore.requestFilterFocus(chip.focus);
	}

	function handleChipKeyDown(chip: ActiveFilterChip, event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openChip(chip);
		}
	}
</script>

<div bind:this={resultsStatus} id="results-status" class="results-toolbar-shell mb-2">
	{#if filterChips.length > 0}
		<div class="results-toolbar-filters" aria-label="Active filters">
			<span class="results-toolbar-filters-label">Filters</span>
			<ul class="results-toolbar-filter-chips">
				{#each filterChips as chip (chip.id)}
					<li
						class="results-toolbar-filter-chip results-toolbar-filter-chip--{chip.tone}"
						title={chip.title}
						role="button"
						tabindex="0"
						aria-label="Edit filter: {chip.label}"
						onclick={() => openChip(chip)}
						onkeydown={(event) => handleChipKeyDown(chip, event)}
					>
						<span class="results-toolbar-filter-chip-label">{chip.label}</span>
						<button
							type="button"
							class="results-toolbar-filter-chip-clear"
							aria-label="Clear filter: {chip.label}"
							onclick={(event) => clearChip(chip, event)}
						>
							<svg
								class="size-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
								aria-hidden="true"
							>
								<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="results-toolbar">
		<div class="results-toolbar-status">
			<p class="results-toolbar-count" style="color: var(--text-secondary);">
				Showing <span style="color: var(--accent); font-weight: 600;">{filteredCount}</span>
				{#if filterStore.layoutSource === 'selected'}
					selected layouts
				{:else}
					layouts
				{/if}
				{#if filterStore.hasSimilarReference}
					<span style="color: var(--similar-diff); font-weight: 600;">similar</span> to
				{/if}
				{#if filterStore.similarReferenceName}
					<span style="color: var(--text-primary); font-weight: 600;"
						>{filterStore.similarReferenceName}</span
					>
				{/if}
			</p>
		</div>

		<div class="results-toolbar-controls">
			<label class="results-toolbar-field select-none">
				<span
					class="results-toolbar-label text-sm whitespace-nowrap"
					style="color: var(--text-secondary);"
				>
					Analyzer
					{#if hiddenAnalyzerFilterCaution}
						<Tooltip variant="caution" text={hiddenAnalyzerFilterCaution.text} />
					{/if}
				</span>
				<select
					value={filterStore.statsAnalyzer}
					onchange={(e) => filterStore.setStatsAnalyzer(e.currentTarget.value as StatsAnalyzerMode)}
					class="results-toolbar-select px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
					--tw-ring-color: var(--accent);
				"
					aria-label="Analyzer"
				>
					{#each STAT_ANALYZER_MODES as analyzer (analyzer.value)}
						<option value={analyzer.value}>{analyzer.label}</option>
					{/each}
				</select>
			</label>

			<label class="results-toolbar-field select-none">
				<span
					class="results-toolbar-label text-sm whitespace-nowrap"
					style="color: var(--text-secondary);">Sort by</span
				>
				<select
					value={filterStore.sortBy}
					onchange={(e) => filterStore.setSortBy(e.currentTarget.value as SortBy)}
					class="results-toolbar-select px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
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
					<optgroup label="cmini (monkeyracer)">
						{#each monkeySortFields as field (field.value)}
							<option value={field.value}>{field.label}</option>
						{/each}
					</optgroup>
					<optgroup label="Cyanophage">
						{#each cyanophageSortFields as field (field.value)}
							<option value={field.value}>{field.label}</option>
						{/each}
					</optgroup>
					<optgroup label="Mana2">
						{#each mana2SortFields as field (field.value)}
							<option value={field.value}>{field.label}</option>
						{/each}
					</optgroup>
				</select>
			</label>

			<label class="results-toolbar-field select-none">
				<span
					class="results-toolbar-label text-sm whitespace-nowrap"
					style="color: var(--text-secondary);">Order</span
				>
				<select
					value={filterStore.sortOrder}
					onchange={(e) => filterStore.setSortOrder(e.currentTarget.value as SortOrder)}
					class="results-toolbar-select px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid var(--border);
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
					border: 1px solid {displaySettingsOpen ? 'var(--accent)' : 'var(--border)'};
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
									background-color: {filterStore.hideLayoutTestArea ? 'var(--accent)' : 'var(--bg-primary)'};
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
									background-color: {filterStore.hideLayoutStats ? 'var(--accent)' : 'var(--bg-primary)'};
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
									background-color: {filterStore.hideLayoutLikes ? 'var(--accent)' : 'var(--bg-primary)'};
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

						<label class="flex items-center gap-2 select-none cursor-pointer">
							<span class="relative shrink-0">
								<input
									type="checkbox"
									checked={filterStore.hideNewLayoutIndicator}
									onchange={(e) => filterStore.setHideNewLayoutIndicator(e.currentTarget.checked)}
									class="size-4 rounded appearance-none cursor-pointer relative"
									style="
									background-color: {filterStore.hideNewLayoutIndicator ? 'var(--accent)' : 'var(--bg-primary)'};
									border: 1px solid var(--border);
								"
								/>
								{#if filterStore.hideNewLayoutIndicator}
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
								>Hide new indicator</span
							>
						</label>

						<label class="flex items-center gap-2 select-none cursor-pointer">
							<span class="relative shrink-0">
								<input
									type="checkbox"
									checked={filterStore.stickySimilarityCard}
									onchange={(e) => filterStore.setStickySimilarityCard(e.currentTarget.checked)}
									class="size-4 rounded appearance-none cursor-pointer relative"
									style="
									background-color: {filterStore.stickySimilarityCard ? 'var(--accent)' : 'var(--bg-primary)'};
									border: 1px solid var(--border);
								"
								/>
								{#if filterStore.stickySimilarityCard}
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
								>Sticky similarity card</span
							>
						</label>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.results-toolbar-shell {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.results-toolbar-filters {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		font-size: 0.8125rem;
		line-height: 1.35;
	}

	.results-toolbar-filters-label {
		flex-shrink: 0;
		padding-top: 0.25rem;
		font-weight: 600;
		color: var(--text-caption);
	}

	.results-toolbar-filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 0;
		flex: 1 1 auto;
	}

	.results-toolbar-filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 100%;
		padding: 0.15rem 0.2rem 0.15rem 0.65rem;
		border-radius: 9999px;
		border: 1px solid var(--border);
		background-color: color-mix(in srgb, var(--text-caption) 10%, var(--bg-primary));
		color: var(--text-secondary);
		cursor: pointer;
	}

	.results-toolbar-filter-chip:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.results-toolbar-filter-chip-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.results-toolbar-filter-chip-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.15rem;
		height: 1.15rem;
		border: none;
		border-radius: 9999px;
		background: transparent;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
	}

	.results-toolbar-filter-chip-clear:hover {
		opacity: 1;
		background-color: color-mix(in srgb, currentColor 14%, transparent);
	}

	.results-toolbar-filter-chip-clear:focus-visible {
		outline: none;
		opacity: 1;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.results-toolbar-filter-chip--monkeyracer {
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cmini) 16%, var(--bg-primary));
		color: var(--analyzer-cmini);
	}

	.results-toolbar-filter-chip--cyanophage {
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cyanophage) 16%, var(--bg-primary));
		color: var(--analyzer-cyanophage);
	}

	.results-toolbar-filter-chip--mana2 {
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-mana2) 16%, var(--bg-primary));
		color: var(--analyzer-mana2);
	}

	.results-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	.results-toolbar-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		min-width: 0;
		flex: 0 1 auto;
	}

	.results-toolbar-count {
		margin: 0;
		line-height: 1.35;
		min-width: 0;
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

	.results-toolbar-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
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
