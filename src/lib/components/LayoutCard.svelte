<script lang="ts">
	import type { LayoutData, LayoutStatsMap } from '$lib/layout';
	import {
		applyAnglemodToDisplayValue,
		buildKeyMap,
		buildShiftKeyMap,
		removeAnglemodFromDisplayValue
	} from '$lib/cmini/keyboard';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { getLayoutCardHeight } from '$lib/constants';
	import {
		buildBotStatsBlockLines,
		deriveBotStats,
		formatStatsLoadingBlock,
		formatStatsUnavailableBlock,
		getLayoutCorpusStats,
		getStatSortHighlightKey
	} from '$lib/layoutStats';
	import { buildCyanophagePlaygroundUrl, formatCyanophageIncompatibilities, getCyanophageIncompatibilities, isCyanophageCompatible } from '$lib/cyanophage';

	interface Props {
		layout: LayoutData;
		authorName: string;
		layoutStats: LayoutStatsMap;
		similarMatchPercent?: number;
	}

	const { layout, authorName, layoutStats, similarMatchPercent }: Props = $props();

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

	const cyanophageCompatible = $derived(isCyanophageCompatible(layout.keys));
	const cyanophageIncompatibilities = $derived(getCyanophageIncompatibilities(layout.keys));
	const cyanophageLinkTitle = $derived(
		cyanophageCompatible
			? 'View on Cyanophage'
			: `Not supported on Cyanophage (${formatCyanophageIncompatibilities(cyanophageIncompatibilities)})`
	);

	const corpusStats = $derived(
		getLayoutCorpusStats(layoutStats, layout.name, filterStore.statsCorpus)
	);
	const botStats = $derived(corpusStats ? deriveBotStats(corpusStats) : null);
	const statsLoading = $derived(layoutStatsStore.loading);
	const highlightStatKey = $derived(getStatSortHighlightKey(filterStore.sortBy));
	const statsBlockLines = $derived(
		botStats ? buildBotStatsBlockLines(botStats, highlightStatKey) : null
	);
	const statsBlock = $derived(
		statsLoading
			? formatStatsLoadingBlock()
			: !botStats
				? formatStatsUnavailableBlock()
				: null
	);

	const cardHeight = $derived(
		getLayoutCardHeight(filterStore.showLayoutStats, filterStore.showLayoutTestArea)
	);

	function handlePlaygroundClick(event: MouseEvent) {
		event.preventDefault();
		const url = buildCyanophagePlaygroundUrl(layout.keys, layout.board, layout.displayValue);
		if (!url) return;
		window.open(url, '_blank');
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
		<div class="flex items-center gap-2">
			<h2
				class="text-lg font-semibold flex-1 truncate"
				style="color: var(--text-primary);"
				title={layout.name}
			>
				{layout.name}
			</h2>
			<div class="flex items-center gap-1 shrink-0">
				{#if filterStore.hasSimilarReference && !isSimilarActive && similarMatchPercent !== undefined}
					<span
						class="px-2 py-1 rounded-lg text-sm font-medium tabular-nums"
						style="color: var(--accent); background-color: var(--bg-primary); border: 1px solid var(--border);"
						title="Position match"
					>
						{similarMatchPercent}%
					</span>
				{:else if !filterStore.hasSimilarReference || isSimilarActive}
					<button
						type="button"
						onclick={handleFindSimilarClick}
						class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
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
					class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
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
					onclick={handlePlaygroundClick}
					disabled={!cyanophageCompatible}
					class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
					style="
						background-color: var(--bg-primary);
						color: var(--text-primary);
						border: 1px solid var(--border);
					"
					title={cyanophageLinkTitle}
					aria-label={cyanophageLinkTitle}
					aria-disabled={!cyanophageCompatible}
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

	{#if filterStore.showLayoutStats || filterStore.showLayoutTestArea}
		<div
			class="card-footer shrink-0 pt-4 flex flex-col gap-4"
			style="border-top: 1px solid var(--border);"
		>
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
