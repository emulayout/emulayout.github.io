<script lang="ts">
	import { filterStore, type SortBy, type SortOrder } from '$lib/filterStore.svelte';
	import {
		clearActiveFilterChip,
		getActiveFilterChips,
		type ActiveFilterChip
	} from '$lib/filterSummaries';
	import SourceSelectionModal from '$lib/components/SourceSelectionModal.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		getHiddenAnalyzerFilterCaution,
		getStatSortFieldsForAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzerMode
	} from '$lib/layoutStats';

	interface Props {
		filteredCount: number;
		likesSortAvailable: boolean;
	}

	const { filteredCount, likesSortAvailable }: Props = $props();

	const filterChips = $derived.by(() => {
		void filterStore.appliedFiltersRevision;
		void filterStore.hasCustomSourceSelection;
		void filterStore.sourceLayoutCount;
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

	function clearChip(chip: ActiveFilterChip, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		clearActiveFilterChip(filterStore, chip.clear);
	}

	function openChip(chip: ActiveFilterChip) {
		if (chip.focus.target === 'source') {
			filterStore.openSourceSelectionModal();
			return;
		}
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
	<div class="results-toolbar-filters-row">
		<div class="results-toolbar-filters" aria-label="Active filters">
			{#if filterChips.length > 0}
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
			{/if}
		</div>

		<div class="results-toolbar-analyzer">
			<span class="results-toolbar-analyzer-label" style="color: var(--text-secondary);">
				Analyzer
				{#if hiddenAnalyzerFilterCaution}
					<Tooltip variant="caution" text={hiddenAnalyzerFilterCaution.text} />
				{/if}
			</span>
			<div
				class="results-analyzer-tabs"
				style="background-color: var(--bg-primary); border: 1px solid var(--border);"
				role="tablist"
				aria-label="Analyzer"
			>
				{#each STAT_ANALYZERS as analyzerDef (analyzerDef.value)}
					{@const selected = filterStore.statsAnalyzer === analyzerDef.value}
					<button
						type="button"
						role="tab"
						aria-selected={selected}
						tabindex={selected ? 0 : -1}
						class="results-analyzer-tab"
						class:results-analyzer-tab--selected={selected}
						class:results-analyzer-tab--cmini={analyzerDef.value === DEFAULT_STATS_ANALYZER}
						class:results-analyzer-tab--cyanophage={analyzerDef.value === CYANOPHAGE_ANALYZER}
						class:results-analyzer-tab--mana2={analyzerDef.value === MANA2_ANALYZER}
						onclick={() => filterStore.setStatsAnalyzer(analyzerDef.value as StatsAnalyzerMode)}
					>
						{analyzerDef.shortLabel}
					</button>
				{/each}
			</div>
		</div>
	</div>

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
		</div>
	</div>
</div>

<SourceSelectionModal />

<style>
	.results-toolbar-shell {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.results-toolbar-filters-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		width: 100%;
		min-width: 0;
	}

	.results-toolbar-filters {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		flex: 1 1 auto;
		font-size: 0.8125rem;
		line-height: 1.35;
	}

	.results-toolbar-filters-label {
		flex-shrink: 0;
		font-weight: 600;
		color: var(--text-caption);
	}

	.results-toolbar-filter-chips {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.375rem;
		margin: 0;
		padding: 0.125rem 0;
		list-style: none;
		min-width: 0;
		flex: 1 1 auto;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.results-toolbar-filter-chips::-webkit-scrollbar {
		display: none;
	}

	.results-toolbar-filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		max-width: 16rem;
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

	.results-toolbar-analyzer {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		margin-left: auto;
	}

	.results-toolbar-analyzer-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		line-height: 1.2;
		white-space: nowrap;
	}

	.results-analyzer-tabs {
		display: inline-grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.125rem;
		padding: 0.125rem;
		border-radius: 0.375rem;
	}

	.results-analyzer-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3.5rem;
		padding: 0.125rem 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.2;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.results-analyzer-tab:hover {
		color: var(--text-primary);
	}

	.results-analyzer-tab:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.results-analyzer-tab--selected {
		font-weight: 600;
		color: var(--text-primary);
		background-color: color-mix(in srgb, var(--text-primary) 8%, var(--bg-primary));
		border-color: var(--border);
	}

	.results-analyzer-tab--cmini.results-analyzer-tab--selected {
		color: var(--analyzer-cmini);
		border-color: color-mix(in srgb, var(--analyzer-cmini) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cmini) 14%, var(--bg-primary));
	}

	.results-analyzer-tab--cyanophage.results-analyzer-tab--selected {
		color: var(--analyzer-cyanophage);
		border-color: color-mix(in srgb, var(--analyzer-cyanophage) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-cyanophage) 14%, var(--bg-primary));
	}

	.results-analyzer-tab--mana2.results-analyzer-tab--selected {
		color: var(--analyzer-mana2);
		border-color: color-mix(in srgb, var(--analyzer-mana2) 45%, var(--border));
		background-color: color-mix(in srgb, var(--analyzer-mana2) 14%, var(--bg-primary));
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

	/* Narrow column (mobile / similarity results pane): denser layout */
	@container (max-width: 36rem) {
		.results-toolbar-filters-row {
			flex-direction: column;
			align-items: stretch;
		}

		.results-toolbar-analyzer {
			margin-left: 0;
			justify-content: space-between;
			width: 100%;
		}

		.results-analyzer-tabs {
			display: grid;
			flex: 1 1 auto;
			min-width: 0;
		}

		.results-analyzer-tab {
			min-width: 0;
		}

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
			grid-template-columns: repeat(2, minmax(0, 1fr));
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
	}
</style>
