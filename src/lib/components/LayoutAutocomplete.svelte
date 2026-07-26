<script lang="ts">
	import type { LayoutData } from '$lib/layout';
	import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';

	interface Props {
		layouts: LayoutData[];
		placeholder?: string;
		/** Accessible label for the input. */
		label?: string;
		id?: string;
		maxResults?: number;
		/** Committed selection shown in the field when not actively searching. */
		selected?: string | null;
		/** Fires with the highlighted option while browsing; `null` when preview ends. */
		onHighlight?: (name: string | null) => void;
		onSelect?: (name: string, meta: { via: 'enter' | 'click' }) => void;
		/** When set with a selection, shows a clear control in the field. */
		onClear?: () => void;
	}

	let {
		layouts,
		placeholder = 'Search layouts…',
		label = 'Find layout',
		id = 'layout-autocomplete',
		maxResults = 50,
		selected = null,
		onHighlight,
		onSelect,
		onClear
	}: Props = $props();

	let open = $state(false);
	let requestedIndex = $state(0);
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let listEl = $state<HTMLUListElement | undefined>(undefined);

	const committed = $derived(selected ?? '');
	/** Writable derived: follows `selected`, overridable while the user is typing. */
	let query = $derived(committed);
	const showClear = $derived(Boolean(onClear && committed));
	const matches = $derived(findLayoutNameMatches(layouts, query, maxResults));
	const activeIndex = $derived(clampSearchResultIndex(requestedIndex, matches.length));

	/** Don't open the list just because the committed name fills the field. */
	const listOpen = $derived(open && query.trim().length > 0 && query.trim() !== committed);

	const highlightedName = $derived(
		listOpen && matches.length > 0 ? (matches[activeIndex] ?? null) : null
	);

	$effect(() => {
		onHighlight?.(highlightedName);
	});

	$effect(() => {
		if (!listOpen || !listEl) return;
		const item = listEl.children[activeIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: 'nearest' });
	});

	function resetToCommitted() {
		query = committed;
		open = false;
		requestedIndex = 0;
	}

	function selectName(name: string, via: 'enter' | 'click' = 'click') {
		onSelect?.(name, { via });
		query = name;
		open = false;
		requestedIndex = 0;
		inputEl?.blur();
	}

	function handleClear() {
		onClear?.();
		query = '';
		open = false;
		requestedIndex = 0;
		inputEl?.focus();
	}

	function handleInputFocus() {
		open = true;
		if (committed && query === committed) {
			inputEl?.select();
		}
	}

	function handleInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		requestedIndex = 0;
		open = true;
	}

	/** Focus the search input (e.g. when the parent modal opens). */
	export function focus() {
		inputEl?.focus();
	}

	function handleFocusOut(event: FocusEvent) {
		const related = event.relatedTarget as Node | null;
		if (related && rootEl?.contains(related)) return;
		resetToCommitted();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (listOpen || query !== committed) {
				event.preventDefault();
				event.stopPropagation();
				resetToCommitted();
				inputEl?.blur();
			}
			return;
		}

		if (!listOpen || matches.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			requestedIndex = (activeIndex + 1) % matches.length;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			requestedIndex = (activeIndex - 1 + matches.length) % matches.length;
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
	<div class="layout-autocomplete-field relative min-w-0 w-full">
		<input
			bind:this={inputEl}
			{id}
			type="text"
			name="{id}-query"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={listOpen}
			aria-controls="{id}-listbox"
			aria-activedescendant={listOpen && matches[activeIndex]
				? `${id}-option-${activeIndex}`
				: undefined}
			autocomplete="off"
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
			data-1p-ignore
			data-lpignore="true"
			data-form-type="other"
			{placeholder}
			value={query}
			onfocus={handleInputFocus}
			oninput={handleInput}
			class="layout-autocomplete-input w-full rounded-xl py-2 text-sm outline-none focus:ring-2 transition-all"
			class:layout-autocomplete-input--clearable={showClear}
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
		/>

		{#if showClear}
			<button
				type="button"
				class="layout-autocomplete-clear"
				style="color: var(--text-secondary);"
				aria-label="Clear selected layout"
				title="Clear"
				onclick={handleClear}
			>
				<svg
					class="size-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		{/if}
	</div>

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
							onpointerenter={() => (requestedIndex = index)}
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

	.layout-autocomplete-input {
		padding-left: 0.75rem;
		padding-right: 0.75rem;
	}

	.layout-autocomplete-input--clearable {
		padding-right: 2rem;
	}

	.layout-autocomplete-clear {
		position: absolute;
		top: 50%;
		right: 0.375rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		transform: translateY(-50%);
		cursor: pointer;
	}

	.layout-autocomplete-clear:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.layout-autocomplete-clear:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}
</style>
