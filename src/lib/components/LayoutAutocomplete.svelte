<script lang="ts">
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layouts: LayoutData[];
		placeholder?: string;
		/** Accessible label for the input. */
		label?: string;
		id?: string;
		maxResults?: number;
		/** Fires with the highlighted option while browsing; `null` when preview ends. */
		onHighlight?: (name: string | null) => void;
		onSelect?: (name: string, meta: { via: 'enter' | 'click' }) => void;
	}

	let {
		layouts,
		placeholder = 'Search layouts…',
		label = 'Find layout',
		id = 'layout-autocomplete',
		maxResults = 50,
		onHighlight,
		onSelect
	}: Props = $props();

	let query = $state('');
	let open = $state(false);
	let activeIndex = $state(0);
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let listEl = $state<HTMLUListElement | undefined>(undefined);

	const matches = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term || layouts.length === 0) return [];

		const ranked: { name: string; rank: number }[] = [];
		for (const layout of layouts) {
			const name = layout.name;
			const lower = name.toLowerCase();
			if (!lower.includes(term)) continue;
			const rank = lower === term ? 0 : lower.startsWith(term) ? 1 : 2;
			ranked.push({ name, rank });
		}

		ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
		return ranked.slice(0, maxResults).map((entry) => entry.name);
	});

	const listOpen = $derived(open && query.trim().length > 0);

	const highlightedName = $derived(
		listOpen && matches.length > 0 ? (matches[activeIndex] ?? null) : null
	);

	$effect(() => {
		onHighlight?.(highlightedName);
	});

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
		if (!listOpen || !listEl) return;
		const item = listEl.children[activeIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: 'nearest' });
	});

	function clearQuery() {
		query = '';
		open = false;
		activeIndex = 0;
	}

	function selectName(name: string, via: 'enter' | 'click' = 'click') {
		onSelect?.(name, { via });
		clearQuery();
		inputEl?.blur();
	}

	function handleInputFocus() {
		open = true;
	}

	/** Focus the search input (e.g. when the parent modal opens). */
	export function focus() {
		inputEl?.focus();
	}

	function handleFocusOut(event: FocusEvent) {
		const related = event.relatedTarget as Node | null;
		if (related && rootEl?.contains(related)) return;
		clearQuery();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (listOpen || query.trim().length > 0) {
				event.preventDefault();
				event.stopPropagation();
				clearQuery();
			}
			return;
		}

		if (!listOpen || matches.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % matches.length;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + matches.length) % matches.length;
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const name = matches[activeIndex];
			if (name) selectName(name, 'enter');
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={rootEl}
	class="layout-autocomplete relative min-w-0 w-full"
	onfocusout={handleFocusOut}
	onkeydown={handleKeyDown}
>
	<label class="sr-only" for={id}>{label}</label>
	<input
		bind:this={inputEl}
		{id}
		type="text"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={listOpen}
		aria-controls="{id}-listbox"
		aria-activedescendant={listOpen && matches[activeIndex]
			? `${id}-option-${activeIndex}`
			: undefined}
		{placeholder}
		bind:value={query}
		onfocus={handleInputFocus}
		oninput={() => (open = true)}
		class="w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 transition-all"
		style="
			background-color: var(--input-bg);
			color: var(--text-primary);
			border: 1px solid {query.trim() ? 'var(--accent)' : 'var(--border)'};
			--tw-ring-color: var(--accent);
		"
	/>

	{#if listOpen}
		<ul
			bind:this={listEl}
			id="{id}-listbox"
			class="layout-autocomplete-list absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl py-1 shadow-lg"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
			role="listbox"
			aria-label={label}
		>
			{#if matches.length === 0}
				<li class="px-3 py-2 text-sm" style="color: var(--text-secondary);">No layouts match.</li>
			{:else}
				{#each matches as name, index (name)}
					<li role="option" aria-selected={index === activeIndex} id="{id}-option-{index}">
						<button
							type="button"
							class="flex w-full items-baseline px-3 py-1.5 text-left text-sm font-medium transition-colors"
							style="
								color: var(--text-primary);
								background-color: {index === activeIndex ? 'var(--bg-primary)' : 'transparent'};
							"
							onpointerenter={() => (activeIndex = index)}
							onclick={() => selectName(name)}
						>
							{name}
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
