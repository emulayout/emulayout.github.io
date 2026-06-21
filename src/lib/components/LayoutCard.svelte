<script lang="ts">
	import type { LayoutData, LayoutStatsMap } from '$lib/layout';
	import { applyAnglemodToDisplayValue, buildKeyMap, buildShiftKeyMap } from '$lib/cmini/keyboard';
	import { createColemakCampURLFromKeyMap } from '$lib/colemakCamp';
	import { filterStore } from '$lib/filterStore.svelte';
	import { LAYOUT_CARD_HEIGHT } from '$lib/constants';
	import {
		DEFAULT_STATS_CORPUS,
		deriveBotStats,
		formatStatPercent,
		getLayoutCorpusStats
	} from '$lib/layoutStats';

	interface Props {
		layout: LayoutData;
		authorName: string;
		layoutStats: LayoutStatsMap;
	}

	const { layout, authorName, layoutStats }: Props = $props();

	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let cardElement: HTMLDivElement | null = $state(null);
	let anglemod = $state(false);

	// Transform displayValue when anglemod is enabled
	const transformedDisplayValue = $derived.by(() => {
		if (!anglemod) return layout.displayValue;
		return applyAnglemodToDisplayValue(layout.displayValue);
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

	const corpusStats = $derived(getLayoutCorpusStats(layoutStats, layout.name));
	const botStats = $derived(corpusStats ? deriveBotStats(corpusStats) : null);

	function getModeFromBoard(board: string): string {
		// Map board types to cyanophage mode parameter
		switch (board) {
			case 'angle':
				return 'iso';
			case 'stagger':
				return 'ansi';
			case 'ortho':
				return 'ergo';
			case 'mini':
				return 'ergo';
			default:
				return 'ergo';
		}
	}

	function formatLayoutForUrl(displayValue: string): string {
		// Split by newlines to get rows
		const rows = displayValue.split('\n');
		// Remove all spaces from each row
		const cleanedRows = rows.map((row) => row.replace(/\s+/g, ''));
		// Join with newline character
		return cleanedRows.join('\n');
	}

	function generatePlaygroundUrl(layout: LayoutData): string {
		const layoutParam = formatLayoutForUrl(layout.displayValue);
		const mode = getModeFromBoard(layout.board);
		// URL encode the layout param (newlines will become %0A)
		const encodedLayout = encodeURIComponent(layoutParam);
		return `https://cyanophage.github.io/playground.html?layout=${encodedLayout}&mode=${mode}`;
	}

	function handlePlaygroundClick(event: MouseEvent) {
		event.preventDefault();
		const url = generatePlaygroundUrl(layout);
		window.open(url, '_blank');
	}

	function handleColemakCampClick(event: MouseEvent) {
		event.preventDefault();
		const url = createColemakCampURLFromKeyMap(keyMap, layout.board);
		window.open(url, '_blank');
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
	class="px-5 pt-5 pb-1 rounded-xl transition-all duration-300 min-w-0 overflow-hidden flex flex-col gap-3"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border); height: {LAYOUT_CARD_HEIGHT}px;"
>
	<div class="flex items-center gap-2">
		<h2
			class="text-lg font-semibold flex-1 truncate"
			style="color: var(--text-primary);"
			title={layout.name}
		>
			{layout.name}
		</h2>
		<div class="flex items-center gap-1 shrink-0">
			<button
				type="button"
				onclick={() => (anglemod = !anglemod)}
				class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
				style="
					background-color: {anglemod ? 'var(--accent)' : 'var(--bg-primary)'};
					color: {anglemod ? 'white' : 'var(--text-primary)'};
					border: 1px solid {anglemod ? 'var(--accent)' : 'var(--border)'};
				"
				title="Anglemod"
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
				class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
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
				class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
				"
				title="View on Cyanophage"
				aria-label="View on Cyanophage"
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
	<p class="text-xs flex items-center gap-1 min-w-0 -mt-1" style="color: var(--text-secondary);">
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
	<div class="flex-1 min-h-0 overflow-x-auto min-w-0 flex flex-col justify-center">
		<pre
			class="font-mono text-xs leading-relaxed tracking-widest whitespace-pre"
			style="color: var(--text-primary);">{transformedDisplayValue}</pre>
	</div>
	{#if botStats}
		<div
			class="text-[10px] font-mono leading-[1.35] tabular-nums shrink-0"
			style="color: var(--text-secondary);"
		>
			<div class="uppercase tracking-wider mb-0.5">{DEFAULT_STATS_CORPUS}</div>
			<div>Alt: {formatStatPercent(botStats.alternate)}</div>
			<div>
				Rol: {formatStatPercent(botStats.roll)} (In/Out: {formatStatPercent(botStats.rollIn)} |
				{formatStatPercent(botStats.rollOut)})
			</div>
			<div>
				One: {formatStatPercent(botStats.one)} (In/Out: {formatStatPercent(botStats.oneIn)} |
				{formatStatPercent(botStats.oneOut)})
			</div>
			<div>
				Rtl: {formatStatPercent(botStats.rtl)} (In/Out: {formatStatPercent(botStats.rtlIn)} |
				{formatStatPercent(botStats.rtlOut)})
			</div>
			<div>
				Red: {formatStatPercent(botStats.red)} (Bad: {formatStatPercent(botStats.badRedirect)})
			</div>
			<div>
				SFS: {formatStatPercent(botStats.sfs)} (Red/Alt: {formatStatPercent(botStats.dsfbRed)} |
				{formatStatPercent(botStats.dsfbAlt)})
			</div>
		</div>
	{/if}
	<div class="shrink-0">
		<textarea
			bind:this={textareaElement}
			class="w-full p-3 rounded-lg text-sm resize-none outline-none focus:ring-2 transition-all"
			style="
				background-color: var(--bg-primary);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
			rows="2"
			placeholder="Layout test area"
			onkeydown={handleKeyDown}></textarea>
	</div>
</div>
