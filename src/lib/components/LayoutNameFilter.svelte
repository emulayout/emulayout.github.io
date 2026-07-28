<script lang="ts">
	import { filterStore } from '$lib/filterStore.svelte';

	let input = $state<HTMLInputElement>();
	const showClear = $derived(filterStore.nameFilterInput.length > 0);

	function clear() {
		filterStore.setNameFilter('');
		input?.focus();
	}
</script>

<div class="layout-name-filter">
	<label for="name-filter" class="layout-name-filter-label">Layout name</label>
	<div class="layout-name-filter-field">
		<input
			bind:this={input}
			id="name-filter"
			type="text"
			name="layout-filter-query"
			value={filterStore.nameFilterInput}
			oninput={(event) => filterStore.setNameFilter(event.currentTarget.value)}
			autocomplete="off"
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
			aria-autocomplete="none"
			data-1p-ignore
			data-lpignore="true"
			data-form-type="other"
			class="layout-name-filter-input"
			class:layout-name-filter-input--clearable={showClear}
			style="
				background-color: var(--input-bg);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
			placeholder="Use commas for multiple results"
		/>

		{#if showClear}
			<button
				type="button"
				class="layout-name-filter-clear"
				style="color: var(--text-secondary);"
				aria-label="Clear layout name"
				title="Clear"
				onclick={clear}
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
</div>

<style>
	.layout-name-filter {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}

	.layout-name-filter-label {
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.25;
	}

	.layout-name-filter-field {
		position: relative;
		min-width: 0;
	}

	.layout-name-filter-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		outline: none;
	}

	.layout-name-filter-input--clearable {
		padding-right: 2.25rem;
	}

	.layout-name-filter-input:focus-visible {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.layout-name-filter-input:-webkit-autofill:focus-visible {
		box-shadow:
			0 0 0 1000px var(--input-bg) inset,
			0 0 0 2px var(--accent);
	}

	.layout-name-filter-clear {
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

	.layout-name-filter-clear:hover {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.layout-name-filter-clear:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}
</style>
