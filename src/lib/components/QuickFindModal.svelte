<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { CYANOPHAGE_ANALYZER } from '$lib/layoutStats';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let query = $state('');
	let activeIndex = $state(0);
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let resultsList = $state<HTMLUListElement | undefined>(undefined);
	let previewPane = $state<HTMLDivElement | undefined>(undefined);

	const MAX_RESULTS = 100;

	const layoutByName = $derived(
		new Map<string, LayoutData>(layoutsCatalog.layouts.map((layout) => [layout.name, layout]))
	);

	const authorById = $derived(
		new Map<number, string>(
			Object.entries(layoutsCatalog.authorsData).map(([name, id]) => [id as number, name])
		)
	);

	const matches = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term || layoutsCatalog.layouts.length === 0) return [];

		const ranked: { name: string; rank: number }[] = [];
		for (const layout of layoutsCatalog.layouts) {
			const name = layout.name;
			const lower = name.toLowerCase();
			if (!lower.includes(term)) continue;
			const rank = lower === term ? 0 : lower.startsWith(term) ? 1 : 2;
			ranked.push({ name, rank });
		}

		ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
		return ranked.slice(0, MAX_RESULTS).map((r) => r.name);
	});

	const highlightedLayout = $derived.by((): LayoutData | null => {
		const name = matches[activeIndex];
		if (!name) return null;
		return layoutByName.get(name) ?? null;
	});

	const highlightedAuthorName = $derived(
		highlightedLayout ? (authorById.get(highlightedLayout.user) ?? 'Unknown') : ''
	);

	const highlightedCompactStats = $derived.by(() => {
		if (!highlightedLayout) return undefined;
		const map =
			filterStore.statsAnalyzer === CYANOPHAGE_ANALYZER
				? layoutStatsStore.maps.cyanophage
				: layoutStatsStore.maps.monkeyracer;
		return map?.[highlightedLayout.name];
	});

	// Reset highlight when the query changes; clamp if results shrink
	$effect(() => {
		query;
		activeIndex = 0;
	});

	$effect(() => {
		const count = matches.length;
		if (count > 0 && activeIndex >= count) {
			activeIndex = count - 1;
		}
	});

	$effect(() => {
		if (!open) {
			query = '';
			activeIndex = 0;
			return;
		}

		// Focus after the input mounts
		requestAnimationFrame(() => searchInput?.focus());

		function handleRefocus() {
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

	function handleSearchKeyDown(event: KeyboardEvent) {
		const count = matches.length;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (count === 0) return;
			activeIndex = (activeIndex + 1) % count;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (count === 0) return;
			activeIndex = (activeIndex - 1 + count) % count;
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
			bind:value={query}
			onkeydown={handleSearchKeyDown}
			placeholder="Search layout names…"
			class="w-full rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 transition-all duration-200"
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid {query ? 'var(--accent)' : 'var(--border)'};
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
								onpointerenter={() => (activeIndex = index)}
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
						likeCount={0}
						compactStats={highlightedCompactStats}
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
</ModalShell>
