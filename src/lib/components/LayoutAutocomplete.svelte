<script lang="ts">
	import Listbox from '$lib/components/Listbox.svelte';
	import type { LayoutData } from '$lib/layout';
	import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';
	import { navigateListIndex } from '$lib/listboxNavigation';

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
		/** Shows a non-layout-affecting loading indicator inside the field. */
		loading?: boolean;
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
		onClear,
		loading = false
	}: Props = $props();

	let open = $state(false);
	let requestedIndex = $state(0);
	let hasFocusedOnce = $state(false);
	let suppressNextFocusOpen = false;
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	const committed = $derived(selected ?? '');
	const listboxId = $derived(`${id}-listbox`);
	/** Writable derived: follows `selected`, overridable while the user is typing. */
	let query = $derived(committed);
	const showClear = $derived(Boolean(onClear && committed));
	const defaultMatches = $derived.by(() => {
		const names = layouts
			.map((layout) => layout.name)
			.toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		if (!committed) return names.slice(0, maxResults);
		return [committed, ...names.filter((name) => name !== committed)].slice(0, maxResults);
	});
	const matches = $derived(
		open && (query.trim().length === 0 || query === committed)
			? defaultMatches
			: findLayoutNameMatches(layouts, query, maxResults)
	);
	const activeIndex = $derived(clampSearchResultIndex(requestedIndex, matches.length));
	const listOpen = $derived(open);

	const highlightedName = $derived(
		listOpen && matches.length > 0 ? (matches[activeIndex] ?? null) : null
	);

	$effect(() => {
		onHighlight?.(highlightedName);
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
		inputEl?.focus({ preventScroll: true });
		inputEl?.select();
	}

	function handleClear() {
		onClear?.();
		query = '';
		open = false;
		requestedIndex = 0;
		suppressNextFocusOpen = true;
		inputEl?.focus({ preventScroll: true });
	}

	function handleInputFocus() {
		const shouldOpen = hasFocusedOnce && !suppressNextFocusOpen;
		hasFocusedOnce = true;
		suppressNextFocusOpen = false;
		if (shouldOpen) open = true;
		if (committed && query === committed) {
			inputEl?.select();
		}
	}

	function toggleList() {
		open = !open;
		requestedIndex = 0;
		suppressNextFocusOpen = document.activeElement !== inputEl;
		inputEl?.focus({ preventScroll: true });
		if (committed && query === committed) inputEl?.select();
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
			}
			return;
		}

		if (!listOpen || matches.length === 0) return;

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
			if (name) selectName(name, 'enter');
		}
	}

	function keyboardNavigation(node: HTMLInputElement) {
		node.addEventListener('keydown', handleKeyDown);
		return {
			destroy() {
				node.removeEventListener('keydown', handleKeyDown);
			}
		};
	}
</script>

<div
	bind:this={rootEl}
	class="layout-autocomplete relative min-w-0 w-full"
	onfocusout={handleFocusOut}
>
	<label class="sr-only" for={id}>{label}</label>
	<div class="layout-autocomplete-field relative min-w-0 w-full">
		<input
			use:keyboardNavigation
			bind:this={inputEl}
			{id}
			type="text"
			name="{id}-query"
			role="combobox"
			aria-autocomplete="list"
			aria-busy={loading}
			aria-expanded={listOpen}
			aria-controls={listboxId}
			aria-activedescendant={listOpen && matches[activeIndex]
				? `${listboxId}-option-${activeIndex}`
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
			class:layout-autocomplete-input--loading={loading}
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
		/>

		<div class="layout-autocomplete-trailing" style="color: var(--text-secondary);">
			{#if loading}
				<span class="layout-autocomplete-spinner" role="status" data-layout-autocomplete-loading>
					<span class="sr-only">Loading layouts…</span>
				</span>
			{/if}
			{#if showClear}
				<button
					type="button"
					class="layout-autocomplete-clear"
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
			<button
				type="button"
				class="layout-autocomplete-toggle"
				aria-label={listOpen ? 'Hide layout options' : 'Show layout options'}
				aria-expanded={listOpen}
				aria-controls={listboxId}
				onpointerdown={(event) => event.preventDefault()}
				onclick={toggleList}
			>
				<svg
					class="layout-autocomplete-caret"
					class:layout-autocomplete-caret--open={listOpen}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
		</div>
	</div>

	{#if listOpen}
		<Listbox
			id={listboxId}
			{label}
			options={matches}
			{activeIndex}
			onActiveIndexChange={(index) => (requestedIndex = index)}
			onSelect={(name) => selectName(name)}
			getKey={(name) => name}
			isSelected={(_, index) => index === activeIndex}
			preserveExternalFocus
			class="layout-autocomplete-list absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl py-1 shadow-lg"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			{#snippet item({ option: name, active, optionProps })}
				<button
					{...optionProps}
					class="flex w-full items-baseline px-3 py-1.5 text-left text-sm font-medium transition-colors"
					style="
						color: var(--text-primary);
						background-color: {active ? 'var(--bg-primary)' : 'transparent'};
					"
				>
					{name}
				</button>
			{/snippet}
			{#snippet empty()}
				<p class="px-3 py-2 text-sm" style="color: var(--text-secondary);">No layouts match.</p>
			{/snippet}
		</Listbox>
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
		padding-right: 2.25rem;
	}

	.layout-autocomplete-input--clearable {
		padding-right: 3.75rem;
	}

	.layout-autocomplete-input--loading {
		padding-right: 3.75rem;
	}

	.layout-autocomplete-input--clearable.layout-autocomplete-input--loading {
		padding-right: 5.25rem;
	}

	.layout-autocomplete-trailing {
		position: absolute;
		top: 50%;
		right: 0.625rem;
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.layout-autocomplete-clear {
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
		pointer-events: auto;
		cursor: pointer;
	}

	.layout-autocomplete-spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		flex: none;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 9999px;
		animation: layout-autocomplete-spin 1s linear infinite;
		transform-origin: center;
		will-change: transform;
	}

	.layout-autocomplete-clear:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.layout-autocomplete-clear:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.layout-autocomplete-caret {
		width: 1rem;
		height: 1rem;
		flex: none;
		transition: transform 0.2s ease;
	}

	.layout-autocomplete-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		pointer-events: auto;
		cursor: pointer;
	}

	.layout-autocomplete-toggle:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.layout-autocomplete-toggle:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.layout-autocomplete-caret--open {
		transform: rotate(180deg);
	}

	@keyframes layout-autocomplete-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
