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
	}

	let { authors, selectedIds, onToggle, onClear }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let triggerButton = $state<HTMLButtonElement | undefined>(undefined);

	$effect(() => {
		if (open) {
			// Focus the search input when dropdown opens
			searchInput?.focus();
		} else {
			// Clear search when dropdown closes
			search = '';
		}
	});

	const filteredAuthors = $derived(
		search ? authors.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : authors
	);

	const selectedCount = $derived(selectedIds.size);

	const selectedNames = $derived(
		authors
			.filter((a) => selectedIds.has(a.id))
			.map((a) => a.name)
			.join(', ')
	);

	function handleToggle(id: number) {
		onToggle(id);
	}

	function handleFocusOut(e: FocusEvent) {
		// Check if focus moved outside this component
		const container = e.currentTarget as HTMLElement;
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (relatedTarget && !container.contains(relatedTarget)) {
			open = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			triggerButton?.focus();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative" onfocusout={handleFocusOut} onkeydown={handleKeyDown}>
	<button
		bind:this={triggerButton}
		onclick={() => (open = !open)}
		class="w-full px-4 py-2 rounded-xl text-sm text-left flex items-center justify-between transition-all duration-200 outline-none focus:ring-2"
		style="
			background-color: var(--bg-secondary);
			color: var(--text-primary);
			border: 1px solid {selectedCount > 0 ? 'var(--accent)' : 'var(--border)'};
			--tw-ring-color: var(--accent);
		"
	>
		<span
			class="truncate flex-1"
			style="color: {selectedCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'};"
		>
			{#if selectedCount === 0}
				Filter by author...
			{:else}
				{selectedNames}
			{/if}
		</span>
		<svg
			class="size-4 transition-transform duration-200"
			style="color: var(--text-secondary); transform: rotate({open ? 180 : 0}deg);"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="fixed inset-0 z-10"
			onclick={() => {
				open = false;
				triggerButton?.focus();
			}}
		></div>
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
					style="background-color: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border);"
				/>
			</div>

			<!-- Clear button -->
			{#if selectedCount > 0}
				<button
					onclick={() => {
						onClear();
						searchInput?.focus();
					}}
					class="w-full px-4 py-2 text-sm text-left border-b transition-colors shrink-0"
					style="color: var(--accent); border-color: var(--border);"
				>
					Clear selection
				</button>
			{/if}

			<!-- Author list -->
			<div class="overflow-y-auto flex-1 min-h-0">
				{#each filteredAuthors as author (author.id)}
					<button
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
