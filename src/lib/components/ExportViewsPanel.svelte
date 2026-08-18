<script lang="ts">
	import BackupExportPanel from '$lib/components/BackupExportPanel.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { serializeSavedFiltersDocument } from '$lib/savedFiltersStorage';

	const items = $derived(
		filterStore.savedFilters.map((view) => ({ key: view.id, name: view.name }))
	);

	function serialize(selectedKeys: ReadonlySet<string>) {
		return serializeSavedFiltersDocument(
			filterStore.savedFilters.filter((view) => selectedKeys.has(view.id)),
			2
		);
	}
</script>

<BackupExportPanel
	{items}
	{serialize}
	title="Back up custom views"
	description="Select the views to include, then copy the backup or save it as a JSON file."
	legend="Views to export"
	emptyMessage="Create a custom view before exporting a backup."
	singularNoun="view"
	pluralNoun="views"
	filenamePrefix="emulayout-views"
/>
