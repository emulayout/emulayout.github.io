<script lang="ts">
	import TextAutocomplete from '$lib/components/TextAutocomplete.svelte';

	interface Props {
		authors: readonly string[];
		placeholder?: string;
		/** Accessible label for the input. */
		label?: string;
		id?: string;
		maxResults?: number;
		/** Live freeform or catalog author shown in the field. */
		selected?: string;
		onChange?: (name: string) => void;
		/** When set with a selection, shows a clear control in the field. */
		onClear?: () => void;
		/** Shows a non-author-affecting loading indicator inside the field. */
		loading?: boolean;
	}

	let {
		authors,
		placeholder = 'Search or add author',
		label = 'Author name',
		id = 'author-autocomplete',
		maxResults = 50,
		selected = '',
		onChange,
		onClear,
		loading = false
	}: Props = $props();
</script>

<TextAutocomplete
	options={authors}
	{selected}
	mode="freeform"
	{placeholder}
	{label}
	{id}
	{maxResults}
	{onClear}
	{loading}
	onInputChange={onChange}
	kind="author"
	emptyText="No authors match."
	loadingText="Loading authors…"
	clearLabel="Clear selected author"
	showOptionsLabel="Show author options"
	hideOptionsLabel="Hide author options"
/>
