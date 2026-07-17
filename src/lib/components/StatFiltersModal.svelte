<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import StatLimitFiltersBody from '$lib/components/StatLimitFiltersBody.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		getStatFilterSectionSummary,
		type StatFilterSection
	} from '$lib/filterSummaries';

	interface Props {
		open: boolean;
		section: StatFilterSection | null;
		onClose: () => void;
	}

	let { open, section, onClose }: Props = $props();

	const title = $derived(section === 'hands' ? 'Hands & fingers' : 'General stats');
	const intro = $derived(
		section === 'hands'
			? 'Filter by left/right hand and finger stats. Leave empty to ignore.'
			: 'Filter by overall layout stats. Leave empty to ignore.'
	);
	const panelClass = $derived(
		section === 'hands'
			? 'max-h-[min(92vh,900px)] max-w-lg'
			: 'max-h-[min(92vh,900px)] max-w-[770px]'
	);
	const hasActiveFilters = $derived(
		section ? Boolean(getStatFilterSectionSummary(filterStore, section)) : false
	);

	function clearActiveSection() {
		if (section === 'general') filterStore.clearGeneralStatLimits();
		else if (section === 'hands') filterStore.clearHandStatLimits();
	}
</script>

<ModalShell {open} {onClose} labelledBy="stat-filters-modal-title" {panelClass}>
	<div
		class="flex items-center justify-between gap-3 border-b px-5 py-4"
		style="border-color: var(--border);"
	>
		<div class="flex min-w-0 items-center gap-2">
			<h2
				id="stat-filters-modal-title"
				class="text-lg font-semibold shrink-0"
				style="color: var(--text-primary);"
			>
				{title}
			</h2>
			{#if hasActiveFilters}
				<button
					type="button"
					class="stat-filters-modal-clear"
					style="color: var(--accent); background-color: var(--bg-secondary);"
					onclick={clearActiveSection}
				>
					Clear
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
		<p class="stat-filters-modal-intro" style="color: var(--text-secondary);">{intro}</p>
		{#if section}
			<StatLimitFiltersBody {section} />
		{/if}
	</div>
</ModalShell>

<style>
	.stat-filters-modal-clear {
		padding: 0.25rem 0.5rem;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		cursor: pointer;
	}

	.stat-filters-modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		line-height: 1.4;
	}
</style>
