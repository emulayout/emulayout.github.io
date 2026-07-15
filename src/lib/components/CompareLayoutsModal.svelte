<script lang="ts">
	import CompareLayoutSide from '$lib/components/CompareLayoutSide.svelte';
	import CompareStatsDiff from '$lib/components/CompareStatsDiff.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
		layouts: LayoutData[];
		getAuthorName: (userId: number) => string;
		likesData: LayoutLikesMap;
		statsMaps: StatsMaps;
	}

	let { open, onClose, layouts, getAuthorName, likesData, statsMaps }: Props = $props();

	/** Modal-local analyzer; does not write back to page filters. */
	let compareAnalyzer = $state<StatsAnalyzer>(DEFAULT_STATS_ANALYZER);
	let wasOpen = false;

	/** First selected = new (left); second = old (right). */
	const compareLayouts = $derived.by((): LayoutData[] => {
		const byName = new Map(layouts.map((layout) => [layout.name, layout]));
		const selected: LayoutData[] = [];
		for (const name of filterStore.compareSelectedNames) {
			const layout = byName.get(name);
			if (layout) selected.push(layout);
			if (selected.length >= 2) break;
		}
		return selected;
	});

	const newLayout = $derived(compareLayouts[0] ?? null);
	const oldLayout = $derived(compareLayouts[1] ?? null);

	const activeStatsMap = $derived(
		compareAnalyzer === CYANOPHAGE_ANALYZER ? statsMaps.cyanophage : statsMaps.monkeyracer
	);

	const analyzerIsDefault = $derived(compareAnalyzer === DEFAULT_STATS_ANALYZER);
	const statsLoading = $derived(layoutStatsStore.isLoading(compareAnalyzer));

	// Seed from the page analyzer each time the modal opens; keep subsequent changes local.
	$effect(() => {
		if (open && !wasOpen) {
			compareAnalyzer = filterStore.statsAnalyzer;
		}
		wasOpen = open;
	});

	// Fetch into the shared stats cache when this modal needs an analyzer that isn't loaded yet.
	$effect(() => {
		if (!open) return;
		void layoutStatsStore.ensureLoaded(compareAnalyzer);
	});
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="compare-layouts-title"
	panelClass="max-h-[min(92vh,960px)] max-w-6xl"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<h2
			id="compare-layouts-title"
			class="text-lg font-semibold shrink-0"
			style="color: var(--text-primary);"
		>
			Compare
		</h2>
		<div class="flex items-center gap-2 min-w-0">
			<label class="flex items-center gap-2 min-w-0 select-none">
				<span class="text-sm shrink-0 hidden sm:inline" style="color: var(--text-secondary);"
					>Analyzer</span
				>
				<select
					value={compareAnalyzer}
					onchange={(e) => (compareAnalyzer = e.currentTarget.value as StatsAnalyzer)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all max-w-[11rem] sm:max-w-[14rem]"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid {!analyzerIsDefault ? 'var(--accent)' : 'var(--border)'};
						--tw-ring-color: var(--accent);
					"
					aria-label="Analyzer"
				>
					{#each STAT_ANALYZERS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<button
				onclick={onClose}
				class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
				style="color: var(--text-secondary);"
				aria-label="Close"
			>
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<div class="overflow-y-auto px-5 py-4">
		{#if !newLayout}
			<p class="text-sm" style="color: var(--text-secondary);">No layouts selected.</p>
		{:else if !oldLayout}
			<div class="compare-single">
				<CompareLayoutSide
					layout={newLayout}
					authorName={getAuthorName(newLayout.user)}
					likeCount={likesData[newLayout.name] ?? 0}
					compactStats={activeStatsMap?.[newLayout.name]}
					analyzer={compareAnalyzer}
				/>
				<p class="text-sm mt-3" style="color: var(--text-secondary);">
					Select a second layout to compare.
				</p>
			</div>
		{:else}
			<div class="compare-grid">
				<div class="compare-col">
					<CompareLayoutSide
						layout={newLayout}
						authorName={getAuthorName(newLayout.user)}
						likeCount={likesData[newLayout.name] ?? 0}
						compactStats={activeStatsMap?.[newLayout.name]}
						analyzer={compareAnalyzer}
					/>
				</div>

				<div class="compare-vdiv" aria-hidden="true"></div>

				<div class="compare-col compare-col-diff">
					<button
						type="button"
						class="compare-swap-button"
						style="
							color: var(--text-secondary);
							background-color: var(--bg-secondary);
							border: 1px solid var(--border);
						"
						aria-label="Swap layouts"
						title="Swap layouts"
						onclick={() => filterStore.swapCompareLayouts()}
					>
						<svg
							class="size-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M8 3L4 7l4 4" />
							<path d="M4 7h16" />
							<path d="M16 21l4-4-4-4" />
							<path d="M20 17H4" />
						</svg>
						Swap
					</button>
					<div class="compare-stats-heading compare-stats-heading--diff">
						<span
							class="compare-diff-caption"
							style="color: var(--text-secondary);"
							title="{newLayout.name} − {oldLayout.name}"
						>
							{newLayout.name} − {oldLayout.name}
						</span>
						<Tooltip
							text={`Green = better on ${newLayout.name}.\nRed = better on ${oldLayout.name}.`}
						/>
					</div>
					<CompareStatsDiff
						newCompact={activeStatsMap?.[newLayout.name]}
						oldCompact={activeStatsMap?.[oldLayout.name]}
						analyzer={compareAnalyzer}
						{statsLoading}
					/>
				</div>

				<div class="compare-vdiv" aria-hidden="true"></div>

				<div class="compare-col">
					<CompareLayoutSide
						layout={oldLayout}
						authorName={getAuthorName(oldLayout.user)}
						likeCount={likesData[oldLayout.name] ?? 0}
						compactStats={activeStatsMap?.[oldLayout.name]}
						analyzer={compareAnalyzer}
					/>
				</div>
			</div>
		{/if}
	</div>
</ModalShell>

<style>
	.compare-single {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 28rem;
	}

	.compare-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr) 1px minmax(0, 1fr);
		column-gap: 1.25rem;
		align-items: end;
	}

	.compare-col {
		min-width: 0;
	}

	.compare-col-diff {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.compare-swap-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		align-self: center;
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.compare-swap-button:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.compare-vdiv {
		width: 1px;
		background-color: var(--border);
		align-self: stretch;
	}

	.compare-stats-heading {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		min-height: 1.5rem;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 0.375rem;
		padding-bottom: 0.125rem;
	}

	.compare-stats-heading--diff {
		text-transform: none;
		letter-spacing: normal;
		font-weight: 500;
		min-width: 0;
	}

	.compare-diff-caption {
		font-size: 0.75rem;
		font-weight: 400;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
</style>
