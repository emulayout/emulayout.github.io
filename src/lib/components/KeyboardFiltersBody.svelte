<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		filterStore,
		type BoardTypeFilter,
		type CharacterSetFilter,
		type MagicKeyFilter,
		type ThumbKeyFilter
	} from '$lib/filterStore.svelte';
	import type { ActiveKeyboardSnapshot } from '$lib/activeFiltersAdjust';

	interface Props {
		/** When set, only show these keyboard fields (Adjust mode). */
		only?: ActiveKeyboardSnapshot | null;
	}

	let { only = null }: Props = $props();

	const showThumbs = $derived(!only || only.thumbs);
	const showMagic = $derived(!only || only.magic);
	const showBoard = $derived(!only || only.board);
	const showCharset = $derived(!only || only.charset);
	const showUnfinished = $derived(!only || only.unfinished);
</script>

<div class="keyboard-filters-fields">
	{#if showThumbs}
		<label class="keyboard-filters-field">
			<span class="keyboard-filters-label" style="color: var(--text-secondary);">Thumb keys</span>
			<select
				value={filterStore.thumbKeyFilter}
				onchange={(e) => filterStore.setThumbKeyFilter(e.currentTarget.value as ThumbKeyFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="thumbs"
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
	{/if}

	{#if showMagic}
		<label class="keyboard-filters-field">
			<span
				class="keyboard-filters-label keyboard-filters-label--with-tip"
				style="color: var(--text-secondary);"
			>
				Magic key
				<Tooltip
					text="A key with custom behavior (for example, changing based on the previous key). Details aren't standardized here."
				/>
			</span>
			<select
				value={filterStore.magicKeyFilter}
				onchange={(e) => filterStore.setMagicKeyFilter(e.currentTarget.value as MagicKeyFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="magic"
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
	{/if}

	{#if showBoard}
		<label class="keyboard-filters-field">
			<span class="keyboard-filters-label" style="color: var(--text-secondary);">Board type</span>
			<select
				value={filterStore.boardTypeFilter}
				onchange={(e) => filterStore.setBoardTypeFilter(e.currentTarget.value as BoardTypeFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="board"
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
	{/if}

	{#if showCharset}
		<label class="keyboard-filters-field">
			<span class="keyboard-filters-label" style="color: var(--text-secondary);">Character set</span>
			<select
				value={filterStore.characterSetFilter}
				onchange={(e) =>
					filterStore.setCharacterSetFilter(e.currentTarget.value as CharacterSetFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="charset"
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
	{/if}

	{#if showUnfinished}
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
					data-keyboard-field="unfinished"
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
				<Tooltip text="English layouts (no magic key) that are missing some A–Z letters." />
			</span>
		</label>
	{/if}
</div>

<style>
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
