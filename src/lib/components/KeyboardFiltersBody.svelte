<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		filterStore,
		type AdaptiveSwapFilter,
		type ChiralKeyFilter,
		type CharacterSetFilter,
		type MagicKeyFilter,
		type RepeatKeyFilter,
		type ThumbKeyFilter
	} from '$lib/filterStore.svelte';
	import type { ActiveKeyboardSnapshot } from '$lib/activeFiltersAdjust';

	interface Props {
		/** When set, only show these keyboard fields (Adjust mode). */
		only?: ActiveKeyboardSnapshot | null;
	}

	let { only = null }: Props = $props();

	const idPrefix = $props.id();

	const showThumbs = $derived(!only || only.thumbs);
	const showRepeat = $derived(!only || only.repeat);
	const showMagic = $derived(!only || only.magic);
	const showAdaptive = $derived(!only || only.adaptive);
	const showChiral = $derived(!only || only.chiral);
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

	{#if showRepeat}
		<div class="keyboard-filters-field">
			<span
				class="keyboard-filters-label keyboard-filters-label--with-tip"
				style="color: var(--text-secondary);"
			>
				<label for="{idPrefix}-repeat">Repeat key</label>
				<Tooltip text="The @ key repeats the previous uninterrupted character." />
			</span>
			<select
				id="{idPrefix}-repeat"
				value={filterStore.repeatKeyFilter}
				onchange={(e) => filterStore.setRepeatKeyFilter(e.currentTarget.value as RepeatKeyFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="repeat"
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
		</div>
	{/if}

	{#if showMagic}
		<div class="keyboard-filters-field">
			<span
				class="keyboard-filters-label keyboard-filters-label--with-tip"
				style="color: var(--text-secondary);"
			>
				<label for="{idPrefix}-magic">Magic key</label>
				<Tooltip
					text="A key with custom behavior (for example, changing based on the previous key). Details aren't standardized here."
				/>
			</span>
			<select
				id="{idPrefix}-magic"
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
		</div>
	{/if}

	{#if showAdaptive}
		<div class="keyboard-filters-field">
			<span
				class="keyboard-filters-label keyboard-filters-label--with-tip"
				style="color: var(--text-secondary);"
			>
				<label for="{idPrefix}-adaptive">Adaptive swap</label>
				<Tooltip
					text="Changes which character a key produces based on the immediately preceding key."
				/>
			</span>
			<select
				id="{idPrefix}-adaptive"
				value={filterStore.adaptiveSwapFilter}
				onchange={(e) =>
					filterStore.setAdaptiveSwapFilter(e.currentTarget.value as AdaptiveSwapFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="adaptive"
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
		</div>
	{/if}

	{#if showChiral}
		<div class="keyboard-filters-field">
			<span
				class="keyboard-filters-label keyboard-filters-label--with-tip"
				style="color: var(--text-secondary);"
			>
				<label for="{idPrefix}-chiral">Chiral keys</label>
				<Tooltip text="Chooses an output based on the hand assigned to the previous character." />
			</span>
			<select
				id="{idPrefix}-chiral"
				value={filterStore.chiralKeyFilter}
				onchange={(e) => filterStore.setChiralKeyFilter(e.currentTarget.value as ChiralKeyFilter)}
				class="keyboard-filters-select"
				data-keyboard-field="chiral"
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
		</div>
	{/if}

	{#if showCharset}
		<label class="keyboard-filters-field">
			<span class="keyboard-filters-label" style="color: var(--text-secondary);">Character set</span
			>
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
		<div class="keyboard-filters-checkbox">
			<label
				for="{idPrefix}-unfinished"
				class="keyboard-filters-checkbox-label"
				class:cursor-pointer={filterStore.characterSetFilter !== 'international'}
			>
				<span class="relative">
					<input
						id="{idPrefix}-unfinished"
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
							style="color: var(--accent-fg);"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<span
					class="text-sm"
					class:line-through={filterStore.characterSetFilter === 'international'}
					style="color: var(--text-secondary);"
				>
					Show unfinished layouts
				</span>
			</label>
			<Tooltip text="English layouts (no Magic or Repeat key) that are missing some A–Z letters." />
		</div>
	{/if}
</div>

<style>
	.keyboard-filters-fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.keyboard-filters-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.keyboard-filters-label {
		font-size: 0.8125rem;
	}

	.keyboard-filters-label--with-tip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.keyboard-filters-select {
		width: 100%;
		padding: 0.375rem var(--select-chevron-pad) 0.375rem 0.625rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		outline: none;
		cursor: pointer;
	}

	.keyboard-filters-select:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.keyboard-filters-checkbox {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		user-select: none;
	}

	.keyboard-filters-checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
