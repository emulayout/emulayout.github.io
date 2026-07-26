<script lang="ts">
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

	let open = $state(false);
	let search = $state('');
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let triggerButton = $state<HTMLButtonElement | undefined>(undefined);

	$effect(() => {
		if (openSeq > 0) {
			open = true;
		}
	});

	$effect(() => {
		if (open) {
			// Focus the search input when dropdown opens
			searchInput?.focus();
		}
	});

	const filteredAuthors = $derived(
		search ? authors.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : authors
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
		if (restoreTriggerFocus) triggerButton?.focus();
	}

	function toggleDropdown() {
		if (open) {
			closeDropdown();
		} else {
			open = true;
		}
	}

	function handleFocusOut(e: FocusEvent) {
		// Check if focus moved outside this component
		const container = e.currentTarget as HTMLElement;
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (relatedTarget && !container.contains(relatedTarget)) {
			closeDropdown();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			closeDropdown(true);
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
			<!-- Search input -->
			<div class="p-2 border-b shrink-0" style="border-color: var(--border);">
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search authors..."
					bind:value={search}
					class="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
					style="background-color: var(--input-bg); color: var(--text-primary); border: 1px solid var(--border);"
				/>
			</div>

			<!-- Author list -->
			<div class="overflow-y-auto flex-1 min-h-0">
				{#each filteredAuthors as author (author.id)}
					<button
						type="button"
						onclick={() => handleToggle(author.id)}
						class="w-full px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors hover:brightness-95"
						style="background-color: {selectedIds.has(author.id)
							? 'var(--bg-primary)'
							: 'transparent'};"
					>
						<span
							class="size-4 rounded border flex items-center justify-center text-xs"
							style="
								border-color: {selectedIds.has(author.id) ? 'var(--accent)' : 'var(--border)'};
								background-color: {selectedIds.has(author.id) ? 'var(--accent)' : 'transparent'};
								color: {selectedIds.has(author.id) ? 'white' : 'transparent'};
							"
						>
							✓
						</span>
						<span style="color: var(--text-primary);">{author.name}</span>
					</button>
				{/each}
				{#if filteredAuthors.length === 0}
					<p class="px-4 py-2 text-sm" style="color: var(--text-secondary);">No authors found</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
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
