<script lang="ts">
	import { tick, untrack } from 'svelte';
	import CompareLayoutSide from '$lib/components/CompareLayoutSide.svelte';
	import CompareStatsDiff from '$lib/components/CompareStatsDiff.svelte';
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		clearCompareView,
		loadCompareView,
		saveCompareView
	} from '$lib/compareViewStorage';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		isStatsAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
		/** How to seed the view pair when the modal opens / session bumps. */
		seedMode?: 'restore' | 'selection' | 'reset';
		/** Bumped on each open request so reopening reseeds. */
		session?: number;
		layouts: LayoutData[];
		getAuthorName: (userId: number) => string;
		likesData: LayoutLikesMap;
		statsMaps: StatsMaps;
	}

	let {
		open,
		onClose,
		seedMode = 'restore',
		session = 0,
		layouts,
		getAuthorName,
		likesData,
		statsMaps
	}: Props = $props();

	/** Modal-local analyzer; does not write back to page filters. */
	let compareAnalyzer = $state<StatsAnalyzer>(DEFAULT_STATS_ANALYZER);
	/** Modal-local view pair; autocomplete commits these without touching compare selection. */
	let leftName = $state<string | null>(null);
	let rightName = $state<string | null>(null);
	/** Ephemeral highlight while browsing autocomplete; Escape/blur reverts to committed. */
	let leftPreview = $state<string | null>(null);
	let rightPreview = $state<string | null>(null);
	let leftSearch = $state<{ focus: () => void } | undefined>(undefined);
	let rightSearch = $state<{ focus: () => void } | undefined>(undefined);
	let leftClearButton = $state<HTMLButtonElement | undefined>(undefined);
	let rightClearButton = $state<HTMLButtonElement | undefined>(undefined);

	const layoutByName = $derived(
		new Map(layouts.map((layout) => [layout.name, layout] as const))
	);

	/** First two checked layouts — only used to seed the local view pair. */
	const selectedPairNames = $derived.by((): [string | null, string | null] => {
		const names: string[] = [];
		for (const name of filterStore.compareSelectedNames) {
			if (layoutByName.has(name)) names.push(name);
			if (names.length >= 2) break;
		}
		return [names[0] ?? null, names[1] ?? null];
	});

	/** All checked layouts available as empty-slot quick picks. */
	const selectedQuickNames = $derived.by((): string[] => {
		const names: string[] = [];
		for (const name of filterStore.compareSelectedNames) {
			if (layoutByName.has(name)) names.push(name);
		}
		return names;
	});

	const leftLayouts = $derived(
		rightName ? layouts.filter((layout) => layout.name !== rightName) : layouts
	);
	const rightLayouts = $derived(
		leftName ? layouts.filter((layout) => layout.name !== leftName) : layouts
	);

	const leftQuickNames = $derived(
		rightName ? selectedQuickNames.filter((name) => name !== rightName) : selectedQuickNames
	);
	const rightQuickNames = $derived(
		leftName ? selectedQuickNames.filter((name) => name !== leftName) : selectedQuickNames
	);

	const viewLeftName = $derived(leftPreview ?? leftName);
	const viewRightName = $derived(rightPreview ?? rightName);

	const newLayout = $derived(viewLeftName ? (layoutByName.get(viewLeftName) ?? null) : null);
	const oldLayout = $derived(viewRightName ? (layoutByName.get(viewRightName) ?? null) : null);

	const activeStatsMap = $derived(
		compareAnalyzer === CYANOPHAGE_ANALYZER
			? statsMaps.cyanophage
			: compareAnalyzer === MANA2_ANALYZER
				? statsMaps.mana2
				: statsMaps.monkeyracer
	);

	const statsLoading = $derived(layoutStatsStore.isLoading(compareAnalyzer));

	// Seed analyzer + view pair each time the modal is opened / reopened.
	$effect(() => {
		if (!open) return;
		session;
		const mode = seedMode;
		compareAnalyzer = isStatsAnalyzer(filterStore.statsAnalyzer)
			? filterStore.statsAnalyzer
			: DEFAULT_STATS_ANALYZER;
		leftPreview = null;
		rightPreview = null;

		if (mode === 'reset') {
			leftName = null;
			rightName = null;
			clearCompareView();
		} else if (mode === 'selection') {
			const pair = untrack(() => selectedPairNames);
			leftName = pair[0];
			rightName = pair[1];
			saveCompareView(leftName, rightName);
		} else {
			const stored = loadCompareView();
			const byName = untrack(() => layoutByName);
			leftName = stored.left && byName.has(stored.left) ? stored.left : null;
			rightName = stored.right && byName.has(stored.right) ? stored.right : null;
			if (leftName && leftName === rightName) rightName = null;
			saveCompareView(leftName, rightName);
		}

		void tick().then(() => {
			if (leftName) leftClearButton?.focus();
			else leftSearch?.focus();
		});
	});

	// Fetch into the shared stats cache when this modal needs an analyzer that isn't loaded yet.
	$effect(() => {
		if (!open) return;
		void layoutStatsStore.ensureLoaded(compareAnalyzer);
	});

	function swapViewLayouts() {
		leftPreview = null;
		rightPreview = null;
		const previousLeft = leftName;
		leftName = rightName;
		rightName = previousLeft;
		saveCompareView(leftName, rightName);
	}

	function resetAllView() {
		leftName = null;
		rightName = null;
		leftPreview = null;
		rightPreview = null;
		clearCompareView();
		void tick().then(() => leftSearch?.focus());
	}

	function commitLeft(name: string, meta?: { via: 'enter' | 'click' }) {
		leftName = name;
		leftPreview = null;
		saveCompareView(leftName, rightName);
		if (meta?.via === 'enter') {
			void tick().then(() => leftClearButton?.focus());
		}
	}

	function commitRight(name: string, meta?: { via: 'enter' | 'click' }) {
		rightName = name;
		rightPreview = null;
		saveCompareView(leftName, rightName);
		if (meta?.via === 'enter') {
			void tick().then(() => rightClearButton?.focus());
		}
	}

	function clearLeft() {
		leftName = null;
		leftPreview = null;
		saveCompareView(leftName, rightName);
		void tick().then(() => leftSearch?.focus());
	}

	function clearRight() {
		rightName = null;
		rightPreview = null;
		saveCompareView(leftName, rightName);
		void tick().then(() => rightSearch?.focus());
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="compare-layouts-title"
	panelClass="max-h-[min(92vh,960px)] max-w-[900px]"
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
						border: 1px solid var(--border);
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
		<div class="compare-grid">
			<div class="compare-col">
				{#if !leftName}
					<LayoutAutocomplete
						bind:this={leftSearch}
						layouts={leftLayouts}
						id="compare-layout-search-left"
						label="Find left layout"
						onHighlight={(name) => (leftPreview = name)}
						onSelect={commitLeft}
					/>
				{/if}
				{#if newLayout}
					<CompareLayoutSide
						layout={newLayout}
						authorName={getAuthorName(newLayout.user)}
						likeCount={likesData[newLayout.name] ?? 0}
						compactStats={activeStatsMap?.[newLayout.name]}
						analyzer={compareAnalyzer}
						onClear={leftName ? clearLeft : undefined}
						bind:clearButton={leftClearButton}
					/>
				{:else}
					<div
						class="compare-empty"
						class:compare-empty--options={leftQuickNames.length > 0}
						style="color: var(--text-secondary); border-color: var(--border); background-color: var(--bg-secondary);"
					>
						{#if leftQuickNames.length > 0}
							<p class="compare-empty-label">Selected layouts</p>
							<ul class="compare-quick-list">
								{#each leftQuickNames as name (name)}
									<li>
										<button
											type="button"
											class="compare-quick-option"
											style="color: var(--text-primary);"
											onclick={() => commitLeft(name)}
										>
											{name}
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							Search to choose a layout.
						{/if}
					</div>
				{/if}
			</div>

			<div class="compare-vdiv" aria-hidden="true"></div>

			<div class="compare-col-diff">
				<div class="compare-mid-actions">
					<button
						type="button"
						class="compare-mid-button"
						style="
							color: var(--text-secondary);
							background-color: var(--bg-secondary);
							border: 1px solid var(--border);
						"
						aria-label="Swap layouts"
						title="Swap layouts"
						onclick={() => swapViewLayouts()}
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
					<button
						type="button"
						class="compare-mid-button"
						style="
							color: var(--text-secondary);
							background-color: var(--bg-secondary);
							border: 1px solid var(--border);
						"
						aria-label="Reset all"
						title="Reset all (⌘⇧K / Ctrl+Shift+K)"
						onclick={() => resetAllView()}
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
							<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
							<path d="M3 3v5h5" />
						</svg>
						Reset
					</button>
				</div>
				{#if newLayout && oldLayout}
					<div class="compare-diff-stats">
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
				{:else}
					<div
						class="compare-empty compare-empty--diff"
						style="color: var(--text-secondary); border-color: var(--border); background-color: var(--bg-secondary);"
					>
						Pick two layouts to see the diff.
					</div>
				{/if}
			</div>

			<div class="compare-vdiv" aria-hidden="true"></div>

			<div class="compare-col">
				{#if !rightName}
					<LayoutAutocomplete
						bind:this={rightSearch}
						layouts={rightLayouts}
						id="compare-layout-search-right"
						label="Find right layout"
						onHighlight={(name) => (rightPreview = name)}
						onSelect={commitRight}
					/>
				{/if}
				{#if oldLayout}
					<CompareLayoutSide
						layout={oldLayout}
						authorName={getAuthorName(oldLayout.user)}
						likeCount={likesData[oldLayout.name] ?? 0}
						compactStats={activeStatsMap?.[oldLayout.name]}
						analyzer={compareAnalyzer}
						onClear={rightName ? clearRight : undefined}
						bind:clearButton={rightClearButton}
					/>
				{:else}
					<div
						class="compare-empty"
						class:compare-empty--options={rightQuickNames.length > 0}
						style="color: var(--text-secondary); border-color: var(--border); background-color: var(--bg-secondary);"
					>
						{#if rightQuickNames.length > 0}
							<p class="compare-empty-label">Selected layouts</p>
							<ul class="compare-quick-list">
								{#each rightQuickNames as name (name)}
									<li>
										<button
											type="button"
											class="compare-quick-option"
											style="color: var(--text-primary);"
											onclick={() => commitRight(name)}
										>
											{name}
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							Search to choose a layout.
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</ModalShell>

<style>
	.compare-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr) 1px minmax(0, 1fr);
		column-gap: 1.25rem;
		align-items: stretch;
	}

	.compare-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		align-self: stretch;
	}

	.compare-col-diff {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 0.75rem;
		min-width: 0;
		min-height: 100%;
		align-self: stretch;
	}

	.compare-diff-stats {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		margin-top: auto;
	}

	.compare-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 296px;
		max-height: 296px;
		padding: 1rem;
		border: 1px dashed;
		border-radius: 0.75rem;
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.compare-empty--options {
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		gap: 0.5rem;
		text-align: left;
	}

	.compare-empty--diff {
		align-self: stretch;
		width: 100%;
	}

	.compare-empty-label {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.compare-quick-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 0;
		overflow-y: auto;
	}

	.compare-quick-option {
		display: block;
		width: 100%;
		padding: 0.375rem 0.5rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.compare-quick-option:hover {
		background-color: var(--bg-primary);
	}

	.compare-mid-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		align-self: center;
	}

	.compare-mid-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.compare-mid-button:hover {
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
