<script lang="ts">
	import AccordionSection from '$lib/components/AccordionSection.svelte';
	import KeyPositionFilter from '$lib/components/KeyPositionFilter.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import type { KeyFilterKind } from '$lib/filterFocus';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, takeFilterFocusRequest } from '$lib/focusFilterControl';

	const SECTIONS: Array<{
		kind: KeyFilterKind;
		title: string;
		hint: string;
		accentColor: string;
		panelId: string;
	}> = [
		{
			kind: 'and',
			title: 'Include keys (AND)',
			hint: 'Every filled position must match. Multiple keys in a cell match any of them at that position.',
			accentColor: '#4ade80',
			panelId: 'key-filters-and-panel'
		},
		{
			kind: 'or',
			title: 'Include keys (OR)',
			hint: 'At least one filled position must match. Multiple keys in a cell match any of them at that position.',
			accentColor: '#60a5fa',
			panelId: 'key-filters-or-panel'
		},
		{
			kind: 'exclude',
			title: 'Exclude keys',
			hint: 'Exclude layouts that match any filled position. Multiple keys in a cell exclude any of them at that position.',
			accentColor: '#f87171',
			panelId: 'key-filters-exclude-panel'
		}
	];

	let openByKind = $state<Record<KeyFilterKind, boolean>>({
		and: false,
		or: false,
		exclude: false
	});

	const hideThumbKeys = $derived(filterStore.thumbKeyFilter === 'excluded');

	function isActive(kind: KeyFilterKind): boolean {
		return filterStore.hasActiveKeyFilterKind(kind);
	}

	function toggle(kind: KeyFilterKind) {
		openByKind[kind] = !openByKind[kind];
	}

	function clearKind(kind: KeyFilterKind) {
		if (kind === 'and') filterStore.clearInclude();
		else if (kind === 'or') filterStore.clearIncludeOr();
		else filterStore.clearExclude();
	}

	$effect(() => {
		const req = takeFilterFocusRequest('keys');
		if (!req) return;
		openByKind[req.kind] = true;
		afterPaint(() => {
			document
				.getElementById(`key-filters-${req.kind}-accordion`)
				?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});
</script>

<div class="filter-accordion-group key-filters">
	{#each SECTIONS as section (section.kind)}
		{@const open = openByKind[section.kind]}
		{@const active = isActive(section.kind)}
		<AccordionSection
			id="key-filters-{section.kind}-accordion"
			{open}
			onToggle={() => toggle(section.kind)}
			label={section.title}
			panelId={section.panelId}
			{active}
			onReset={() => clearKind(section.kind)}
		>
			{#snippet hint()}
				<Tooltip text={section.hint} />
			{/snippet}
			{#if section.kind === 'and'}
				<KeyPositionFilter
					grid={filterStore.includeGrid}
					leftThumbKeys={filterStore.includeLeftThumbKeys}
					rightThumbKeys={filterStore.includeRightThumbKeys}
					{hideThumbKeys}
					accentColor={section.accentColor}
					nested
					compact
					onCellChange={(row, col, value) => filterStore.setIncludeCell(row, col, value)}
					onLeftThumbKeyChange={(index, value) => filterStore.setIncludeLeftThumbKey(index, value)}
					onRightThumbKeyChange={(index, value) =>
						filterStore.setIncludeRightThumbKey(index, value)}
				/>
			{:else if section.kind === 'or'}
				<KeyPositionFilter
					grid={filterStore.includeOrGrid}
					leftThumbKeys={filterStore.includeOrLeftThumbKeys}
					rightThumbKeys={filterStore.includeOrRightThumbKeys}
					{hideThumbKeys}
					accentColor={section.accentColor}
					nested
					compact
					onCellChange={(row, col, value) => filterStore.setIncludeOrCell(row, col, value)}
					onLeftThumbKeyChange={(index, value) =>
						filterStore.setIncludeOrLeftThumbKey(index, value)}
					onRightThumbKeyChange={(index, value) =>
						filterStore.setIncludeOrRightThumbKey(index, value)}
				/>
			{:else}
				<KeyPositionFilter
					grid={filterStore.excludeGrid}
					leftThumbKeys={filterStore.excludeLeftThumbKeys}
					rightThumbKeys={filterStore.excludeRightThumbKeys}
					{hideThumbKeys}
					accentColor={section.accentColor}
					nested
					compact
					onCellChange={(row, col, value) => filterStore.setExcludeCell(row, col, value)}
					onLeftThumbKeyChange={(index, value) => filterStore.setExcludeLeftThumbKey(index, value)}
					onRightThumbKeyChange={(index, value) =>
						filterStore.setExcludeRightThumbKey(index, value)}
				/>
			{/if}
		</AccordionSection>
	{/each}
</div>

<style>
	.key-filters {
		width: 100%;
	}
</style>
