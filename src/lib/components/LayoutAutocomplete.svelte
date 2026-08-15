<script lang="ts">
	import TextAutocomplete from '$lib/components/TextAutocomplete.svelte';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layouts: LayoutData[];
		placeholder?: string;
		/** Accessible label for the input. */
		label?: string;
		id?: string;
		maxResults?: number;
		/** Committed selection shown in the field when not actively searching. */
		selected?: string | null;
		/** Fires with the highlighted option while browsing; `null` when preview ends. */
		onHighlight?: (name: string | null) => void;
		onSelect?: (name: string, meta: { via: 'enter' | 'click' }) => void;
		/** When set with a selection, shows a clear control in the field. */
		onClear?: () => void;
		/** Shows a non-layout-affecting loading indicator inside the field. */
		loading?: boolean;
	}

	let {
		layouts,
		placeholder = 'Search layouts…',
		label = 'Find layout',
		id = 'layout-autocomplete',
		maxResults = 50,
		selected = null,
		onHighlight,
		onSelect,
		onClear,
		loading = false
	}: Props = $props();

	let autocomplete = $state<TextAutocomplete>();
	const options = $derived(layouts.map((layout) => layout.name));

	/** Focus the search input (e.g. when the parent modal opens). */
	export function focus() {
		autocomplete?.focus();
	}
</script>

<TextAutocomplete
	bind:this={autocomplete}
	{options}
	{selected}
	{placeholder}
	{label}
	{id}
	{maxResults}
	{onHighlight}
	{onSelect}
	{onClear}
	{loading}
	kind="layout"
	emptyText="No layouts match."
	loadingText="Loading layouts…"
	clearLabel="Clear selected layout"
	showOptionsLabel="Show layout options"
	hideOptionsLabel="Hide layout options"
/>
