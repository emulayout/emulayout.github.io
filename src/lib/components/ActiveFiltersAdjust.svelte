<script lang="ts">
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import KeyboardFiltersBody from '$lib/components/KeyboardFiltersBody.svelte';
	import SimilarityFilters from '$lib/components/SimilarityFilters.svelte';
	import StatLimitFiltersBody from '$lib/components/StatLimitFiltersBody.svelte';
	import {
		activeKeyKinds,
		snapshotHasKeyboard,
		type ActiveFiltersSnapshot
	} from '$lib/activeFiltersAdjust';
	import { filterStore, type LayoutSource } from '$lib/filterStore.svelte';
	import type { KeyFilterKind } from '$lib/filterSummaries';
	import type { LayoutData } from '$lib/layout';
	import {
		analyzerShortLabel,
		STAT_ANALYZERS,
		type StatLimitKey,
		type StatsAnalyzer
	} from '$lib/layoutStats';

	interface Props {
		snapshot: ActiveFiltersSnapshot;
		layouts: LayoutData[];
		authorList: Array<{ id: number; name: string }>;
		authorOpenSeq?: number;
	}

	let { snapshot, layouts, authorList, authorOpenSeq = 0 }: Props = $props();

	const hideThumbKeys = $derived(filterStore.thumbKeyFilter === 'excluded');
	const keyKinds = $derived(activeKeyKinds(snapshot.keys));

	const statsByAnalyzer = $derived.by(() => {
		const groups: Array<{
			analyzer: StatsAnalyzer;
			general: StatLimitKey[];
			hands: StatLimitKey[];
		}> = [];

		for (const entry of STAT_ANALYZERS) {
			const general: StatLimitKey[] = [];
			const hands: StatLimitKey[] = [];
			for (const item of snapshot.stats) {
				if (item.analyzer !== entry.value) continue;
				if (item.section === 'general') general.push(item.key);
				else hands.push(item.key);
			}
			if (general.length > 0 || hands.length > 0) {
				groups.push({ analyzer: entry.value, general, hands });
			}
		}
		return groups;
	});

	function keyTitle(kind: KeyFilterKind): string {
		if (kind === 'and') return 'Include keys (AND)';
		if (kind === 'or') return 'Include keys (OR)';
		return 'Exclude keys';
	}
</script>

<div class="active-filters-adjust">
	{#if snapshot.source || snapshot.name || snapshot.authors}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label">Search</span>
			</div>
			<div class="adjust-section-body">
				{#if snapshot.source}
					<label class="filters-field">
						<span class="filters-label" style="color: var(--text-secondary);">Source</span>
						<select
							id="layout-source-filter"
							value={filterStore.layoutSource}
							onchange={(e) =>
								filterStore.setLayoutSource(e.currentTarget.value as LayoutSource)}
							class="filters-select"
							style="
								background-color: var(--input-bg);
								color: var(--text-primary);
								border: 1px solid var(--border);
								--tw-ring-color: var(--accent);
							"
							aria-label="Layout source"
						>
							<option value="all">All layouts</option>
							<option value="selected" disabled={filterStore.compareSelectedNames.size === 0}>
								Selected layouts only
							</option>
						</select>
					</label>
				{/if}

				{#if snapshot.name}
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
				{/if}

				{#if snapshot.authors}
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
				{/if}
			</div>
		</div>
	{/if}

	{#if snapshotHasKeyboard(snapshot.keyboard)}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label">Keyboard filters</span>
			</div>
			<div class="adjust-section-body">
				<KeyboardFiltersBody only={snapshot.keyboard} />
			</div>
		</div>
	{/if}

	{#each keyKinds as kind (kind)}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label">{keyTitle(kind)}</span>
			</div>
			<div class="adjust-section-body">
				{#if kind === 'and'}
					<KeyPositionFilter
						grid={filterStore.includeGrid}
						leftThumbKeys={filterStore.includeLeftThumbKeys}
						rightThumbKeys={filterStore.includeRightThumbKeys}
						{hideThumbKeys}
						accentColor="#4ade80"
						nested
						compact
						onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
						onLeftThumbKeyChange={(index, value) =>
							filterStore.setIncludeLeftThumbKey(index, value)}
						onRightThumbKeyChange={(index, value) =>
							filterStore.setIncludeRightThumbKey(index, value)}
					/>
				{:else if kind === 'or'}
					<KeyPositionFilter
						grid={filterStore.includeOrGrid}
						leftThumbKeys={filterStore.includeOrLeftThumbKeys}
						rightThumbKeys={filterStore.includeOrRightThumbKeys}
						{hideThumbKeys}
						accentColor="#60a5fa"
						nested
						compact
						onCellChange={(row, col, value) => filterStore.setIncludeOrCell(row, col, value)}
						onLeftThumbKeyChange={(index, value) =>
							filterStore.setIncludeOrLeftThumbKey(index, value)}
						onRightThumbKeyChange={(index, value) =>
							filterStore.setIncludeOrRightThumbKey(index, value)}
					/>
				{:else}
					<KeyPositionFilter
						grid={filterStore.excludeGrid}
						leftThumbKeys={filterStore.excludeLeftThumbKeys}
						rightThumbKeys={filterStore.excludeRightThumbKeys}
						{hideThumbKeys}
						accentColor="#f87171"
						nested
						compact
						onCellChange={(row, col, value) => filterStore.setExcludeCell(row, col, value)}
						onLeftThumbKeyChange={(index, value) =>
							filterStore.setExcludeLeftThumbKey(index, value)}
						onRightThumbKeyChange={(index, value) =>
							filterStore.setExcludeRightThumbKey(index, value)}
					/>
				{/if}
			</div>
		</div>
	{/each}

	{#each statsByAnalyzer as group (group.analyzer)}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label"
					>{analyzerShortLabel(group.analyzer)} stats</span
				>
			</div>
			<div class="adjust-section-body adjust-section-body--stats">
				{#if group.general.length > 0}
					<StatLimitFiltersBody
						section="general"
						analyzer={group.analyzer}
						stacked
						onlyKeys={group.general}
					/>
				{/if}
				{#if group.hands.length > 0}
					<StatLimitFiltersBody
						section="hands"
						analyzer={group.analyzer}
						stacked
						onlyKeys={group.hands}
					/>
				{/if}
			</div>
		</div>
	{/each}

	{#if snapshot.similarity}
		<SimilarityFilters {layouts} />
	{/if}
</div>

<style>
	.active-filters-adjust {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.adjust-section {
		width: 100%;
		/* Extra inset so focus rings aren't clipped by overflow ancestors. */
		padding: 0.875rem;
		border-radius: 0.75rem;
		overflow: visible;
	}

	.adjust-section-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		/* Room for 2px focus rings on first/last controls. */
		padding-block: 0.125rem;
		margin-block: -0.125rem;
		overflow: visible;
	}

	.adjust-section-body--stats {
		gap: 1rem;
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

	.filters-input,
	.filters-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
	}

	.filters-input:focus-visible,
	.filters-select:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}
</style>
