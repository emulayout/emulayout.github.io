<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import type { LayoutCardMetric } from '$lib/layoutStatsBlockModel';
	import type { StatLimitOperator } from '$lib/filterStore.svelte';
	import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let query = $state('');
	let requestedIndex = $state(0);
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let resultsList = $state<HTMLUListElement | undefined>(undefined);
	let previewPane = $state<HTMLDivElement | undefined>(undefined);
	let filterSnackbar = $state<string | null>(null);
	let filterSnackbarTimer: number | undefined;

	const MAX_RESULTS = 100;

	const layoutByName = $derived(
		new Map<string, LayoutData>(layoutsCatalog.layouts.map((layout) => [layout.name, layout]))
	);

	const authorById = $derived(
		new Map<number, string>(
			Object.entries(layoutsCatalog.authorsData).map(([name, id]) => [id as number, name])
		)
	);

	const matches = $derived(findLayoutNameMatches(layoutsCatalog.layouts, query, MAX_RESULTS));
	const activeIndex = $derived(clampSearchResultIndex(requestedIndex, matches.length));

	const highlightedLayout = $derived.by((): LayoutData | null => {
		const name = matches[activeIndex];
		if (!name) return null;
		return layoutByName.get(name) ?? null;
	});

	const highlightedAuthorName = $derived(
		highlightedLayout ? (authorById.get(highlightedLayout.user) ?? 'Unknown') : ''
	);

	$effect(() => {
		if (!open) {
			query = '';
			requestedIndex = 0;
			filterSnackbar = null;
			if (filterSnackbarTimer !== undefined) {
				window.clearTimeout(filterSnackbarTimer);
				filterSnackbarTimer = undefined;
			}
			return;
		}

		// Focus after the input mounts
		requestAnimationFrame(() => searchInput?.focus());

		function handleRefocus() {
			const active = document.activeElement;
			const inPreview = Boolean(active && previewPane?.contains(active));
			if (inPreview) {
				searchInput?.focus();
				searchInput?.select();
				return;
			}
			focusPreviewFirstAction();
		}

		window.addEventListener('emulayout:quick-find-refocus', handleRefocus);
		return () => {
			window.removeEventListener('emulayout:quick-find-refocus', handleRefocus);
		};
	});

	// Scroll the highlighted result into view
	$effect(() => {
		if (!resultsList || matches.length === 0) return;
		const item = resultsList.children[activeIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: 'nearest' });
	});

	function focusPreviewFirstAction() {
		const firstAction = previewPane?.querySelector(
			'[data-layout-card-first-action]'
		) as HTMLElement | null;
		if (firstAction) {
			firstAction.focus();
			return;
		}
		searchInput?.focus();
	}

	function showLayout(name: string) {
		filterStore.focusLayout(name);
		onClose();
	}

	function showAppliedFilterSnackbar(
		metric: LayoutCardMetric,
		operator: StatLimitOperator,
		_value: string,
		enabled: boolean
	) {
		filterSnackbar = enabled
			? `${metric.label} ${operator === 'gt' ? '>' : '<'} ${metric.value} filter set`
			: `${metric.label} filter cleared`;
		if (filterSnackbarTimer !== undefined) window.clearTimeout(filterSnackbarTimer);
		filterSnackbarTimer = window.setTimeout(() => {
			filterSnackbar = null;
			filterSnackbarTimer = undefined;
		}, 2600);
	}

	function handleSearchInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		requestedIndex = 0;
	}

	function handleSearchKeyDown(event: KeyboardEvent) {
		const count = matches.length;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (count === 0) return;
			requestedIndex = (activeIndex + 1) % count;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (count === 0) return;
			requestedIndex = (activeIndex - 1 + count) % count;
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const name = matches[activeIndex];
			if (name) showLayout(name);
		}
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="quick-find-title"
	panelClass="max-h-[min(90vh,720px)] max-w-4xl"
