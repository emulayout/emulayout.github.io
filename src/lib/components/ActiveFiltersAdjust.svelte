<script lang="ts">
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import KeyboardFiltersBody from '$lib/components/KeyboardFiltersBody.svelte';
	import LayoutNameFilter from '$lib/components/LayoutNameFilter.svelte';
	import SimilarityFiltersBody from '$lib/components/SimilarityFiltersBody.svelte';
	import StatLimitFiltersBody from '$lib/components/StatLimitFiltersBody.svelte';
	import {
		activeKeyKinds,
		snapshotHasKeyboard,
		type ActiveFiltersSnapshot
	} from '$lib/activeFiltersAdjust';
	import { filterStore } from '$lib/filterStore.svelte';
	import type { KeyFilterKind } from '$lib/filterFocus';
	import type { LayoutData } from '$lib/layout';
	import { analyzerShortLabel, STAT_ANALYZERS, type StatsAnalyzer } from '$lib/statsAnalyzers';
	import type { StatLimitKey } from '$lib/statsFiltering';

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
			handUsage: StatLimitKey[];
			fingerUsage: StatLimitKey[];
			workload: boolean;
		}> = [];

		for (const entry of STAT_ANALYZERS) {
			const general: StatLimitKey[] = [];
			const handUsage: StatLimitKey[] = [];
			const fingerUsage: StatLimitKey[] = [];
			const workload = snapshot.fingerWorkloadAnalyzers.includes(entry.value);
			for (const item of snapshot.stats) {
				if (item.analyzer !== entry.value) continue;
				if (item.section === 'general') general.push(item.key);
				else if (item.section === 'hand-usage') handUsage.push(item.key);
				else fingerUsage.push(item.key);
			}
			if (general.length > 0 || handUsage.length > 0 || fingerUsage.length > 0 || workload) {
				groups.push({ analyzer: entry.value, general, handUsage, fingerUsage, workload });
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
	{#if snapshot.name || snapshot.authors}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label">Search</span>
			</div>
			<div class="adjust-section-body">
				{#if snapshot.name}
					<LayoutNameFilter />
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

	{#if snapshot.similarity}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label">Similarity filter</span>
			</div>
			<div class="adjust-section-body">
				<SimilarityFiltersBody {layouts} />
			</div>
		</div>
	{/if}

	{#each statsByAnalyzer as group (group.analyzer)}
		<div
			class="adjust-section"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="filter-section-header">
				<span class="filter-section-header-label">{analyzerShortLabel(group.analyzer)} stats</span>
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
				{#if group.handUsage.length > 0}
					<StatLimitFiltersBody
						section="hand-usage"
						analyzer={group.analyzer}
						stacked
						onlyKeys={group.handUsage}
					/>
				{/if}
				{#if group.fingerUsage.length > 0}
					<StatLimitFiltersBody
						section="finger-usage"
						analyzer={group.analyzer}
						stacked
						onlyKeys={group.fingerUsage}
					/>
				{/if}
				{#if group.workload}
					<StatLimitFiltersBody section="finger-workload" analyzer={group.analyzer} stacked />
				{/if}
			</div>
		</div>
	{/each}
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
</style>
