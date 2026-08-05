<script lang="ts">
	import AccordionSection from '$lib/components/AccordionSection.svelte';
	import SimilarityFiltersBody from '$lib/components/SimilarityFiltersBody.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, peekFilterFocusRequest } from '$lib/focusFilterControl';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layouts: LayoutData[];
	}

	let { layouts }: Props = $props();

	let open = $state(false);
	let focusToken = $state(0);

	const hasActive = $derived(filterStore.hasSimilarReference);
	const showReset = $derived(hasActive || filterStore.hasModifiedSimilarityFilter);
	const panelId = 'similarity-filters-accordion-panel';

	function resetAll() {
		filterStore.clearSimilarReference();
		filterStore.resetSimilarityFilter();
	}

	function toggle() {
		open = !open;
		if (!open) focusToken = 0;
	}

	$effect(() => {
		const req = peekFilterFocusRequest('sidebar');
		if (!req || req.field !== 'similarity') return;
		filterStore.clearFilterFocusRequest(req.seq);
		open = true;
		focusToken = req.seq;
	});

	$effect(() => {
		if (!open || !focusToken) return;
		afterPaint(() => {
			const el =
				document.getElementById('similarity-match-value') ??
				document.getElementById('similarity-layout-search');
			focusFilterControl(el);
		});
	});
</script>

<AccordionSection
	{open}
	onToggle={toggle}
	label="Similarity filter"
	{panelId}
	active={hasActive}
	{showReset}
	onReset={resetAll}
>
	{#snippet hint()}
		<Tooltip
			text="Compare letter positions to a reference layout. Differing keys are highlighted on cards."
		/>
	{/snippet}
	<SimilarityFiltersBody {layouts} />
</AccordionSection>
