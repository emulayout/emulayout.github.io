<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		filterStore,
		type BoardTypeFilter,
		type CharacterSetFilter,
		type MagicKeyFilter,
		type ThumbKeyFilter
	} from '$lib/filterStore.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const hasActiveFilters = $derived(filterStore.hasActiveKeyboardFilters);
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="keyboard-filters-modal-title"
	panelClass="max-h-[min(92vh,900px)] max-w-md"
>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<div class="flex min-w-0 items-center gap-2">
			<h2
				id="keyboard-filters-modal-title"
				class="text-lg font-semibold shrink-0"
				style="color: var(--text-primary);"
			>
				Keyboard filters
			</h2>
			{#if hasActiveFilters}
				<button
					type="button"
					class="keyboard-filters-modal-clear"
					style="color: var(--accent); background-color: var(--bg-secondary);"
					onclick={() => filterStore.clearKeyboardFilters()}
				>
					Clear all
				</button>
			{/if}
		</div>
		<button
			onclick={onClose}
			class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
			style="color: var(--text-secondary);"
			aria-label="Close"
		>
			<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
		<p class="keyboard-filters-modal-intro" style="color: var(--text-secondary);">
			Filter layouts by keyboard shape and related options.
		</p>

		<div class="keyboard-filters-fields">
			<label class="keyboard-filters-field">
				<span class="keyboard-filters-label" style="color: var(--text-secondary);">Thumb keys</span>
				<select
					value={filterStore.thumbKeyFilter}
					onchange={(e) => filterStore.setThumbKeyFilter(e.currentTarget.value as ThumbKeyFilter)}
					class="keyboard-filters-select"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>

			<label class="keyboard-filters-field">
				<span
					class="keyboard-filters-label keyboard-filters-label--with-tip"
					style="color: var(--text-secondary);"
				>
					Magic key
					<Tooltip
						text="A magic key is a key that has custom functionality. For example, it can change its letter based on the preceeding key pressed. Since a magic key's functionality is not standardized, resources outside this explorer are required to understand its functionality."
					/>
				</span>
				<select
					value={filterStore.magicKeyFilter}
					onchange={(e) => filterStore.setMagicKeyFilter(e.currentTarget.value as MagicKeyFilter)}
					class="keyboard-filters-select"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<option value="optional">Optional</option>
					<option value="excluded">Excluded</option>
					<option value="required">Required</option>
				</select>
			</label>

			<label class="keyboard-filters-field">
				<span class="keyboard-filters-label" style="color: var(--text-secondary);">Board type</span>
				<select
					value={filterStore.boardTypeFilter}
					onchange={(e) => filterStore.setBoardTypeFilter(e.currentTarget.value as BoardTypeFilter)}
					class="keyboard-filters-select"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<option value="all">All</option>
					<option value="angle">Angle</option>
					<option value="stagger">Stagger</option>
					<option value="angle-stagger">Angle + stagger</option>
					<option value="ortho">Ortho</option>
					<option value="mini">Mini</option>
				</select>
			</label>

			<label class="keyboard-filters-field">
				<span class="keyboard-filters-label" style="color: var(--text-secondary);"
					>Character set</span
				>
				<select
					value={filterStore.characterSetFilter}
					onchange={(e) =>
						filterStore.setCharacterSetFilter(e.currentTarget.value as CharacterSetFilter)}
					class="keyboard-filters-select"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<option value="all">All</option>
					<option value="english">English</option>
					<option value="international">International</option>
				</select>
			</label>

			<label
				class="keyboard-filters-checkbox"
				class:cursor-pointer={filterStore.characterSetFilter !== 'international'}
			>
				<span class="relative">
					<input
						type="checkbox"
						checked={filterStore.showUnfinished}
						disabled={filterStore.characterSetFilter === 'international'}
						onchange={(e) => filterStore.setShowUnfinished(e.currentTarget.checked)}
						class="size-4 rounded appearance-none cursor-pointer relative"
						style="
							background-color: {filterStore.showUnfinished ? 'var(--accent)' : 'var(--bg-primary)'};
							border: 1px solid var(--border);
						"
					/>
					{#if filterStore.showUnfinished}
						<svg
							class="absolute top-[calc(50%-2px)] left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 pointer-events-none"
							style="color: white;"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<span
					class="text-sm flex items-center gap-1"
					class:line-through={filterStore.characterSetFilter === 'international'}
					style="color: var(--text-secondary);"
				>
					Show unfinished layouts
					<Tooltip
						text="Unfinished layouts are English-character-set layouts (without a magic key) that don't have all letters (A-Z) assigned to a key."
					/>
				</span>
			</label>
		</div>
	</div>
</ModalShell>

<style>
	.keyboard-filters-modal-clear {
		padding: 0.25rem 0.5rem;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		cursor: pointer;
	}

	.keyboard-filters-modal-intro {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		line-height: 1.45;
	}

	.keyboard-filters-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.keyboard-filters-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.keyboard-filters-label {
		font-size: 0.875rem;
	}

	.keyboard-filters-label--with-tip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.keyboard-filters-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
		cursor: pointer;
	}

	.keyboard-filters-select:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.keyboard-filters-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		user-select: none;
		margin-top: 0.25rem;
	}
</style>
