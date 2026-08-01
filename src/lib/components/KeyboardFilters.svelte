<script lang="ts">
	import AccordionSection from '$lib/components/AccordionSection.svelte';
	import KeyboardFiltersBody from '$lib/components/KeyboardFiltersBody.svelte';
	import type { KeyboardFilterField } from '$lib/filterFocus';
	import { filterStore } from '$lib/filterStore.svelte';
	import { afterPaint, focusFilterControl, takeFilterFocusRequest } from '$lib/focusFilterControl';

	let open = $state(false);
	let focusField = $state<KeyboardFilterField | null>(null);
	let focusToken = $state(0);

	const hasActive = $derived(filterStore.hasActiveKeyboardFilters);
	const panelId = 'keyboard-filters-accordion-panel';

	function toggle() {
		open = !open;
		if (!open) focusField = null;
	}

	$effect(() => {
		const req = takeFilterFocusRequest('keyboard');
		if (!req) return;
		open = true;
		focusField = req.field;
		focusToken = req.seq;
	});

	$effect(() => {
		if (!open || !focusField || !focusToken) return;
		const field = focusField;
		afterPaint(() => {
			focusFilterControl(
				document.querySelector<HTMLElement>(`#${panelId} [data-keyboard-field="${field}"]`)
			);
		});
	});
</script>

<AccordionSection
	{open}
	onToggle={toggle}
	label="Keyboard filters"
	{panelId}
	active={hasActive}
	onReset={() => filterStore.clearKeyboardFilters()}
>
	<KeyboardFiltersBody />
</AccordionSection>
