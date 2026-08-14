<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Listbox from '$lib/components/Listbox.svelte';
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import type { LayoutCardMetric } from '$lib/layoutStatsBlockModel';
	import type { StatLimitOperator } from '$lib/filterStore.svelte';
	import { layoutDetailPageHref } from '$lib/layoutDetailTabs';
	import { resolveLayoutDetailStats } from '$lib/layoutDetails';
	import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { layoutDetailsStore } from '$lib/layoutDetailsStore.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { navigateListIndex } from '$lib/listboxNavigation';
	import { uiPrefs } from '$lib/uiPrefs.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let query = $state('');
	let requestedIndex = $state(0);
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let previewPane = $state<HTMLDivElement | undefined>(undefined);
	let filterSnackbar = $state<string | null>(null);
	let filterSnackbarTimer: number | undefined;
	/** Preview target; debounced when detail files must be fetched on demand. */
	let previewName = $state<string | null>(null);

	const MAX_RESULTS = 100;
	/** Same cadence as filter typing — avoid a detail request per keystroke/arrow. */
	const DETAIL_LOAD_DEBOUNCE_MS = 300;

	const matches = $derived(findLayoutNameMatches(layoutsCatalog.layoutNames, query, MAX_RESULTS));
	const activeIndex = $derived(clampSearchResultIndex(requestedIndex, matches.length));
	const highlightedName = $derived(matches[activeIndex] ?? null);
	const catalogDetail = $derived(
		previewName
			? layoutsCatalog.getLayoutDetail(
					previewName,
					layoutStatsStore.maps,
					layoutStatsStore.activeCorpus
				)
			: null
	);
	const fetchedDetail = $derived(
		previewName ? (layoutDetailsStore.get(previewName) ?? null) : null
	);
	const highlightedDetail = $derived(catalogDetail ?? fetchedDetail);
	const highlightedStats = $derived(
		highlightedDetail
			? resolveLayoutDetailStats(highlightedDetail.stats, layoutStatsStore.activeCorpus)
			: {}
	);
	const openedFromDetailPage = $derived(page.route.id === '/layouts/[name]');

	// Detail links in the preview navigate in-app; dismiss so the show page is not covered.
	afterNavigate(() => {
		if (open) onClose();
	});

	$effect(() => {
		if (!open) {
			query = '';
			requestedIndex = 0;
			previewName = null;
			filterSnackbar = null;
			if (filterSnackbarTimer !== undefined) {
				window.clearTimeout(filterSnackbarTimer);
				filterSnackbarTimer = undefined;
			}
			return;
		}
		void layoutsCatalog.ensureNamesLoaded();

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

	$effect(() => {
		if (!open) return;

		// Aggregate catalog already in memory — preview tracks the highlight immediately.
		if (layoutsCatalog.fullCatalogLoaded) {
			previewName = highlightedName;
			return;
		}

		if (!highlightedName) {
			previewName = null;
			return;
		}

		// Already fetched or currently loading this layout — show it without waiting.
		if (
			layoutDetailsStore.get(highlightedName) ||
			layoutDetailsStore.loadingNames[highlightedName]
		) {
			previewName = highlightedName;
			return;
		}

		const name = highlightedName;
		const timeoutId = window.setTimeout(() => {
			previewName = name;
		}, DETAIL_LOAD_DEBOUNCE_MS);
		return () => window.clearTimeout(timeoutId);
	});

	$effect(() => {
		if (!open || !previewName || highlightedDetail || layoutsCatalog.fullCatalogLoaded) return;
		void layoutDetailsStore.load(previewName);
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

	function showLayout(name: string, event?: MouseEvent | KeyboardEvent) {
		const href = layoutDetailPageHref(resolve('/layouts/[name]', { name }));

		// Cmd/Ctrl activation mirrors modified link clicks: open a new tab and
		// keep Quick Find open on the current page.
		if (event && (event.metaKey || event.ctrlKey)) {
			window.open(href, '_blank', 'noopener');
			return;
		}

		onClose();
		// href starts with route-aware resolve(); the helper appends only the canonical query.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}

	function showAppliedFilterSnackbar(
		metric: LayoutCardMetric,
		operator: StatLimitOperator,
		_value: string,
		enabled: boolean
	) {
		filterSnackbar = enabled
			? `${metric.label} ${operator === 'gt' ? '≥' : '≤'} ${metric.value} filter set`
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
		const next = navigateListIndex(event.key, activeIndex, matches.length, {
			homeEnd: false
		});
		if (next !== null) {
			event.preventDefault();
			requestedIndex = next;
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const name = matches[activeIndex];
			if (name) void showLayout(name, event);
		}
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="quick-find-title"
	panelClass="max-h-[min(90vh,720px)] max-w-4xl"
>
	<ModalHeader titleId="quick-find-title" title="Quick find" {onClose} />

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
			aria-activedescendant={matches[activeIndex]
				? `quick-find-results-option-${activeIndex}`
				: undefined}
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
			{#if layoutsCatalog.layoutNames.length === 0 && !layoutsCatalog.loadError}
				<p class="text-sm" style="color: var(--text-secondary);">Loading…</p>
			{:else if layoutsCatalog.loadError}
				<p class="text-sm" role="alert" style="color: var(--text-secondary);">
					Layout names could not be loaded.
				</p>
			{:else if !query.trim()}
				<p class="text-sm" style="color: var(--text-secondary);">Type to search layout names.</p>
			{:else if matches.length === 0}
				<p class="text-sm" style="color: var(--text-secondary);">No layouts match.</p>
			{:else}
				<Listbox
					id="quick-find-results"
					label="Matching layouts"
					options={matches}
					{activeIndex}
					onActiveIndexChange={(index) => (requestedIndex = index)}
					onSelect={showLayout}
					getKey={(name) => name}
					isSelected={(_, index) => index === activeIndex}
					preserveExternalFocus
					class="space-y-1"
				>
					{#snippet item({ option: name, active, optionProps })}
						<button
							{...optionProps}
							class="flex w-full items-baseline rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors"
							style="
								color: var(--text-primary);
								background-color: {active ? 'var(--bg-secondary)' : 'transparent'};
							"
						>
							{name}
						</button>
					{/snippet}
				</Listbox>
				{#if matches.length === MAX_RESULTS}
					<p class="mt-3 text-xs" style="color: var(--text-caption);">
						Showing first {MAX_RESULTS} matches. Refine your search for more.
					</p>
				{/if}
			{/if}
		</div>

		<div bind:this={previewPane} class="hidden min-h-0 flex-1 overflow-y-auto p-5 md:block">
			{#if highlightedDetail}
				{#key highlightedDetail.layout.name}
					<LayoutCard
						layout={highlightedDetail.layout}
						authorName={highlightedDetail.authorName}
						likeCount={highlightedDetail.likeCount}
						compactCminiStats={highlightedStats.cmini}
						compactCyanophageStats={highlightedStats.cyanophage}
						compactMana2Stats={highlightedStats.mana2}
						inputProfile={highlightedDetail.inputProfile}
						statFilterInteraction={openedFromDetailPage ? 'disabled' : 'apply-only'}
						allowSelection={!openedFromDetailPage}
						statsMode={uiPrefs.layoutCardStatsMode}
						allowStatSorting={false}
						onStatFilterChanged={showAppliedFilterSnackbar}
					/>
				{/key}
			{:else if previewName && layoutDetailsStore.loadingNames[previewName]}
				<div
					class="flex h-full min-h-48 items-center justify-center rounded-xl px-4 text-center text-sm"
					style="color: var(--text-secondary); background-color: var(--bg-secondary); border: 1px dashed var(--border);"
					role="status"
				>
					Loading layout…
				</div>
			{:else if previewName && layoutDetailsStore.loadErrors[previewName]}
				<div
					class="flex h-full min-h-48 items-center justify-center rounded-xl px-4 text-center text-sm"
					style="color: var(--text-secondary); background-color: var(--bg-secondary); border: 1px dashed var(--border);"
					role="alert"
				>
					Layout details could not be loaded.
				</div>
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
