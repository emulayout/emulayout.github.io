<script lang="ts">
	import Listbox from '$lib/components/Listbox.svelte';
	import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';
	import { navigateListIndex } from '$lib/listboxNavigation';

	export type TextAutocompleteMode = 'selection' | 'freeform';

	interface Props {
		options: readonly string[];
		selected?: string | null;
		mode?: TextAutocompleteMode;
		placeholder: string;
		label: string;
		id: string;
		maxResults?: number;
		/** Existing options to place before the default alphabetical list. */
		preferredOptions?: readonly string[];
		kind: 'layout' | 'author';
		emptyText: string;
		loadingText: string;
		clearLabel: string;
		showOptionsLabel: string;
		hideOptionsLabel: string;
		onInputChange?: (value: string) => void;
		onHighlight?: (value: string | null) => void;
		onSelect?: (value: string, meta: { via: 'enter' | 'click' }) => void;
		onClear?: () => void;
		loading?: boolean;
	}

	let {
		options,
		selected = '',
		mode = 'selection',
		placeholder,
		label,
		id,
		maxResults = 50,
		preferredOptions = [],
		kind,
		emptyText,
		loadingText,
		clearLabel,
		showOptionsLabel,
		hideOptionsLabel,
		onInputChange,
		onHighlight,
		onSelect,
		onClear,
		loading = false
	}: Props = $props();

	let open = $state(false);
	let requestedIndex = $state(0);
	let hasFocusedOnce = $state(false);
	let searchActive = $state(false);
	let suppressNextFocusOpen = false;
	let valueOnFocus = '';
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	const committed = $derived(selected ?? '');
	const listboxId = $derived(`${id}-listbox`);
	/** Writable derived: follows `selected`, overridable while a selection search is in progress. */
	let query = $derived(committed);
	const showClear = $derived(Boolean(onClear && committed));
	const defaultMatches = $derived.by(() => {
		const names = [...options].toSorted((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' })
		);
		const preferredNames = preferredOptions.flatMap((preferred) => {
			const normalizedPreferred = preferred.toLowerCase();
			const match = names.find((name) => name.toLowerCase() === normalizedPreferred);
			return match ? [match] : [];
		});
		const preferredNameSet = new Set(preferredNames.map((name) => name.toLowerCase()));
		const orderedNames = [
			...preferredNames,
			...names.filter((name) => !preferredNameSet.has(name.toLowerCase()))
		];
		if (!committed) return orderedNames.slice(0, maxResults);
		const normalizedCommitted = committed.toLowerCase();
		const exact = orderedNames.find((name) => name.toLowerCase() === normalizedCommitted);
		const rest = orderedNames.filter((name) => name.toLowerCase() !== normalizedCommitted);
		return [exact ?? committed, ...rest].slice(0, maxResults);
	});
	const matches = $derived(
		open && (!searchActive || query.trim().length === 0)
			? defaultMatches
			: findLayoutNameMatches(options, query, maxResults)
	);
	const activeIndex = $derived(clampSearchResultIndex(requestedIndex, matches.length));
	const highlightedValue = $derived(
		open && matches.length > 0 ? (matches[activeIndex] ?? null) : null
	);

	$effect(() => {
		onHighlight?.(highlightedValue);
	});

	function closeList() {
		open = false;
		searchActive = false;
		requestedIndex = 0;
	}

	function resetToCommitted() {
		query = committed;
		closeList();
	}

	function selectValue(value: string, via: 'enter' | 'click' = 'click') {
		if (mode === 'freeform') onInputChange?.(value);
		onSelect?.(value, { via });
		query = value;
		closeList();
		inputEl?.focus({ preventScroll: true });
		inputEl?.select();
	}

	function handleClear() {
		onClear?.();
		query = '';
		closeList();
		suppressNextFocusOpen = true;
		inputEl?.focus({ preventScroll: true });
	}

	function handleInputFocus() {
		valueOnFocus = committed;
		const shouldOpen = hasFocusedOnce && !suppressNextFocusOpen;
		hasFocusedOnce = true;
		suppressNextFocusOpen = false;
		if (shouldOpen) {
			open = true;
			searchActive = false;
		}
		if (committed && query === committed) inputEl?.select();
	}

	function toggleList() {
		open = !open;
		searchActive = false;
		requestedIndex = 0;
		suppressNextFocusOpen = document.activeElement !== inputEl;
		inputEl?.focus({ preventScroll: true });
		if (committed && query === committed) inputEl?.select();
	}

	function handleInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		query = value;
		searchActive = true;
		onInputChange?.(value);
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
		if (mode === 'selection') resetToCommitted();
		else closeList();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (open || query !== (mode === 'freeform' ? valueOnFocus : committed)) {
				event.preventDefault();
				event.stopPropagation();
				if (mode === 'freeform') {
					onInputChange?.(valueOnFocus);
					query = valueOnFocus;
					closeList();
				} else {
					resetToCommitted();
				}
			}
			return;
		}

		if (mode === 'freeform' && event.key === 'Enter') {
			event.preventDefault();
			selectValue(open ? (matches[activeIndex] ?? query) : query, 'enter');
			return;
		}

		if (!open || matches.length === 0) return;
		const next = navigateListIndex(event.key, activeIndex, matches.length, { homeEnd: false });
		if (next !== null) {
			event.preventDefault();
			requestedIndex = next;
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const value = matches[activeIndex];
			if (value) selectValue(value, 'enter');
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
	class="text-autocomplete {kind}-autocomplete relative min-w-0 w-full"
	onfocusout={handleFocusOut}
>
	<label class="sr-only" for={id}>{label}</label>
	<div class="text-autocomplete-field relative min-w-0 w-full">
		<input
			use:keyboardNavigation
			bind:this={inputEl}
			{id}
			type="text"
			name="{id}-query"
			role="combobox"
			aria-autocomplete="list"
			aria-busy={loading}
			aria-expanded={open}
			aria-controls={listboxId}
			aria-activedescendant={open && matches[activeIndex]
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
			class="text-autocomplete-input w-full rounded-xl py-2 text-sm outline-none focus:ring-2 transition-all"
			class:text-autocomplete-input--clearable={showClear}
			class:text-autocomplete-input--loading={loading}
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
		/>

		<div class="text-autocomplete-trailing" style="color: var(--text-secondary);">
			{#if loading}
				<span
					class="text-autocomplete-spinner"
					role="status"
					data-layout-autocomplete-loading={kind === 'layout' ? '' : undefined}
					data-author-autocomplete-loading={kind === 'author' ? '' : undefined}
				>
					<span class="sr-only">{loadingText}</span>
				</span>
			{/if}
			{#if showClear}
				<button
					type="button"
					class="text-autocomplete-clear"
					aria-label={clearLabel}
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
				class="text-autocomplete-toggle"
				aria-label={open ? hideOptionsLabel : showOptionsLabel}
				aria-expanded={open}
				aria-controls={listboxId}
				onpointerdown={(event) => event.preventDefault()}
				onclick={toggleList}
			>
				<svg
					class="text-autocomplete-caret"
					class:text-autocomplete-caret--open={open}
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

	{#if open}
		<Listbox
			id={listboxId}
			{label}
			options={matches}
			{activeIndex}
			onActiveIndexChange={(index) => (requestedIndex = index)}
			onSelect={(value) => selectValue(value)}
			getKey={(value) => value}
			isSelected={(_, index) => index === activeIndex}
			preserveExternalFocus
			class="text-autocomplete-list absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl py-1 shadow-lg"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			{#snippet item({ option: value, active, optionProps })}
				<button
					{...optionProps}
					class="flex w-full items-baseline px-3 py-1.5 text-left text-sm font-medium transition-colors"
					style="
						color: var(--text-primary);
						background-color: {active ? 'var(--bg-primary)' : 'transparent'};
					"
				>
					{value}
				</button>
			{/snippet}
			{#snippet empty()}
				<p class="px-3 py-2 text-sm" style="color: var(--text-secondary);">{emptyText}</p>
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

	.text-autocomplete-input {
		box-sizing: border-box;
		height: 2.375rem;
		padding-left: 0.75rem;
		padding-right: 2.25rem;
		border-radius: 0.75rem;
	}

	.text-autocomplete-input--clearable,
	.text-autocomplete-input--loading {
		padding-right: 3.75rem;
	}

	.text-autocomplete-input--clearable.text-autocomplete-input--loading {
		padding-right: 5.25rem;
	}

	.text-autocomplete-trailing {
		position: absolute;
		top: 50%;
		right: 0.625rem;
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.text-autocomplete-clear,
	.text-autocomplete-toggle {
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
		color: inherit;
		pointer-events: auto;
		cursor: pointer;
	}

	.text-autocomplete-spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		flex: none;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 9999px;
		animation: text-autocomplete-spin 1s linear infinite;
		transform-origin: center;
		will-change: transform;
	}

	.text-autocomplete-clear:hover,
	.text-autocomplete-toggle:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.text-autocomplete-clear:focus-visible,
	.text-autocomplete-toggle:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.text-autocomplete-caret {
		width: 1rem;
		height: 1rem;
		flex: none;
		transition: transform 0.2s ease;
	}

	.text-autocomplete-caret--open {
		transform: rotate(180deg);
	}

	@keyframes text-autocomplete-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
