<script lang="ts">
	import BackupImportPanel from '$lib/components/BackupImportPanel.svelte';
	import { filterStore, type SavedFilter } from '$lib/filterStore.svelte';
	import {
		parseSavedViewsBackup,
		type SavedViewsBackupError,
		type SavedViewsImportMode
	} from '$lib/savedViewsBackup';

	interface Props {
		onImported: (message: string) => void;
	}

	let { onImported }: Props = $props();

	function parse(text: string) {
		const result = parseSavedViewsBackup(text);
		return result.ok
			? { ok: true as const, items: result.filters, skippedCount: result.skippedCount }
			: result;
	}

	function errorMessage(code: string): string {
		switch (code as SavedViewsBackupError) {
			case 'empty':
				return 'Paste a backup or choose a JSON file first.';
			case 'invalid-json':
				return 'This is not valid JSON. Check the backup text and try again.';
			case 'unsupported-format':
				return 'This JSON is not an emulayout views backup.';
			case 'no-views':
				return 'No valid views were found in this backup.';
			default:
				return 'This backup could not be read.';
		}
	}

	function importViews(views: SavedFilter[], mode: SavedViewsImportMode) {
		filterStore.importSavedViews(views, mode);
	}
</script>

<BackupImportPanel
	{parse}
	itemId={(view) => view.id}
	itemName={(view) => view.name}
	onImport={importViews}
	{onImported}
	{errorMessage}
	title="Restore a views backup"
	description="Paste backup JSON or choose a file, then select the views to restore."
	placeholder="Paste an emulayout views backup here"
	legend="Views to import"
	emptyMessage="No views found."
	singularNoun="view"
	pluralNoun="views"
	radioName="view-import-mode"
	importError="The views could not be saved in this browser."
/>
