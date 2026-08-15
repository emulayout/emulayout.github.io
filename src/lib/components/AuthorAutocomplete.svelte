<script lang="ts">
	import Listbox from '$lib/components/Listbox.svelte';
	import { clampSearchResultIndex, findLayoutNameMatches } from '$lib/layoutNameSearch';
	import { navigateListIndex } from '$lib/listboxNavigation';

	interface Props {
		authors: readonly string[];
		placeholder?: string;
		/** Accessible label for the input. */
		label?: string;
		id?: string;
		maxResults?: number;
		/** Committed freeform or catalog author shown in the field. */
		selected?: string;
		onChange?: (name: string) => void;
		/** When set with a selection, shows a clear control in the field. */
		onClear?: () => void;
		/** Shows a non-author-affecting loading indicator inside the field. */
		loading?: boolean;
	}

	let {
		authors,
		placeholder = 'Search or add author',
		label = 'Author name',
		id = 'author-autocomplete',
		maxResults = 50,
		selected = '',
		onChange,
		onClear,
		loading = false
	}: Props = $props();

	let open = $state(false);
	let requestedIndex = $state(0);
	let hasFocusedOnce = $state(false);
	let suppressNextFocusOpen = false;
	let committedOnFocus = '';
	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	const committed = $derived(selected);
	const listboxId = $derived(`${id}-listbox`);
	/** Writable derived: follows `selected`, overridable while the user is typing. */
	let query = $derived(committed);
	const showClear = $derived(Boolean(onClear && committed));
	const defaultMatches = $derived.by(() => {
		const names = [...authors].toSorted((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' })
		);
		if (!committed) return names.slice(0, maxResults);
		const exact = names.find((name) => name.toLowerCase() === committed.toLowerCase());
		const rest = names.filter((name) => name.toLowerCase() !== committed.toLowerCase());
		return [exact ?? committed, ...rest].slice(0, maxResults);
	});
	const matches = $derived(
		open && (query.trim().length === 0 || query === committed)
			? defaultMatches
			: findLayoutNameMatches(authors, query, maxResults)
	);
	const activeIndex = $derived(clampSearchResultIndex(requestedIndex, matches.length));
	const listOpen = $derived(open);

	function commitName(name: string) {
		onChange?.(name);
		query = name;
		open = false;
		requestedIndex = 0;
	}

	function selectName(name: string) {
		commitName(name);
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
		committedOnFocus = committed;
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
		const value = (event.currentTarget as HTMLInputElement).value;
		query = value;
		onChange?.(value);
		requestedIndex = 0;
		open = true;
	}

	function handleFocusOut(event: FocusEvent) {
		const related = event.relatedTarget as Node | null;
		if (related && rootEl?.contains(related)) return;
		open = false;
		requestedIndex = 0;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (listOpen || query !== committedOnFocus) {
				event.preventDefault();
				event.stopPropagation();
				commitName(committedOnFocus);
			}
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const name = listOpen ? matches[activeIndex] : undefined;
			commitName(name ?? query);
			inputEl?.focus({ preventScroll: true });
			return;
		}

		if (!listOpen || matches.length === 0) return;

		const next = navigateListIndex(event.key, activeIndex, matches.length, {
			homeEnd: false
		});
		if (next !== null) {
			event.preventDefault();
			requestedIndex = next;
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
	class="author-autocomplete relative min-w-0 w-full"
	onfocusout={handleFocusOut}
>
	<label class="sr-only" for={id}>{label}</label>
	<div class="author-autocomplete-field relative min-w-0 w-full">
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
			class="author-autocomplete-input w-full rounded-xl py-2 text-sm outline-none focus:ring-2 transition-all"
			class:author-autocomplete-input--clearable={showClear}
			class:author-autocomplete-input--loading={loading}
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
		/>

		<div class="author-autocomplete-trailing" style="color: var(--text-secondary);">
			{#if loading}
				<span class="author-autocomplete-spinner" role="status" data-author-autocomplete-loading>
					<span class="sr-only">Loading authors…</span>
				</span>
			{/if}
			{#if showClear}
				<button
					type="button"
					class="author-autocomplete-clear"
					aria-label="Clear selected author"
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
				class="author-autocomplete-toggle"
				aria-label={listOpen ? 'Hide author options' : 'Show author options'}
				aria-expanded={listOpen}
				aria-controls={listboxId}
				onpointerdown={(event) => event.preventDefault()}
				onclick={toggleList}
			>
				<svg
					class="author-autocomplete-caret"
					class:author-autocomplete-caret--open={listOpen}
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
			class="author-autocomplete-list absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl py-1 shadow-lg"
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
				<p class="px-3 py-2 text-sm" style="color: var(--text-secondary);">No authors match.</p>
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

	.author-autocomplete-input {
		box-sizing: border-box;
		height: 2.375rem;
		padding-left: 0.75rem;
		padding-right: 2.25rem;
		border-radius: 0.75rem;
	}

	.author-autocomplete-input--clearable {
		padding-right: 3.75rem;
	}

	.author-autocomplete-input--loading {
		padding-right: 3.75rem;
	}

	.author-autocomplete-input--clearable.author-autocomplete-input--loading {
		padding-right: 5.25rem;
	}

	.author-autocomplete-trailing {
		position: absolute;
		top: 50%;
		right: 0.625rem;
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.author-autocomplete-clear {
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

	.author-autocomplete-spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		flex: none;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 9999px;
		animation: author-autocomplete-spin 1s linear infinite;
		transform-origin: center;
		will-change: transform;
	}

	.author-autocomplete-clear:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.author-autocomplete-clear:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.author-autocomplete-caret {
		width: 1rem;
		height: 1rem;
		flex: none;
		transition: transform 0.2s ease;
	}

	.author-autocomplete-toggle {
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

	.author-autocomplete-toggle:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.author-autocomplete-toggle:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.author-autocomplete-caret--open {
		transform: rotate(180deg);
	}

	@keyframes author-autocomplete-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