>
	<div
		class="flex items-center justify-between border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<h2 id="quick-find-title" class="text-lg font-semibold" style="color: var(--text-primary);">
			Quick find
		</h2>
		<button
			onclick={onClose}
			class="flex size-8 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="border-b px-5 py-3" style="border-color: var(--border);">
		<input
			bind:this={searchInput}
			type="text"
			value={query}
			oninput={handleSearchInput}
			onkeydown={handleSearchKeyDown}
			placeholder="Search layout names…"
			class="w-full rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 transition-all duration-200"
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
			aria-label="Search layout names"
			aria-controls="quick-find-results"
			aria-activedescendant={matches[activeIndex] ? `quick-find-option-${activeIndex}` : undefined}
			role="combobox"
			aria-expanded={matches.length > 0}
			aria-autocomplete="list"
		/>
	</div>

	<div class="flex min-h-0 flex-1 flex-col md:flex-row">
		<div
			class="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:max-w-sm md:border-r"
			style="border-color: var(--border);"
		>
			{#if layoutsCatalog.layouts.length === 0}
				<p class="text-sm" style="color: var(--text-secondary);">Loading…</p>
			{:else if !query.trim()}
				<p class="text-sm" style="color: var(--text-secondary);">Type to search layout names.</p>
			{:else if matches.length === 0}
				<p class="text-sm" style="color: var(--text-secondary);">No layouts match.</p>
			{:else}
				<ul
					bind:this={resultsList}
					id="quick-find-results"
					class="space-y-1"
					role="listbox"
					aria-label="Matching layouts"
				>
					{#each matches as name, index (name)}
						<li role="option" aria-selected={index === activeIndex} id="quick-find-option-{index}">
							<button
								type="button"
								onclick={() => showLayout(name)}
								onpointerenter={() => (requestedIndex = index)}
								class="flex w-full items-baseline rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors"
								style="
									color: var(--text-primary);
									background-color: {index === activeIndex ? 'var(--bg-secondary)' : 'transparent'};
								"
							>
								{name}
							</button>
						</li>
					{/each}
				</ul>
				{#if matches.length === MAX_RESULTS}
					<p class="mt-3 text-xs" style="color: var(--text-caption);">
						Showing first {MAX_RESULTS} matches. Refine your search for more.
					</p>
				{/if}
			{/if}
		</div>

		<div bind:this={previewPane} class="hidden min-h-0 flex-1 overflow-y-auto p-5 md:block">
			{#if highlightedLayout}
				{#key highlightedLayout.name}
					<LayoutCard
						layout={highlightedLayout}
						authorName={highlightedAuthorName}
						likeCount={layoutsCatalog.likesData[highlightedLayout.name] ?? 0}
						compactCminiStats={layoutStatsStore.maps.cmini?.[highlightedLayout.name]}
						compactCyanophageStats={layoutStatsStore.maps.cyanophage?.[highlightedLayout.name]}
						compactMana2Stats={layoutStatsStore.maps.mana2?.[highlightedLayout.name]}
						statFilterInteraction="apply-only"
						allowStatSorting={false}
						onStatFilterChanged={showAppliedFilterSnackbar}
					/>
				{/key}
			{:else}
				<div
					class="flex h-full min-h-48 items-center justify-center rounded-xl px-4 text-center text-sm"
					style="color: var(--text-secondary); background-color: var(--bg-secondary); border: 1px dashed var(--border);"
				>
					Highlight a layout to preview it here.
				</div>
			{/if}
		</div>
	</div>

	{#if filterSnackbar}
		<div class="quick-find-snackbar" role="status" aria-live="polite">
			{filterSnackbar}
		</div>
	{/if}
</ModalShell>

<style>
	.quick-find-snackbar {
		position: absolute;
		inset-inline-start: 50%;
		inset-block-end: 1rem;
		z-index: 5;
		max-width: calc(100% - 2rem);
		transform: translateX(-50%);
		padding: 0.55rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--accent) 48%, var(--border));
		border-radius: 0.65rem;
		color: var(--text-primary);
		background: color-mix(in srgb, var(--bg-primary) 88%, var(--accent));
		box-shadow: 0 0.5rem 1.5rem color-mix(in srgb, black 30%, transparent);
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.2;
		text-align: center;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
