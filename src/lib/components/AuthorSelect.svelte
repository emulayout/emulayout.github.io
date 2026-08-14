<script lang="ts">
	import Listbox from '$lib/components/Listbox.svelte';
	import { navigateListIndex } from '$lib/listboxNavigation';

	interface Author {
		name: string;
		id: number;
	}

	interface Props {
		authors: Author[];
		selectedIds: Set<number>;
		onToggle: (id: number) => void;
		onClear: () => void;
		/** Bump to open the author dropdown (e.g. from an active-filter chip). */
		openSeq?: number;
	}

	let { authors, selectedIds, onToggle, onClear, openSeq = 0 }: Props = $props();

	const listboxId = 'author-filter-listbox';

	let open = $state(false);
	let search = $state('');
	let requestedIndex = $state(0);
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let triggerButton = $state<HTMLButtonElement | undefined>(undefined);

	$effect(() => {
		if (openSeq > 0) {
			open = true;
		}
	});

	$effect(() => {
		if (open) {
			searchInput?.focus();
		}
	});

	const filteredAuthors = $derived(
		search ? authors.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : authors
	);

	const activeIndex = $derived(
		filteredAuthors.length === 0 ? 0 : Math.min(requestedIndex, filteredAuthors.length - 1)
	);

	const selectedCount = $derived(selectedIds.size);
	const showClear = $derived(selectedCount > 0);

	const selectedNames = $derived(
		authors
			.filter((a) => selectedIds.has(a.id))
			.map((a) => a.name)
			.join(', ')
	);

	function handleToggle(id: number) {
		onToggle(id);
	}

	function handleClear(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onClear();
		triggerButton?.focus();
	}

	function closeDropdown(restoreTriggerFocus = false) {
		open = false;
		search = '';
		requestedIndex = 0;
		if (restoreTriggerFocus) triggerButton?.focus();
	}

	function toggleDropdown() {
		if (open) {
			closeDropdown();
		} else {
			open = true;
			requestedIndex = 0;
		}
	}

	function handleFocusOut(e: FocusEvent) {
		const container = e.currentTarget as HTMLElement;
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (!relatedTarget || !container.contains(relatedTarget)) {
			closeDropdown();
		}
	}

	function handleSearchInput() {
		requestedIndex = 0;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			closeDropdown(true);
			return;
		}

		const next = navigateListIndex(e.key, activeIndex, filteredAuthors.length, {
			homeEnd: false
		});
		if (next !== null) {
			e.preventDefault();
			requestedIndex = next;
			return;
		}

		if ((e.key === 'Enter' || e.key === ' ') && filteredAuthors.length > 0) {
			const author = filteredAuthors[activeIndex];
			if (!author) return;
			// Space in the search field should type a space, not toggle.
			if (e.key === ' ' && e.target === searchInput) return;
			e.preventDefault();
			handleToggle(author.id);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="author-select relative" onfocusout={handleFocusOut} onkeydown={handleKeyDown}>
	<button
		id="author-filter-trigger"
		bind:this={triggerButton}
		type="button"
		onclick={toggleDropdown}
		class="author-select-trigger w-full px-4 py-2 rounded-xl text-sm text-left transition-all duration-200 outline-none focus:ring-2"
		class:author-select-trigger--clearable={showClear}
		style="
			background-color: var(--input-bg);
			color: var(--text-primary);
			border: 1px solid var(--border);
			--tw-ring-color: var(--accent);
		"
		aria-expanded={open}
		aria-haspopup="listbox"
		aria-controls={listboxId}
	>
		<span
			class="truncate block"
			style="color: {selectedCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'};"
		>
			{#if selectedCount === 0}
				All authors
			{:else}
				{selectedNames}
			{/if}
		</span>
	</button>

	<div class="author-select-trailing">
		{#if showClear}
			<button
				type="button"
				class="author-select-clear"
				style="color: var(--text-secondary);"
				aria-label="Clear author selection"
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
		<svg
			class="author-select-caret size-4 shrink-0"
			class:author-select-caret--open={open}
			style="color: var(--text-secondary);"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="M19 9l-7 7-7-7" />
		</svg>
	</div>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="fixed inset-0 z-10" onclick={() => closeDropdown(true)}></div>
		<div
			class="absolute z-20 mt-2 w-full max-h-64 flex flex-col rounded-xl shadow-lg"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="p-2 border-b shrink-0" style="border-color: var(--border);">
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search authors..."
					bind:value={search}
					oninput={handleSearchInput}
					class="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
					style="background-color: var(--input-bg); color: var(--text-primary); border: 1px solid var(--border);"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded="true"
					aria-controls={listboxId}
					aria-activedescendant={filteredAuthors.length > 0
						? `${listboxId}-option-${activeIndex}`
						: undefined}
				/>
			</div>

			<Listbox
				id={listboxId}
				label="Authors"
				options={filteredAuthors}
				{activeIndex}
				onActiveIndexChange={(index) => (requestedIndex = index)}
				onSelect={(author) => handleToggle(author.id)}
				getKey={(author) => author.id}
				isSelected={(author) => selectedIds.has(author.id)}
				multiselectable
				preserveExternalFocus
				class="overflow-y-auto flex-1 min-h-0"
			>
				{#snippet item({ option: author, active, selected, optionProps })}
					<button
						{...optionProps}
						class="author-select-option w-full px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors hover:brightness-95"
						class:author-select-option--active={active}
						class:author-select-option--selected={selected}
					>
						<span
							class="size-4 rounded border flex items-center justify-center text-xs"
							style="
								border-color: {selected ? 'var(--accent)' : 'var(--border)'};
								background-color: {selected ? 'var(--accent)' : 'transparent'};
								color: {selected ? 'var(--accent-fg)' : 'transparent'};
							"
							aria-hidden="true"
						>
							✓
						</span>
						<span style="color: var(--text-primary);">{author.name}</span>
					</button>
				{/snippet}
				{#snippet empty()}
					<p class="px-4 py-2 text-sm" style="color: var(--text-secondary);">No authors found</p>
				{/snippet}
			</Listbox>
		</div>
	{/if}
</div>

<style>
	.author-select-option {
		background-color: transparent;
	}

	.author-select-option--selected {
		background-color: var(--bg-primary);
	}

	.author-select-option--active {
		background-color: color-mix(in srgb, var(--accent) 12%, var(--bg-secondary));
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.author-select-option--active.author-select-option--selected {
		background-color: color-mix(in srgb, var(--accent) 14%, var(--bg-primary));
	}

	.author-select-trigger {
		padding-right: 2.25rem;
	}

	.author-select-trigger--clearable {
		padding-right: 3.75rem;
	}

	.author-select-trailing {
		position: absolute;
		top: 50%;
		right: 0.75rem;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.author-select-clear {
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

	.author-select-clear:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.author-select-clear:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.author-select-caret {
		transition: transform 0.2s ease;
	}

	.author-select-caret--open {
		transform: rotate(180deg);
	}
</style>
