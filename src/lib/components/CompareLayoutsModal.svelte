<script lang="ts">
	import { tick, untrack } from 'svelte';
	import CompareLayoutPicker from '$lib/components/CompareLayoutPicker.svelte';
	import CompareStatsDiff from '$lib/components/CompareStatsDiff.svelte';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		isStatsAnalyzer,
		MANA2_ANALYZER,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/statsAnalyzers';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
		/** How to seed the view pair when the modal opens / session bumps. */
		seedMode?: 'restore' | 'selection' | 'reset';
		/** Layout committed to the right compare-to slot on open, e.g. a detail page's layout. */
		seedName?: string | null;
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
		seedName = null,
		session = 0,
		layouts,
		getAuthorName,
		likesData,
		statsMaps
	}: Props = $props();

	/** Modal-local analyzer; does not write back to page filters. */
	let compareAnalyzer = $state<StatsAnalyzer>(DEFAULT_STATS_ANALYZER);
	/** Modal-local view pair; autocomplete commits these without touching layout selection. */
	let leftName = $state<string | null>(null);
	let rightName = $state<string | null>(null);
	/** Ephemeral highlight while browsing autocomplete; Escape/blur reverts to committed. */
	let leftPreview = $state<string | null>(null);
	let rightPreview = $state<string | null>(null);
	let leftPicker = $state<{ focus: () => void } | undefined>(undefined);

	const layoutByName = $derived(new Map(layouts.map((layout) => [layout.name, layout] as const)));

	/** First two checked layouts — only used to seed the local view pair. */
	const selectedPairNames = $derived.by((): [string | null, string | null] => {
		const names: string[] = [];
		for (const name of filterStore.selectedLayoutNames) {
			if (layoutByName.has(name)) names.push(name);
			if (names.length >= 2) break;
		}
		return [names[0] ?? null, names[1] ?? null];
	});

	/** All checked layouts available as empty-slot quick picks. */
	const selectedQuickNames = $derived.by((): string[] => {
		const names: string[] = [];
		for (const name of filterStore.selectedLayoutNames) {
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
				: statsMaps.cmini
	);

	const statsLoading = $derived(layoutStatsStore.isLoading(compareAnalyzer));
	const statsError = $derived(layoutStatsStore.getLoadError(compareAnalyzer));

	// Seed analyzer + view pair only when the modal is opened / reopened.
	// Keep other reads untracked so cycling layouts can't reset compareAnalyzer.
	$effect(() => {
		if (!open) return;
		void session;
		const mode = seedMode;

		untrack(() => {
			compareAnalyzer = isStatsAnalyzer(filterStore.statsAnalyzer)
				? filterStore.statsAnalyzer
				: DEFAULT_STATS_ANALYZER;
			void layoutStatsStore.ensureLoaded(compareAnalyzer);
			leftPreview = null;
			rightPreview = null;

			if (mode === 'reset') {
				leftName = null;
				rightName = null;
			} else if (mode === 'selection') {
				const pair = selectedPairNames;
				leftName = pair[0];
				rightName = pair[1];
			} else {
				// Keep in-memory pair; drop names that left the catalog.
				if (leftName && !layoutByName.has(leftName)) leftName = null;
				if (rightName && !layoutByName.has(rightName)) rightName = null;
				if (leftName && leftName === rightName) rightName = null;
			}

			// Opened from a layout detail page: that layout becomes the compare-to
			// side, keeping the left picker free for the comparison layout.
			if (mode !== 'reset' && seedName && layoutByName.has(seedName)) {
				if (leftName === seedName) leftName = rightName;
				rightName = seedName;
			}

			void tick().then(() => {
				leftPicker?.focus();
			});
		});
	});

	function retryStats() {
		void layoutStatsStore.retry(compareAnalyzer);
	}

	function setCompareAnalyzer(analyzer: StatsAnalyzer) {
		compareAnalyzer = analyzer;
		void layoutStatsStore.ensureLoaded(analyzer);
	}

	function swapViewLayouts() {
		leftPreview = null;
		rightPreview = null;
		const previousLeft = leftName;
		leftName = rightName;
		rightName = previousLeft;
	}

	function resetAllView() {
		leftName = null;
		rightName = null;
		leftPreview = null;
		rightPreview = null;
		void tick().then(() => leftPicker?.focus());
	}

	function commitLeft(name: string) {
		leftName = name;
		leftPreview = null;
	}

	function commitRight(name: string) {
		rightName = name;
		rightPreview = null;
	}

	function clearLeft() {
		leftName = null;
		leftPreview = null;
	}

	function clearRight() {
		rightName = null;
		rightPreview = null;
	}

	const canCycleSelected = $derived(selectedQuickNames.length >= 2);

	function cycleViewSide(side: 'left' | 'right', delta: -1 | 1) {
		const names = selectedQuickNames;
		if (names.length < 2) return;

		const current = side === 'left' ? leftName : rightName;
		const other = side === 'left' ? rightName : leftName;
		if (!current) return;

		let idx = names.indexOf(current);
		if (idx === -1) idx = delta === 1 ? -1 : 0;

		for (let step = 0; step < names.length; step++) {
			idx = (idx + delta + names.length) % names.length;
			const candidate = names[idx];
			if (candidate === current) continue;
			if (candidate === other) {
				if (names.length === 2) {
					leftPreview = null;
					rightPreview = null;
					if (side === 'left') {
						leftName = candidate;
						rightName = current;
					} else {
						rightName = candidate;
						leftName = current;
					}
					return;
				}
				continue;
			}
			if (side === 'left') commitLeft(candidate);
			else commitRight(candidate);
			return;
		}
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="compare-layouts-title"
	panelClass="max-h-[min(92vh,960px)] max-w-[1000px]"
>
	<ModalHeader titleId="compare-layouts-title" title="Compare" titleClass="shrink-0" {onClose}>
		{#snippet actions()}
			<label class="flex items-center gap-2 min-w-0 select-none">
				<span class="text-sm shrink-0 hidden sm:inline" style="color: var(--text-secondary);"
					>Analyzer</span
				>
				<select
					value={compareAnalyzer}
					onchange={(event) => setCompareAnalyzer(event.currentTarget.value as StatsAnalyzer)}
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
		{/snippet}
	</ModalHeader>
	{#if statsError}
		<div
			class="flex items-center justify-between gap-3 border-b px-5 py-2 text-sm"
			style="color: var(--text-secondary); border-color: var(--border);"
			role="alert"
		>
			<span>{statsError.message}</span>
			<button
				type="button"
				class="rounded-md border px-2 py-1 font-medium"
				style="color: var(--text-primary); border-color: var(--border);"
				onclick={retryStats}
			>
				Retry stats
			</button>
		</div>
	{/if}

	<div class="overflow-y-auto px-5 py-4">
		<div class="compare-grid">
			<CompareLayoutPicker
				bind:this={leftPicker}
				side="left"
				committedName={leftName}
				layout={newLayout}
				availableLayouts={leftLayouts}
				quickNames={leftQuickNames}
				authorName={newLayout ? getAuthorName(newLayout.user) : undefined}
				likeCount={newLayout ? (likesData[newLayout.name] ?? 0) : undefined}
				compactStats={newLayout ? activeStatsMap?.[newLayout.name] : undefined}
				analyzer={compareAnalyzer}
				{canCycleSelected}
				onHighlight={(name) => (leftPreview = name)}
				onCommit={commitLeft}
				onClear={clearLeft}
				onCyclePrev={() => cycleViewSide('left', -1)}
				onCycleNext={() => cycleViewSide('left', 1)}
			/>

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
					<div
						class="compare-diff-stats"
						class:compare-diff-stats--cycle-pad={Boolean(leftName) &&
							Boolean(rightName) &&
							canCycleSelected}
					>
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
						class="compare-diff-empty"
						style="color: var(--text-secondary); border-color: var(--border); background-color: var(--bg-secondary);"
					>
						Pick two layouts to see the diff.
					</div>
				{/if}
			</div>

			<div class="compare-vdiv" aria-hidden="true"></div>

			<CompareLayoutPicker
				side="right"
				committedName={rightName}
				layout={oldLayout}
				availableLayouts={rightLayouts}
				quickNames={rightQuickNames}
				authorName={oldLayout ? getAuthorName(oldLayout.user) : undefined}
				likeCount={oldLayout ? (likesData[oldLayout.name] ?? 0) : undefined}
				compactStats={oldLayout ? activeStatsMap?.[oldLayout.name] : undefined}
				analyzer={compareAnalyzer}
				{canCycleSelected}
				onHighlight={(name) => (rightPreview = name)}
				onCommit={commitRight}
				onClear={clearRight}
				onCyclePrev={() => cycleViewSide('right', -1)}
				onCycleNext={() => cycleViewSide('right', 1)}
			/>
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

	/* Reserve the same space as side-column cycle controls so stats rows line up. */
	.compare-diff-stats--cycle-pad {
		padding-bottom: calc(0.75rem + 0.25rem + 2rem);
	}

	.compare-diff-empty {
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
		align-self: stretch;
		width: 100%;
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
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
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
