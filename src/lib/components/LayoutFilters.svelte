<script lang="ts">
	import KeyPositionFilters from '$lib/components/KeyPositionFilters.svelte';
	import AuthorSelect from '$lib/components/AuthorSelect.svelte';
	import StatLimitFilters from '$lib/components/StatLimitFilters.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		filterStore,
		type ThumbKeyFilter,
		type MagicKeyFilter,
		type CharacterSetFilter,
		type BoardTypeFilter,
		type SortBy,
		type SortOrder
	} from '$lib/filterStore.svelte';
	import {
		DEFAULT_STATS_ANALYZER,
		getStatSortFieldsForAnalyzer,
		STAT_ANALYZERS,
		type StatsAnalyzer
	} from '$lib/layoutStats';

	interface Props {
		authorList: Array<{ id: number; name: string }>;
		filteredCount: number;
		likesSortAvailable: boolean;
	}

	const { authorList, filteredCount, likesSortAvailable }: Props = $props();
	const sortIsDefault = $derived(filterStore.sortBy === 'date' && filterStore.sortOrder === 'desc');
	const analyzerIsDefault = $derived(filterStore.statsAnalyzer === DEFAULT_STATS_ANALYZER);
	const statSortFields = $derived(getStatSortFieldsForAnalyzer(filterStore.statsAnalyzer));
	const displaySettingsActive = $derived(
		filterStore.hideLayoutStats || filterStore.hideLayoutTestArea || filterStore.hideLayoutLikes
	);

	let displaySettingsOpen = $state(false);
	let displaySettingsButton = $state<HTMLButtonElement | undefined>(undefined);
	let displaySettingsContainer = $state<HTMLDivElement | undefined>(undefined);
	let resultsStatus = $state<HTMLElement | undefined>(undefined);

	// One-shot: after picking a similar layout from deep in the list, scroll up to the
	// "Showing N layouts…" bar (document flow — not the sticky sidebar).
	$effect(() => {
		if (!filterStore.scrollToSelectedLayout || !resultsStatus) return;

		const section = resultsStatus;
		let cancelled = false;

		// Wait a frame so similar-mode layout (sidebar + shorter list) can settle.
		const frame = requestAnimationFrame(() => {
			if (cancelled) return;

			const top = section.getBoundingClientRect().top + window.scrollY - 10;
			if (window.scrollY > top) {
				window.scrollTo(0, Math.max(0, top));
			}
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
</script>

<!-- Name Search & Author Filter -->
<div class="grid gap-3 sm:grid-cols-2 mb-3">
	<div>
		<label
			for="name-filter"
			class="block text-sm mb-1 truncate"
			style="color: var(--text-secondary);"
		>
			Layout name
			<span class="text-[10px] italic" style="color: var(--text-caption);">
				(use commas for multiple terms)
			</span>
		</label>
		<input
			id="name-filter"
			type="text"
			value={filterStore.nameFilterInput}
			oninput={(e) => filterStore.setNameFilter(e.currentTarget.value)}
			class="w-full px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 transition-all duration-200"
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid {filterStore.nameFilterInput ? 'var(--accent)' : 'var(--border)'};
				--tw-ring-color: var(--accent);
			"
			placeholder="All layouts"
		/>
	</div>
	<div>
		<div class="block text-sm mb-1" style="color: var(--text-secondary);">Author</div>
		<AuthorSelect
			authors={authorList}
			selectedIds={filterStore.selectedAuthors}
			onToggle={(id) => filterStore.toggleAuthor(id)}
			onClear={() => filterStore.clearAuthors()}
		/>
	</div>
</div>

<!-- Filter panels -->
<div class="filters-grid gap-3 mb-4">
	<div class="grid-area-key-filters">
		<KeyPositionFilters />
	</div>
	<div class="grid-area-stat-limits">
		<StatLimitFilters />
	</div>
	<div
		class="p-3 rounded-xl grid-area-other-options flex flex-col items-center"
		style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
	>
		<div class="flex flex-wrap items-start gap-x-6 gap-y-4">
			<label class="flex flex-col items-start gap-0.5 select-none w-40">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
					>Thumb keys:</span
				>
				<select
					value={filterStore.thumbKeyFilter}
					onchange={(e) => filterStore.setThumbKeyFilter(e.currentTarget.value as ThumbKeyFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid {filterStore.thumbKeyFilter !== 'optional' ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>

			<label class="flex flex-col items-start gap-0.5 select-none w-40">
				<span
					class="text-sm flex items-center gap-1 whitespace-nowrap"
					style="color: var(--text-secondary);"
				>
					Magic key
					<Tooltip
						text="A magic key is a key that has custom functionality. For example, it can change its letter based on the preceeding key pressed. Since a magic key's functionality is not standardized, resources outside this explorer are required to understand its functionality."
					/>
					:
				</span>
				<select
					value={filterStore.magicKeyFilter}
					onchange={(e) => filterStore.setMagicKeyFilter(e.currentTarget.value as MagicKeyFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid {filterStore.magicKeyFilter !== 'optional' ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>

			<label class="flex flex-col items-start gap-0.5 select-none w-40">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
					>Board type:</span
				>
				<select
					value={filterStore.boardTypeFilter}
					onchange={(e) => filterStore.setBoardTypeFilter(e.currentTarget.value as BoardTypeFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid {filterStore.boardTypeFilter !== 'all' ? 'var(--accent)' : 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="all">All</option>
					<option value="angle">Angle</option>
					<option value="stagger">Stagger</option>
					<option value="ortho">Ortho</option>
					<option value="mini">Mini</option>
				</select>
			</label>

			<label class="flex flex-col items-start gap-0.5 select-none w-44">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);"
					>Character set:</span
				>
				<select
					value={filterStore.characterSetFilter}
					onchange={(e) =>
						filterStore.setCharacterSetFilter(e.currentTarget.value as CharacterSetFilter)}
					class="px-2 py-1 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all w-full"
					style="
					background-color: var(--input-bg);
					color: var(--text-primary);
					border: 1px solid {filterStore.characterSetFilter !== 'english'
						? 'var(--accent)'
						: 'var(--border)'};
					--tw-ring-color: var(--accent);
				"
				>
					<option value="all">All</option>
					<option value="english">English</option>
					<option value="international">International</option>
				</select>
			</label>

			<label
				class="flex items-center gap-2 select-none w-44 mt-5"
				class:cursor-pointer={filterStore.characterSetFilter !== 'international'}
			>
				<span class="relative">
					<input
						type="checkbox"
						checked={filterStore.showUnfinished}
						disabled={filterStore.characterSetFilter === 'international'}
						onchange={(e) => filterStore.setShowUnfinished(e.currentTarget.checked)}
						class="size-4 rounded appearance-none cursor-pointer relative"
						style="
						background-color: {filterStore.showUnfinished ? 'var(--accent)' : 'var(--bg-primary)'};
						border: 1px solid var(--border);
					"
					/>
					{#if filterStore.showUnfinished}
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
				<span
					class="text-sm flex items-center gap-1 whitespace-nowrap"
					class:line-through={filterStore.characterSetFilter === 'international'}
					style="color: var(--text-secondary);"
				>
					Show unfinished layouts
					<Tooltip
						text="Unfinished layouts are English-character-set layouts (without a magic key) that don't have all letters (A-Z) assigned to a key."
					/>
				</span>
			</label>
		</div>
	</div>
</div>

<div
	bind:this={resultsStatus}
	id="results-status"
	class="flex flex-col sm:flex-row items-center justify-between gap-3 mb-2"
>
	<div class="flex flex-col sm:flex-row items-center gap-3">
		<p style="color: var(--text-secondary);">
			Showing <span style="color: var(--accent); font-weight: 600;">{filteredCount}</span>
			{#if filterStore.hasSimilarReference}
				layouts <span style="color: var(--similar-diff); font-weight: 600;">similar</span> to
			{:else}
				layouts
			{/if}
			{#if filterStore.similarReferenceName}
				<span style="color: var(--text-primary); font-weight: 600;"
					>{filterStore.similarReferenceName}</span
				>
			{/if}
		</p>

		{#if filterStore.hasActiveFilters}
			<button
				onclick={() => filterStore.clearAll()}
				class="text-sm px-3 py-1.5 rounded-lg transition-colors"
				style="color: var(--accent); background-color: var(--bg-secondary); border: 1px solid var(--border);"
			>
				Reset filters
			</button>
		{/if}
	</div>

	<div
		class="flex flex-wrap items-center gap-x-6 gap-y-3 w-full sm:w-auto justify-start sm:justify-end"
	>
		<div class="flex flex-wrap items-center gap-2">
			<label class="flex items-center gap-2 select-none">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);">Analyzer:</span>
				<select
					value={filterStore.statsAnalyzer}
					onchange={(e) => filterStore.setStatsAnalyzer(e.currentTarget.value as StatsAnalyzer)}
					class="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all min-w-0"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid {!analyzerIsDefault ? 'var(--accent)' : 'var(--border)'};
						--tw-ring-color: var(--accent);
					"
				>
					{#each STAT_ANALYZERS as analyzer (analyzer.value)}
						<option value={analyzer.value}>{analyzer.label}</option>
					{/each}
				</select>
			</label>

			<label class="flex items-center gap-2 select-none">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);">Sort by:</span>
				<select
					value={filterStore.sortBy}
					onchange={(e) => filterStore.setSortBy(e.currentTarget.value as SortBy)}
					class="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all min-w-0"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid {!sortIsDefault ? 'var(--accent)' : 'var(--border)'};
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
					<optgroup label="Stats">
						{#each statSortFields as field (field.value)}
							<option value={field.value}>{field.label}</option>
						{/each}
					</optgroup>
				</select>
			</label>

			<label class="flex items-center gap-2 select-none">
				<span class="text-sm whitespace-nowrap" style="color: var(--text-secondary);">Order:</span>
				<select
					value={filterStore.sortOrder}
					onchange={(e) => filterStore.setSortOrder(e.currentTarget.value as SortOrder)}
					class="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 transition-all min-w-0"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid {!sortIsDefault ? 'var(--accent)' : 'var(--border)'};
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
				class="relative ml-3"
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
						border: 1px solid {displaySettingsActive || displaySettingsOpen
						? 'var(--accent)'
						: 'var(--border)'};
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
										background-color: {filterStore.hideLayoutTestArea
										? 'var(--accent)'
										: 'var(--bg-primary)'};
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
										background-color: {filterStore.hideLayoutStats
										? 'var(--accent)'
										: 'var(--bg-primary)'};
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
										background-color: {filterStore.hideLayoutLikes
										? 'var(--accent)'
										: 'var(--bg-primary)'};
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
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.filters-grid {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-areas:
			'keyFilters'
			'statLimits'
			'otherOptions';
	}

	.grid-area-key-filters {
		grid-area: keyFilters;
	}

	.grid-area-stat-limits {
		grid-area: statLimits;
	}

	.grid-area-other-options {
		grid-area: otherOptions;
		display: flex;
		flex-direction: column;
	}
</style>
