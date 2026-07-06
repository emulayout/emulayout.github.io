<script lang="ts">
	import type { CyanophageStats, MonkeyracerStats, LayoutData, StatsMaps } from '$lib/layout';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { getLayoutCardHeight } from '$lib/constants';
	import {
		buildBotStatsBlockLines,
		buildCyanophageStatsBlockLines,
		CYANOPHAGE_ANALYZER,
		deriveBotStats,
		deriveCyanophageStats,
		formatCyanophageStatsLoadingBlock,
		formatCyanophageStatsUnavailableBlock,
		formatStatsLoadingBlock,
		formatStatsUnavailableBlock,
		getLayoutAnalyzerStats,
		getStatSortHighlightKey,
		type CyanophageStatSortKey,
		type StatSortKey
	} from '$lib/layoutStats';
	import { buildCyanophagePlaygroundUrl, CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
	import { createColemakCampURLFromKeyMap } from '$lib/colemakCamp';
	import {
		applyAnglemodToDisplayValue,
		buildKeyMap,
		buildShiftKeyMap,
		removeAnglemodFromDisplayValue
	} from '$lib/cmini/keyboard';

	interface Props {
		layout: LayoutData;
		authorName: string;
		statsMaps: StatsMaps;
		similarMatchPercent?: number;
	}

	const { layout, authorName, statsMaps, similarMatchPercent }: Props = $props();

	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let cardElement: HTMLDivElement | null = $state(null);
	let anglemod = $state(false);

	const isSimilarActive = $derived(filterStore.similarReferenceName === layout.name);

	const isAngleBoard = $derived(layout.board === 'angle');

	// Angle boards are stored in anglemod order; toggling unswaps. Others swap on toggle.
	const transformedDisplayValue = $derived.by(() => {
		if (!anglemod) return layout.displayValue;
		return isAngleBoard
			? removeAnglemodFromDisplayValue(layout.displayValue)
			: applyAnglemodToDisplayValue(layout.displayValue);
	});

	// Parse displayValue and create key mapping
	const keyMap = $derived.by(() => {
		return buildKeyMap(transformedDisplayValue);
	});

	// Create shift key map: maps key codes to layout characters when shift is pressed
	// For punctuation keys: get the base character from layout, find its shifted version, then find where that appears in layout
	// For letter keys: uppercase the character from the layout at that position
	const shiftKeyMap = $derived.by(() => {
		return buildShiftKeyMap(keyMap);
	});

	const updatedLabel = $derived(
		new Date(layout.updatedAt).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);

	const isCyanophageAnalyzer = $derived(filterStore.statsAnalyzer === CYANOPHAGE_ANALYZER);
	const cyanophageLinkTitle = $derived(
		layout.cyanophageCompatible ? 'View on Cyanophage' : CYANOPHAGE_UNSUPPORTED_LABEL
	);

	const analyzerStats = $derived(
		getLayoutAnalyzerStats(
			statsMaps,
			layout.name,
			filterStore.statsAnalyzer,
			layout.cyanophageCompatible
		)
	);
	const botStats = $derived(
		analyzerStats && !isCyanophageAnalyzer
			? deriveBotStats(analyzerStats as MonkeyracerStats)
			: null
	);
	const cyanophageStats = $derived(
		analyzerStats && isCyanophageAnalyzer
			? deriveCyanophageStats(analyzerStats as CyanophageStats)
			: null
	);
	const statsLoading = $derived(layoutStatsStore.isLoading(filterStore.statsAnalyzer));
	const highlightStatKey = $derived(getStatSortHighlightKey(filterStore.sortBy));
	const botHighlightKey = $derived(
		!isCyanophageAnalyzer ? (highlightStatKey as StatSortKey | undefined) : undefined
	);
	const cyanophageHighlightKey = $derived(
		isCyanophageAnalyzer ? (highlightStatKey as CyanophageStatSortKey | undefined) : undefined
	);
	const statsBlockLines = $derived(
		isCyanophageAnalyzer
			? cyanophageStats
				? buildCyanophageStatsBlockLines(cyanophageStats, cyanophageHighlightKey)
				: null
			: botStats
				? buildBotStatsBlockLines(botStats, botHighlightKey)
				: null
	);
	const statsBlock = $derived(
		statsLoading
			? isCyanophageAnalyzer
				? formatCyanophageStatsLoadingBlock()
				: formatStatsLoadingBlock()
			: isCyanophageAnalyzer
				? !cyanophageStats
					? formatCyanophageStatsUnavailableBlock(
							!layout.cyanophageCompatible ? CYANOPHAGE_UNSUPPORTED_LABEL : undefined
						)
					: null
				: !botStats
					? formatStatsUnavailableBlock()
					: null
	);

	const cardHeight = $derived(
		getLayoutCardHeight(filterStore.showLayoutStats, filterStore.showLayoutTestArea)
	);

	function handleColemakCampClick(event: MouseEvent) {
		event.preventDefault();
		const url = createColemakCampURLFromKeyMap(keyMap, layout.board);
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function handlePlaygroundClick(event: MouseEvent) {
		event.preventDefault();
		if (!layout.cyanophageCompatible) return;
		const url = buildCyanophagePlaygroundUrl(
			layout.keys,
			layout.board,
			layout.displayValue,
			layout.cyanophageThumb ?? 'l'
		);
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function handleFindSimilarClick() {
		filterStore.toggleSimilarReference(layout.name);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			if (textareaElement) {
				textareaElement.value = '';
			}
			return;
		}

		// Don't remap if meta, ctrl, or alt are pressed
		if (event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}

		// Check if this is a remappable key
		if (event.code in keyMap) {
			event.preventDefault();
			let mappedChar: string | undefined;

			// Use shift map if shift is pressed
			if (event.shiftKey) {
				if (event.code in shiftKeyMap) {
					mappedChar = shiftKeyMap[event.code];
				}
			} else {
				mappedChar = keyMap[event.code];
			}

			if (textareaElement && mappedChar) {
				const start = textareaElement.selectionStart;
				const end = textareaElement.selectionEnd;
				const value = textareaElement.value;
				const newValue = value.slice(0, start) + mappedChar + value.slice(end);

				textareaElement.value = newValue;
			}
		}
	}
</script>

<div
	bind:this={cardElement}
	data-layout-name={layout.name}
	class="px-5 pt-5 pb-3 rounded-xl transition-all duration-300 min-w-0 overflow-hidden flex flex-col gap-3"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border); height: {cardHeight}px;"
>
	<div class="shrink-0 flex flex-col gap-1">
		<div class="flex items-center gap-2 min-w-0">
			<h2
				class="text-lg font-semibold flex-1 truncate min-w-0"
				style="color: var(--text-primary);"
				title={layout.name}
			>
				{layout.name}
			</h2>
			{#if filterStore.hasSimilarReference && !isSimilarActive && similarMatchPercent !== undefined}
				<span
					class="px-2 py-1 rounded-lg text-sm font-medium tabular-nums shrink-0"
					style="color: var(--accent); background-color: var(--bg-primary); border: 1px solid var(--border);"
					title="Position match"
				>
					{similarMatchPercent}%
				</span>
			{/if}
		</div>
		<p class="text-xs layout-meta flex items-center gap-1 min-w-0" style="color: var(--text-secondary);">
			<span class="shrink-0">{layout.board} · by</span>
			<button
				type="button"
				onclick={() => {
					filterStore.clearAuthors();
					filterStore.toggleAuthor(layout.user);
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}}
				class="hover:underline cursor-pointer truncate min-w-0"
				style="color: var(--text-secondary);"
				title={authorName}
			>
				{authorName}
			</button>
			<span class="shrink-0" title={layout.updatedAt}>· {updatedLabel}</span>
		</p>
	</div>

	<div
		class="layout-display-area flex-1 min-w-0 overflow-x-auto flex flex-col justify-center"
	>
		<pre
			class="layout-display font-mono whitespace-pre m-0"
			style="color: var(--text-primary);">{transformedDisplayValue}</pre>
	</div>

	<div class="card-action-divider shrink-0" aria-label="Layout actions">
		<div class="card-action-toolbar">
			{#if !filterStore.hasSimilarReference || isSimilarActive}
				<button
					type="button"
					onclick={handleFindSimilarClick}
					class="card-action-button"
					style="
						background-color: {isSimilarActive ? 'var(--accent)' : 'var(--bg-primary)'};
						color: {isSimilarActive ? 'white' : 'var(--text-primary)'};
						border: 1px solid {isSimilarActive ? 'var(--accent)' : 'var(--border)'};
					"
					title={isSimilarActive ? 'Stop showing similar layouts' : 'Find similar layouts'}
					aria-label={isSimilarActive ? 'Stop showing similar layouts' : 'Find similar layouts'}
					aria-pressed={isSimilarActive}
				>
					<svg
						class="size-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="3" width="7" height="7" rx="1" />
						<rect x="14" y="3" width="7" height="7" rx="1" />
						<rect x="3" y="14" width="7" height="7" rx="1" />
						<rect x="14" y="14" width="7" height="7" rx="1" />
					</svg>
				</button>
			{/if}
			<button
				type="button"
				onclick={() => (anglemod = !anglemod)}
				class="card-action-button"
				style="
					background-color: {anglemod ? 'var(--accent)' : 'var(--bg-primary)'};
					color: {anglemod ? 'white' : 'var(--text-primary)'};
					border: 1px solid {anglemod ? 'var(--accent)' : 'var(--border)'};
				"
				title={isAngleBoard ? 'Remove anglemod' : 'Anglemod'}
				aria-label={isAngleBoard ? 'Remove anglemod' : 'Anglemod'}
				aria-pressed={anglemod}
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
					<path d="M21 3v5h-5" />
					<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
					<path d="M3 21v-5h5" />
				</svg>
			</button>
			<button
				type="button"
				onclick={handleColemakCampClick}
				class="card-action-button"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
				"
				title="Practice on Colemak Camp"
				aria-label="Practice on Colemak Camp"
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<rect x="2" y="4" width="20" height="16" rx="2" />
					<path stroke-linecap="round" d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8" />
				</svg>
			</button>
			<button
				type="button"
				onclick={handlePlaygroundClick}
				disabled={!layout.cyanophageCompatible}
				class="card-action-button disabled:opacity-40 disabled:cursor-not-allowed"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
				"
				title={cyanophageLinkTitle}
				aria-label={cyanophageLinkTitle}
				aria-disabled={!layout.cyanophageCompatible}
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
			</button>
		</div>
	</div>

	{#if filterStore.showLayoutStats || filterStore.showLayoutTestArea}
		<div class="card-footer shrink-0 pt-2 flex flex-col gap-4">
			{#if filterStore.showLayoutStats}
				{#if statsBlockLines}
					<div class="stats-block shrink-0">
						{#each statsBlockLines as line, lineIndex (lineIndex)}
							<div class="stats-block-line">
								{#each line as segment, segmentIndex (segmentIndex)}
									<span class:stats-block-highlight={segment.highlight}>{segment.text}</span>
								{/each}
							</div>
						{/each}
					</div>
				{:else}
					<pre
						class="stats-block shrink-0"
						class:stats-block--unavailable={!statsLoading}
					>{statsBlock}</pre>
				{/if}
			{/if}
			{#if filterStore.showLayoutTestArea}
				<textarea
					bind:this={textareaElement}
					class="w-full px-3 pt-3 pb-0 rounded-lg text-sm resize-none outline-none focus:ring-2 transition-all block"
					style="
						background-color: var(--bg-primary);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
					rows="2"
					placeholder="Layout test area"
					onkeydown={handleKeyDown}></textarea>
			{/if}
		</div>
	{/if}
</div>

<style>
	.card-action-divider {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.25rem 0;
	}

	.card-action-divider::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid var(--border);
		pointer-events: none;
	}

	.card-action-toolbar {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.375rem;
		background-color: var(--bg-secondary);
	}

	.card-action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		transition: all 0.15s ease;
	}
</style>
